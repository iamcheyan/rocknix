//! PocketShell Developer Host.
//!
//! Serves the PocketShell terminal model to a browser so rendering, ANSI and
//! workspace behaviour can be validated without flashing a device. The same
//! `pocketshell_terminal` module runs on the RG34XX, so this is the real model
//! and parser, not a mock.
//!
//! Routes:
//!   GET  /                 single-page harness
//!   GET  /api/frame        dirty rows + cursor since the last poll
//!   GET  /api/state        workspace/buffer/perf snapshot (JSON)
//!   GET  /api/log          event log (JSON)
//!   POST /api/input        `WS<TAB>KEY ENTER` | `ACTIVATE n` | `RESIZE RxC`
//!   POST /api/ansi         parse arbitrary bytes through a throwaway terminal

#[path = "../../../projects/ROCKNIX/packages/apps/pocketjs-runtime/scripts/pocketshell-terminal.rs"]
mod pocketshell_terminal;
mod replay;

use pocketshell_terminal::{playground, PocketShell};
use replay::Replay;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const INDEX_HTML: &str = include_str!("index.html");
const TICK_HZ: u64 = 60;

const REPLAY_VIEW: usize = 5;

struct Shared {
    shell: PocketShell,
    replay: Replay,
    /// 0..=4 selects a live workspace, 5 selects the replay buffer.
    view: usize,
    pending: String,
    polls: u64,
    started: std::time::Instant,
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("record") {
        // pocketshell-dev record <out.log> -- <command...>
        let output = args.get(2).expect("record <out.log> -- <command>");
        let split = args.iter().position(|arg| arg == "--").unwrap_or(args.len());
        let command: Vec<String> = args[split.saturating_add(1)..].to_vec();
        let stop_after = std::env::var("RECORD_MS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(4000);
        if command.is_empty() {
            eprintln!("usage: pocketshell-dev record <out.log> -- <command...>");
            std::process::exit(2);
        }
        if let Err(error) = replay::record(output, &command, stop_after) {
            eprintln!("record failed: {error}");
            std::process::exit(1);
        }
        return;
    }
    let port: u16 = args
        .get(1)
        .and_then(|value| value.parse().ok())
        .unwrap_or(8080);
    let state = Arc::new(Mutex::new(Shared {
        shell: PocketShell::new(),
        replay: Replay::empty(24, 54),
        view: 0,
        pending: String::new(),
        polls: 0,
        started: std::time::Instant::now(),
    }));

    {
        // Start every workspace once so the harness opens on a live shell.
        let mut shared = state.lock().unwrap();
        for id in 0..pocketshell_terminal::WORKSPACES {
            shared.shell.command(&format!("{id}\tSTART"));
        }
        shared.shell.command("LOG\tDeveloper Host started");
    }

    let ticker = state.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(1000 / TICK_HZ));
        let mut shared = ticker.lock().unwrap();
        shared.replay.tick();
        let output = if shared.view == REPLAY_VIEW {
            shared.replay.frame()
        } else {
            shared.shell.frame()
        };
        if !output.is_empty() {
            shared.pending.push_str(&output);
            // A stalled browser must not grow the buffer without bound.
            if shared.pending.len() > 4 * 1024 * 1024 {
                shared.pending.clear();
            }
        }
    });

    let listener = TcpListener::bind(("0.0.0.0", port)).expect("bind 0.0.0.0");
    println!("PocketShell Dev Host started");
    println!("http://127.0.0.1:{port}");
    for address in local_addresses() {
        println!("http://{address}:{port}");
    }
    println!("physical 720x480  logical 360x240  scale 2x");

    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let state = state.clone();
        std::thread::spawn(move || {
            let _ = handle(stream, state);
        });
    }
}

fn local_addresses() -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(output) = std::process::Command::new("hostname").arg("-I").output() {
        for token in String::from_utf8_lossy(&output.stdout).split_whitespace() {
            if !token.starts_with("127.") && token.parse::<std::net::Ipv4Addr>().is_ok() {
                out.push(token.to_string());
            }
        }
    }
    out
}

struct Request {
    method: String,
    path: String,
    body: Vec<u8>,
}

fn read_request(stream: &mut TcpStream) -> std::io::Result<Request> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];
    let header_end = loop {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            return Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "closed"));
        }
        buffer.extend_from_slice(&chunk[..count]);
        if let Some(index) = find(&buffer, b"\r\n\r\n") {
            break index + 4;
        }
        if buffer.len() > 64 * 1024 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "header too large"));
        }
    };
    let head = String::from_utf8_lossy(&buffer[..header_end]).to_string();
    let mut lines = head.lines();
    let request_line = lines.next().unwrap_or("");
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_string();
    let path = parts.next().unwrap_or("/").split('?').next().unwrap_or("/").to_string();
    let mut content_length = 0usize;
    for line in lines {
        let lower = line.to_ascii_lowercase();
        if let Some(value) = lower.strip_prefix("content-length:") {
            content_length = value.trim().parse().unwrap_or(0);
        }
    }
    let mut body = buffer[header_end..].to_vec();
    while body.len() < content_length {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..count]);
    }
    body.truncate(content_length);
    Ok(Request { method, path, body })
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|window| window == needle)
}

fn respond(stream: &mut TcpStream, status: &str, content_type: &str, body: &[u8]) {
    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn handle(mut stream: TcpStream, state: Arc<Mutex<Shared>>) -> std::io::Result<()> {
    let request = match read_request(&mut stream) {
        Ok(request) => request,
        Err(_) => return Ok(()),
    };
    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/") | ("GET", "/index.html") => {
            respond(&mut stream, "200 OK", "text/html; charset=utf-8", INDEX_HTML.as_bytes());
        }
        ("GET", "/api/frame") => {
            let body = {
                let mut shared = state.lock().unwrap();
                let taken = std::mem::take(&mut shared.pending);
                shared.polls += 1;
                let uptime = shared.started.elapsed().as_secs_f32();
                format!("{taken}\nS\t{:.1}\t{:.1}\n", shared.polls as f32 / uptime.max(0.1), uptime)
            };
            respond(&mut stream, "200 OK", "text/plain; charset=utf-8", body.as_bytes());
        }
        ("GET", "/api/state") => {
            let body = {
                let shared = state.lock().unwrap();
                let mut json = shared.shell.inspector_json();
                // Splice the developer-host extras into the shared snapshot.
                if json.ends_with('}') {
                    json.pop();
                }
                json.push_str(&format!(
                    ",\"view\":{},\"replay\":{}}}",
                    shared.view,
                    shared.replay.meta_json()
                ));
                json
            };
            respond(&mut stream, "200 OK", "application/json", body.as_bytes());
        }
        ("GET", "/api/replay/list") => {
            let mut files = Vec::new();
            for dir in ["recordings", "../recordings"] {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().map(|e| e == "log").unwrap_or(false) {
                            files.push(path.display().to_string());
                        }
                    }
                }
            }
            let body = format!(r#"{{"files":["{}"]}}"#, files.join(r#"",""#));
            respond(&mut stream, "200 OK", "application/json", body.as_bytes());
        }
        ("POST", "/api/replay/load") => {
            let path = String::from_utf8_lossy(&request.body).trim().to_string();
            let body = {
                let mut shared = state.lock().unwrap();
                match Replay::load(&path, 24, 54) {
                    Ok(loaded) => {

                        shared.replay = loaded;
                        shared.view = REPLAY_VIEW;
                        format!("{{\"ok\":true,\"replay\":{}}}", shared.replay.meta_json())
                    }
                    Err(error) => format!("{{\"ok\":false,\"error\":\"{error}\"}}"),
                }
            };
            respond(&mut stream, "200 OK", "application/json", body.as_bytes());
        }
        ("POST", "/api/replay/control") => {
            let action = String::from_utf8_lossy(&request.body).trim().to_string();
            let body = {
                let mut shared = state.lock().unwrap();
                match action.as_str() {
                    "play" => shared.replay.playing = true,
                    "pause" => shared.replay.playing = false,
                    "repaint" => shared.replay.repaint(),
                    "restart" => {
                        shared.replay.restart();
                        shared.replay.playing = true;
                    }
                    other => {
                        if let Some(value) = other.strip_prefix("seek:") {
                            if let Ok(ms) = value.parse::<u64>() {
                                shared.replay.seek(ms);
                            }
                        }
                    }
                }
                shared.replay.meta_json()
            };
            respond(&mut stream, "200 OK", "application/json", body.as_bytes());
        }
        ("GET", "/api/log") => {
            let body = state.lock().unwrap().shell.log_json();
            respond(&mut stream, "200 OK", "application/json", body.as_bytes());
        }
        ("POST", "/api/input") => {
            let command = String::from_utf8_lossy(&request.body).to_string();
            let body = {
                let mut shared = state.lock().unwrap();
                // The replay buffer is host-owned and outside PocketShell's five slots.
                if let Some(target) = command.trim().strip_prefix("ACTIVATE\t") {
                    if let Ok(id) = target.parse::<usize>() {
                        shared.view = id;
                        if id == REPLAY_VIEW {
                            shared.replay.restart();
                            shared.replay.playing = true;
                            let body = shared.replay.meta_json();
                            respond(&mut stream, "200 OK", "application/json", body.as_bytes());
                            return Ok(());
                        }
                    }
                }
                let reply = shared.shell.command(command.trim_end_matches('\n'));
                if command.starts_with("ACTIVATE") {
                    let output = shared.shell.frame();
                    if !output.is_empty() {
                        shared.pending.push_str(&output);
                    }
                }
                reply
            };
            respond(&mut stream, "200 OK", "text/plain; charset=utf-8", body.as_bytes());
        }
        ("POST", "/api/ansi") => {
            // Body is a JSON-ish escape string from the playground textarea:
            // interpret \x1b, \n, \r, \t and plain text.
            let source = String::from_utf8_lossy(&request.body).to_string();
            let bytes = decode_escapes(&source);
            let (runs, meta) = playground(&bytes, 24, 54);
            let body = format!("{{\"runs\":{runs},\"meta\":{meta}}}");
            respond(&mut stream, "200 OK", "application/json", body.as_bytes());
        }
        ("POST", "/api/resize") => {
            let text = String::from_utf8_lossy(&request.body).to_string();
            state.lock().unwrap().shell.command(&format!("RESIZE\t{}", text.trim()));
            respond(&mut stream, "200 OK", "text/plain", b"ok");
        }
        _ => respond(&mut stream, "404 Not Found", "text/plain", b"not found"),
    }
    Ok(())
}

fn decode_escapes(source: &str) -> Vec<u8> {
    let bytes = source.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'\\' || index + 1 >= bytes.len() {
            out.push(bytes[index]);
            index += 1;
            continue;
        }
        match bytes[index + 1] {
            b'n' => { out.push(b'\n'); index += 2; }
            b'r' => { out.push(b'\r'); index += 2; }
            b't' => { out.push(b'\t'); index += 2; }
            b'e' => { out.push(0x1b); index += 2; }
            b'\\' => { out.push(b'\\'); index += 2; }
            b'x' if index + 3 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[index + 2..index + 4]).unwrap_or("00");
                out.push(u8::from_str_radix(hex, 16).unwrap_or(0));
                index += 4;
            }
            b'0' => { out.push(0); index += 2; }
            other => { out.push(other); index += 2; }
        }
    }
    out
}
