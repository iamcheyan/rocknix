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
//!   GET  /api/ota/status   filesystem simulator slot status
//!   GET  /api/ota/log      structured simulator audit log
//!   POST /api/ota/check    verify local fixture manifest
//!   POST /api/ota/confirm  commit simulated active slot after health success
//!   POST /api/ota/boot-failure report simulated failed boot
//!   POST /api/ota/rollback cancel pending or manually roll back simulated slot
//!   POST /api/ansi         parse arbitrary bytes through a throwaway terminal

#[path = "../../../projects/ROCKNIX/packages/apps/pocketjs-runtime/scripts/pocketshell-terminal.rs"]
mod pocketshell_terminal;
mod replay;
mod remote;
mod ota;

use pocketshell_terminal::{playground, PocketShell};
use replay::Replay;
use remote::{ClientMessage, VERSION};
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::{IpAddr, SocketAddr, TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const INDEX_HTML: &str = include_str!("index.html");
const TICK_HZ: u64 = 60;

const REPLAY_VIEW: usize = 5;

struct InputWorkspace {
    entered: bool,
    previous_view: usize,
    buffer: String,
    layout: String,
    function: String,
    history: Vec<String>,
    phrases: Vec<String>,
}

struct Shared {
    shell: PocketShell,
    replay: Replay,
    /// 0..=4 selects a live workspace, 5 selects the replay buffer.
    view: usize,
    input: InputWorkspace,
    pending: String,
    polls: u64,
    input_events: u64,
    ansi_events: u64,
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
    if args.get(1).map(String::as_str)==Some("push") {
        let dry=args.iter().any(|a|a=="--dry-run");let fixture=std::env::var("POCKETSHELL_OTA_FIXTURE").unwrap_or_else(|_|"fixtures/ota".into());
        if !dry||args.get(2).filter(|a|!a.starts_with('-')).is_none(){eprintln!("usage: pocketshell-dev push <device-ip> --dry-run");std::process::exit(2);}
        let root=std::env::var("POCKETSHELL_OTA_ROOT").unwrap_or_else(|_|"/tmp/pocketshell-ota-sim".into());let key=std::env::var("POCKETSHELL_OTA_PUBLIC_KEY").unwrap_or_else(|_|"fixtures/ota/public-key.hex".into());
        if let Err(e)=ota::push_dry_run(&root,&fixture,&key){eprintln!("push dry-run failed: {e}");std::process::exit(1);}return;
    }
    let (bind_ip, port) = parse_bind_args(&args);
    let state = Arc::new(Mutex::new(Shared {
        shell: PocketShell::new(),
        replay: Replay::empty(24, 54),
        view: 0,
        input: InputWorkspace {
            entered: false,
            previous_view: 0,
            buffer: String::new(),
            layout: "ABC".into(),
            function: "Keyboard".into(),
            history: Vec::new(),
            phrases: Vec::new(),
        },
        pending: String::new(),
        polls: 0,
        input_events: 0,
        ansi_events: 0,
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

    let listener = TcpListener::bind(SocketAddr::new(bind_ip, port)).expect("bind address");
    println!("PocketShell Dev Center started on {bind_ip}:{port}");
    println!("http://{bind_ip}:{port}");
    println!("physical 720x480  logical 360x240  scale 2x");
    for address in local_addresses() { println!("http://{address}:{port}"); }
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let state = state.clone();
        std::thread::spawn(move || { let _ = handle(stream, state); });
    }
}

fn parse_bind_args(args: &[String]) -> (IpAddr, u16) {
    let mut ip: IpAddr = "0.0.0.0".parse().unwrap();
    let mut port = 8080;
    let mut allow_public = false;
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--bind" if i + 1 < args.len() => { ip = args[i + 1].parse().unwrap_or_else(|_| { eprintln!("invalid --bind address"); std::process::exit(2) }); i += 1; }
            "--port" if i + 1 < args.len() => { port = args[i + 1].parse().unwrap_or_else(|_| { eprintln!("invalid --port"); std::process::exit(2) }); i += 1; }
            "--allow-public" => allow_public = true,
            value if !value.starts_with('-') => { port = value.parse().unwrap_or_else(|_| { eprintln!("invalid port"); std::process::exit(2) }); }
            _ => { eprintln!("usage: pocketshell-dev [--bind IP] [--port PORT] [--allow-public]"); std::process::exit(2); }
        }
        i += 1;
    }
    if !ip.is_loopback() && !is_private_or_link_local(ip) && !allow_public { eprintln!("public bind refused; pass --allow-public to override"); std::process::exit(2); }
    (ip, port)
}

fn is_private_or_link_local(ip: IpAddr) -> bool {
    match ip { IpAddr::V4(v) => v.is_private() || v.is_link_local(), IpAddr::V6(v) => v.is_unique_local() || v.is_unicast_link_local() }
}
fn local_addresses() -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(output) = std::process::Command::new("hostname").arg("-I").output() {
        for token in String::from_utf8_lossy(&output.stdout).split_whitespace() {
            if token.parse::<IpAddr>().is_ok() && token != "127.0.0.1" { out.push(token.to_string()); }
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
        if let Some(value) = lower.strip_prefix("content-length:") { content_length = value.trim().parse().unwrap_or(0); }
    }
    if content_length > 1024 * 1024 { return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "body too large")); }
    let mut body = buffer[header_end..].to_vec();
    while body.len() < content_length {
        let count = stream.read(&mut chunk)?;
        if count == 0 { break; }
        body.extend_from_slice(&chunk[..count]);
    }
    body.truncate(content_length);
    Ok(Request { method, path, body })
}
fn escape_json(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
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
    let mut peek = [0u8; 128];
    let n = stream.peek(&mut peek)?;
    if String::from_utf8_lossy(&peek[..n]).starts_with("GET /ws ") {
        return websocket(stream, state);
    }
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
                let history = shared.input.history.iter().map(|item| format!("\"{}\"", escape_json(item))).collect::<Vec<_>>().join(",");
                let phrases = shared.input.phrases.iter().map(|item| format!("\"{}\"", escape_json(item))).collect::<Vec<_>>().join(",");
                json.push_str(&format!(
                    ",\"view\":{},\"replay\":{},\"input\":{{\"entered\":{},\"previousView\":{},\"buffer\":\"{}\",\"layout\":\"{}\",\"function\":\"{}\",\"history\":[{}],\"phrases\":[{}]}}}}",
                    shared.view, shared.replay.meta_json(), shared.input.entered, shared.input.previous_view,
                    escape_json(&shared.input.buffer), escape_json(&shared.input.layout), escape_json(&shared.input.function), history, phrases
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
            if let Some(action) = command.strip_prefix("INPUT\t") {
                let mut shared = state.lock().unwrap();
                match action {
                    "ENTER" => {
                        if !shared.input.entered {
                            shared.input.previous_view = shared.view;
                            shared.input.entered = true;
                        }
                    }
                    "EXIT" => {
                        if shared.input.entered {
                            shared.input.entered = false;
                            shared.view = shared.input.previous_view;
                            if shared.view == REPLAY_VIEW {
                                shared.replay.repaint();
                            } else {
                                let view = shared.view;
                                shared.shell.command(&format!("REPAINT\t{view}"));
                                let frame = shared.shell.frame();
                                shared.pending.push_str(&frame);
                            }
                        }
                    }
                    "SUBMIT" => {
                        let value = shared.input.buffer.trim().to_string();
                        if !value.is_empty() {
                            shared.input.history.retain(|item| item != &value);
                            shared.input.history.insert(0, value);
                        }
                        shared.input.buffer.clear();
                    }
                    "CLEAR" => shared.input.buffer.clear(),
                    _ if action.starts_with("DELETE ") => {
                        let value = &action[7..];
                        shared.input.history.retain(|item| item != value);
                    }
                    _ if action.starts_with("FAVORITE ") => {
                        let value = action[9..].to_string();
                        shared.input.history.retain(|item| item != &value);
                        shared.input.history.insert(0, value);
                    }
                    _ if action.starts_with("PHRASE_ADD ") => {
                        let value = action[11..].to_string();
                        if !value.is_empty() && !shared.input.phrases.contains(&value) { shared.input.phrases.push(value); }
                    }
                    _ if action.starts_with("PHRASE_DELETE ") => {
                        let value = &action[14..];
                        shared.input.phrases.retain(|item| item != value);
                    }
                    _ if action.starts_with("BUFFER ") => shared.input.buffer = action[7..].to_string(),
                    _ if action.starts_with("LAYOUT ") => shared.input.layout = action[7..].to_string(),
                    _ if action.starts_with("FUNCTION ") => shared.input.function = action[9..].to_string(),
                    _ => {}
                }
                respond(&mut stream, "200 OK", "text/plain", b"ok");
                return Ok(());
            }
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
        ("GET", "/api/ota/status") => {
            let body=match ota::SlotManager::open(ota_root()).and_then(|m|m.state()){Ok(s)=>format!("{{\"ok\":true,\"simulation\":true,\"state\":{}}}",serde_json::to_string(&s).unwrap_or_else(|_|"null".into())),Err(e)=>format!("{{\"ok\":false,\"error\":\"{}\"}}",escape_json(&e))};respond(&mut stream,"200 OK","application/json",body.as_bytes());
        }
        ("GET", "/api/ota/log") => {let body=ota::SlotManager::open(ota_root()).map(|m|format!("{{\"lines\":[{}]}}",m.logs().lines().map(|l|format!("\"{}\"",escape_json(l))).collect::<Vec<_>>().join(","))).unwrap_or_else(|e|format!("{{\"error\":\"{}\"}}",escape_json(&e)));respond(&mut stream,"200 OK","application/json",body.as_bytes());}
        ("POST", "/api/ota/check") => {let body=ota::check_fixture(&ota_root(),&fixture_root(),&public_key_path());respond(&mut stream,"200 OK","application/json",body.as_bytes());}
        ("POST", "/api/ota/install") => {let body=ota::install_fixture(&ota_root(),&fixture_root(),&public_key_path());respond(&mut stream,"200 OK","application/json",body.as_bytes());}
        ("POST", "/api/ota/confirm") => {let body=match ota::SlotManager::open(ota_root()).and_then(|m|m.confirm(true)){Ok(s)=>format!("{{\"ok\":true,\"state\":{}}}",serde_json::to_string(&s).unwrap_or_else(|_|"null".into())),Err(e)=>format!("{{\"ok\":false,\"error\":\"{}\"}}",escape_json(&e))};respond(&mut stream,"200 OK","application/json",body.as_bytes());}
        ("POST", "/api/ota/boot-failure") => {let body=match ota::SlotManager::open(ota_root()).and_then(|m|m.boot_failure()){Ok(s)=>format!("{{\"ok\":true,\"state\":{}}}",serde_json::to_string(&s).unwrap_or_else(|_|"null".into())),Err(e)=>format!("{{\"ok\":false,\"error\":\"{}\"}}",escape_json(&e))};respond(&mut stream,"200 OK","application/json",body.as_bytes());}
        _ => respond(&mut stream, "404 Not Found", "text/plain", b"not found"),
    }
    Ok(())
}
fn websocket(stream: TcpStream, state: Arc<Mutex<Shared>>) -> std::io::Result<()> {
    use tungstenite::protocol::Message;
    let mut socket = match tungstenite::accept_hdr(stream, |req: &tungstenite::handshake::server::Request, response: tungstenite::handshake::server::Response| {
        let origin_ok = req.headers().get("origin").and_then(|v| v.to_str().ok()).map(|origin| origin.starts_with("http://") && !origin.contains('@')).unwrap_or(true);
        if !origin_ok { return Err(tungstenite::handshake::server::ErrorResponse::new(Some("origin denied".into()))); }
        Ok(response)
    }) {
        Ok(socket) => socket,
        Err(error) => { eprintln!("websocket handshake error: {error}"); return Err(std::io::Error::new(std::io::ErrorKind::ConnectionAborted, error.to_string())); }
    };
    socket.get_mut().set_read_timeout(Some(Duration::from_millis(100)))?;
    let mut seq = 0u64;
    let mut subscribed = false;
    let mut previous_state = String::new();
    let mut previous_logs = String::new();
    let mut previous_metrics = String::new();
    let mut last_uptime = u64::MAX;
    let mut frame_requested = true;
    loop {
        match socket.read() {
            Ok(Message::Text(text)) => {
                if text.len() > 8192 { send_ws(&mut socket, remote::message_error(seq, "message_too_large", "message exceeds 8 KiB"))?; continue; }
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(ClientMessage::Hello { version, .. }) if version == VERSION => subscribed = true,
                    Ok(ClientMessage::Hello { .. }) => send_ws(&mut socket, remote::message_error(seq, "version_mismatch", "supported version is 1"))?,
                    Ok(ClientMessage::Snapshot) => { subscribed = true; previous_state.clear(); previous_logs.clear(); frame_requested = true; }
                    Ok(ClientMessage::FrameMirror { enabled }) => send_ws(&mut socket, remote::envelope(seq, "frame_mirror_status", json!({"enabled":false,"reason": if enabled {"DRM capture backend unavailable in this build"} else {"disabled"}})))?,
                    Ok(ClientMessage::SwitchWorkspace { workspace }) if workspace < 6 => {
                        let mut shared = state.lock().unwrap(); shared.view = workspace;
                        if workspace < 5 { shared.shell.command(&format!("ACTIVATE\t{workspace}")); shared.shell.command(&format!("REPAINT\t{workspace}")); } else { shared.replay.restart(); shared.replay.playing = true; }
                        frame_requested = true; previous_state.clear();
                    }
                    Ok(ClientMessage::SwitchWorkspace { .. }) => send_ws(&mut socket, remote::message_error(seq, "invalid_workspace", "workspace must be 0..5"))?,
                    Ok(ClientMessage::Input { workspace, key, text }) => {
                        if let Err(message) = remote::validate_input(workspace, key.as_deref(), text.as_deref()) {
                            state.lock().unwrap().input_events += 1;
                            send_ws(&mut socket, remote::message_error(seq, "invalid_input", message))?;
                            continue;
                        }
                        let mut shared = state.lock().unwrap();
                        shared.input_events += 1;
                        if let Some(key) = key.as_deref() { if let Some(command) = remote::key_command(key) { shared.shell.command(&format!("{workspace}\tKEY {}", command.strip_prefix("KEY ").unwrap_or(command))); } }
                        if let Some(text) = text { shared.shell.command(&format!("{workspace}\tTEXT {text}")); }
                        shared.shell.command("LOG\tRemote input accepted");
                    }
                    Err(_) => send_ws(&mut socket, remote::message_error(seq, "invalid_message", "unknown or malformed message"))?,
                }
            }
            Ok(Message::Close(_)) => break,
            Ok(Message::Ping(data)) => { socket.send(Message::Pong(data)).map_err(ws_io)?; }
            Ok(_) => send_ws(&mut socket, remote::message_error(seq, "unsupported_frame", "text JSON frames required"))?,
            Err(tungstenite::Error::Io(error)) if error.kind() == std::io::ErrorKind::WouldBlock || error.kind() == std::io::ErrorKind::TimedOut => {},
            Err(tungstenite::Error::ConnectionClosed) | Err(tungstenite::Error::AlreadyClosed) => break,
            Err(_) => break,
        }
        if subscribed {
            let (snapshot, frame, logs, uptime) = {
                let mut shared = state.lock().unwrap();
                let frame = if previous_state.is_empty() || frame_requested { full_terminal_snapshot(&mut shared) } else { std::mem::take(&mut shared.pending) };
                if !frame.is_empty() { shared.ansi_events += 1; }
                let mut value: Value = serde_json::from_str(&shared.shell.inspector_json()).unwrap_or_else(|_| json!({}));
                if let Some(obj) = value.as_object_mut() { obj.insert("view".into(), json!(shared.view)); obj.insert("replay".into(), serde_json::from_str(&shared.replay.meta_json()).unwrap_or(json!({}))); obj.insert("inputEvents".into(), json!(shared.input_events)); obj.insert("ansiEvents".into(), json!(shared.ansi_events)); }
                (value, frame, serde_json::from_str::<Value>(&shared.shell.log_json()).unwrap_or(json!([])), shared.started.elapsed().as_secs())
            };
            if snapshot.to_string() != previous_state {
                seq += 1;
                send_ws(&mut socket, remote::envelope(seq, "workspace_state", json!({"state":snapshot,"full_snapshot":previous_state.is_empty()})))?;
                previous_state = snapshot.to_string();
            }
            if !frame.is_empty() {
                seq += 1;
                send_ws(&mut socket, remote::envelope(seq, "terminal_buffer", json!({"data":frame,"full_snapshot":frame_requested})))?;
                frame_requested = false;
            }
            if logs.to_string() != previous_logs {
                seq += 1;
                send_ws(&mut socket, remote::envelope(seq, "logs", json!({"entries":logs})))?;
                previous_logs = logs.to_string();
            }
            if uptime != last_uptime {
                seq += 1;
                send_ws(&mut socket, remote::envelope(seq, "runtime_state", json!({"uptime_s":uptime})))?;
                last_uptime = uptime;
            }
            let metrics=json!({"fps":snapshot["fps"],"frame_ms":snapshot["frameMs"],"workspace_count":snapshot["workspaces"].as_array().map_or(0,Vec::len),"ansi_events":snapshot["ansiEvents"],"input_events":snapshot["inputEvents"],"cpu_estimate":null,"memory_bytes":null,"network_bytes":null});
            if metrics.to_string() != previous_metrics {
                seq += 1;
                send_ws(&mut socket, remote::envelope(seq, "metrics", metrics.clone()))?;
                previous_metrics = metrics.to_string();
            }
        }
    }
    let _ = socket.close(None);
    Ok(())
}

fn send_ws(socket: &mut tungstenite::WebSocket<TcpStream>, value: Value) -> std::io::Result<()> {
    socket.send(tungstenite::protocol::Message::Text(value.to_string().into())).map_err(ws_io)
}

fn full_terminal_snapshot(shared: &mut Shared) -> String {
    if shared.view == REPLAY_VIEW {
        shared.replay.repaint();
        shared.replay.frame()
    } else {
        shared.shell.command(&format!("REPAINT\t{}", shared.view));
        let _ = shared.shell.frame();
        shared.shell.command(&format!("SNAP\t{}", shared.view))
    }
}

fn ws_io(error: tungstenite::Error) -> std::io::Error { std::io::Error::new(std::io::ErrorKind::ConnectionAborted, error.to_string()) }

fn ota_root()->std::path::PathBuf{std::env::var_os("POCKETSHELL_OTA_ROOT").map(Into::into).unwrap_or_else(||std::env::temp_dir().join("pocketshell-ota-sim"))}
fn fixture_root()->std::path::PathBuf{std::env::var_os("POCKETSHELL_OTA_FIXTURE").map(Into::into).unwrap_or_else(||std::path::PathBuf::from("fixtures/ota"))}
fn public_key_path()->std::path::PathBuf{std::env::var_os("POCKETSHELL_OTA_PUBLIC_KEY").map(Into::into).unwrap_or_else(||fixture_root().join("public-key.hex"))}
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
