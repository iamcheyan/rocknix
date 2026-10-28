#!/usr/bin/env python3
"""Patch the exact PocketJS Linux host to own PocketShell PTY sessions."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
guest = root / "engine/guest-rquickjs/src/lib.rs"
source = guest.read_text()

def replace(path, old, new):
    text = path.read_text()
    if new in text: return
    if old not in text: raise SystemExit(f"PocketShell patch anchor missing in {path.name}")
    path.write_text(text.replace(old, new, 1))

replace(guest,
"use rquickjs::{\n    function::Rest, Array, ArrayBuffer, Coerced, Context, Ctx, Exception, FromJs, Function, IntoJs,\n    Object, Runtime, Value,\n};",
"use rquickjs::{\n    function::Rest, Array, ArrayBuffer, Coerced, Context, Ctx, Exception, FromJs, Function, IntoJs,\n    Object, Runtime, Value,\n};\nuse std::os::fd::FromRawFd;\nuse std::os::unix::process::CommandExt;\nuse std::process::{Child, Command, Stdio};\nuse std::sync::{Arc, Mutex};")
replace(guest, "    last_error: Option<String>,\n}", "    last_error: Option<String>,\n    pocketshell: Arc<Mutex<PocketShell>>,\n}")
replace(guest, "            last_error: None,\n        }", "            last_error: None,\n            pocketshell: Arc::new(Mutex::new(PocketShell::new())),\n        }")
replace(guest, "        let result = context.with(|ctx| mount_ui(&ctx, ops, environment, self.profile));", """        let shell = self.pocketshell.clone();
        let result: rquickjs::Result<()> = context.with(|ctx| {
            mount_ui(&ctx, ops, environment, self.profile)?;
            let ui: Object = ctx.globals().get("ui")?;
            let command_shell = shell.clone();
            ui.set("__pocketshell", Function::new(ctx.clone(), move |command: String| {
                command_shell.lock().map(|mut state| state.command(&command)).unwrap_or_default()
            })?)?;
            let frame_shell = shell.clone();
            ctx.globals().set("__pocketshellFrame", Function::new(ctx.clone(), move || {
                frame_shell.lock().map(|mut state| state.frame()).unwrap_or_default()
            })?)?;
            Ok(())
        });""")
replace(guest, "        let result = context.with(|ctx| call_frame(&ctx, frame));", """        let shell = self.pocketshell.clone();
        let result: rquickjs::Result<()> = context.with(|ctx| {
            let output = shell.lock().map(|mut state| state.frame()).unwrap_or_default();
            if !output.is_empty() {
                let global: Object = ctx.globals().get("globalThis")?;
                global.set("__pocketshellOutput", output)?;
            }
            call_frame(&ctx, frame)
        });""")
source = guest.read_text()

cargo = root / "engine/guest-rquickjs/Cargo.toml"
cargo_text = cargo.read_text()
if "libc = \"0.2.191\"" not in cargo_text:
    cargo_text = cargo_text.replace("rquickjs = \"0.12\"", "rquickjs = \"0.12\"\nlibc = \"0.2.191\"", 1)
    cargo.write_text(cargo_text)

if "struct PocketShell" not in source:
    source += '''

struct PtySession { master: i32, child: Child, pending: Vec<u8>, exited_reported: bool }
struct PocketShell { sessions: Vec<Option<PtySession>>, log: Vec<String> }
impl PocketShell {
    fn new() -> Self { Self { sessions: (0..5).map(|_| None).collect(), log: Vec::new() } }
    fn record(&mut self, message: String) { self.log.push(message); if self.log.len() > 120 { self.log.remove(0); } }
    fn start(&mut self, id: usize) {
        if let Some(mut session) = self.sessions.get_mut(id).and_then(Option::take) {
            if session.child.try_wait().ok().flatten().is_none() { self.sessions[id] = Some(session); return; }
            unsafe { libc::close(session.master); }
            self.record(format!("Process Exited WS{}", id + 1));
        }
        unsafe {
            let mut master: libc::c_int = -1; let mut slave: libc::c_int = -1;
            let size = libc::winsize { ws_row: 22, ws_col: 58, ws_xpixel: 680, ws_ypixel: 390 };
            if libc::openpty(&mut master, &mut slave, std::ptr::null_mut(), std::ptr::null(), &size) != 0 { self.record("PTY allocation failed".to_owned()); return; }
            let (program, args): (&str, &[&str]) = match id {
                0 => ("/bin/sh", &[]),
                1 => if std::path::Path::new("/usr/bin/ranger").exists() { ("/usr/bin/ranger", &[]) } else if std::path::Path::new("/usr/bin/lf").exists() { ("/usr/bin/lf", &[]) } else { ("/bin/sh", &[]) },
                2 => if std::path::Path::new("/usr/bin/vim").exists() { ("/usr/bin/vim", &[]) } else { ("/bin/vi", &[]) },
                3 => if std::path::Path::new("/usr/bin/htop").exists() { ("/usr/bin/htop", &[]) } else { ("/usr/bin/top", &[]) },
                _ => ("/bin/sh", &[]),
            };
            let stdin_fd = libc::dup(slave); let stdout_fd = libc::dup(slave); let stderr_fd = libc::dup(slave);
            if stdin_fd < 0 || stdout_fd < 0 || stderr_fd < 0 {
                for fd in [stdin_fd, stdout_fd, stderr_fd] { if fd >= 0 { libc::close(fd); } }
                libc::close(master); libc::close(slave); self.record("PTY descriptor duplication failed".to_owned()); return;
            }
            let mut command = Command::new(program); command.args(args).env("TERM", "xterm").env("LANG", "C.UTF-8");
            command.stdin(Stdio::from(std::fs::File::from_raw_fd(stdin_fd)));
            command.stdout(Stdio::from(std::fs::File::from_raw_fd(stdout_fd))).stderr(Stdio::from(std::fs::File::from_raw_fd(stderr_fd)));
            command.pre_exec(move || { if libc::setsid() < 0 { return Err(std::io::Error::last_os_error()); } if libc::ioctl(0, libc::TIOCSCTTY, 0) < 0 { return Err(std::io::Error::last_os_error()); } Ok(()) });
            match command.spawn() {
                Ok(child) => { libc::close(slave); let flags = libc::fcntl(master, libc::F_GETFL); libc::fcntl(master, libc::F_SETFL, flags | libc::O_NONBLOCK); self.sessions[id] = Some(PtySession { master, child, pending: Vec::new(), exited_reported: false }); self.record(format!("Workspace Created WS{}; Process Started", id + 1)); }
                Err(error) => { libc::close(master); libc::close(slave); self.record(format!("Process Start Failed WS{}: {error}", id + 1)); }
            }
        }
    }
    fn command(&mut self, command: &str) -> String {
        if let Some(message) = command.strip_prefix("LOG\\t") { self.record(message.to_owned()); return String::new(); }
        let mut fields = command.splitn(2, '\\t'); let id = fields.next().and_then(|value| value.parse::<usize>().ok()).unwrap_or(99); let action = fields.next().unwrap_or("");
        if id >= 5 { return String::new(); }
        if action == "START" { self.start(id); return format!("S\\t{}\\tREADY", id); }
        if id == 4 { return self.log.join("\\n"); }
        self.start(id);
        let Some(session) = self.sessions[id].as_mut() else { return String::new(); };
        if action == "SNAP" { return String::new(); }
        let bytes: &[u8] = if let Some(text) = action.strip_prefix("TEXT ") { text.as_bytes() } else if let Some(key) = action.strip_prefix("KEY ") { match key { "ENTER"=>b"\\r", "BACKSPACE"=>b"\\x7f", "UP"=>b"\\x1b[A", "DOWN"=>b"\\x1b[B", "LEFT"=>b"\\x1b[D", "RIGHT"=>b"\\x1b[C", "TAB"=>b"\\t", "ESC"=>b"\\x1b", "CTRL_C"=>b"\\x03", "CTRL_D"=>b"\\x04", _=>b"" } } else { b"" };
        unsafe { libc::write(session.master, bytes.as_ptr().cast(), bytes.len()); }
        String::new()
    }
    fn frame(&mut self) -> String {
        let mut exited = Vec::new();
        for (id, slot) in self.sessions.iter_mut().enumerate() {
            if let Some(session) = slot.as_mut() {
                if !session.exited_reported && session.child.try_wait().ok().flatten().is_some() {
                    session.exited_reported = true;
                    exited.push(id);
                }
            }
        }
        for id in exited { self.record(format!("Process Exited WS{}", id + 1)); }
        let mut output = String::new();
        for (id, slot) in self.sessions.iter_mut().enumerate() {
            let Some(session) = slot.as_mut() else { continue; };
            let mut bytes = [0u8; 2048];
            loop { let count = unsafe { libc::read(session.master, bytes.as_mut_ptr().cast(), bytes.len()) }; if count <= 0 { break; } session.pending.extend_from_slice(&bytes[..count as usize]); }
            if !session.pending.is_empty() {
                let pending = std::mem::take(&mut session.pending);
                let text: String = String::from_utf8_lossy(&pending).chars().flat_map(char::escape_default).collect();
                output.push_str(&format!("O\\t{}\\t{}\\n", id, text));
            }
        }
        output
    }
}
'''
    guest.write_text(source)

main = root / "programs/linux-kms/src/main.rs"
text = main.read_text()
main.write_text(text)
