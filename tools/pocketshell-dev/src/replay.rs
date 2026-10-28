//! Recording and replay for the PocketShell Developer Host.
//!
//! A recording is a sequence of timed PTY chunks:
//!   `<milliseconds>\t<hex bytes>\n`
//! Hex keeps escape sequences and UTF-8 intact through the file, so a replay
//! exercises the same parser path as the device.

use crate::pocketshell_terminal::Terminal;
use std::io::Write;

pub struct Replay {
    pub name: String,
    pub terminal: Terminal,
    chunks: Vec<(u64, Vec<u8>)>,
    playhead: usize,
    pub elapsed_ms: u64,
    pub duration_ms: u64,
    pub playing: bool,
    last_tick: std::time::Instant,
}

impl Replay {
    pub fn empty(rows: usize, cols: usize) -> Self {
        Replay {
            name: String::from("-"),
            terminal: Terminal::new(rows, cols),
            chunks: Vec::new(),
            playhead: 0,
            elapsed_ms: 0,
            duration_ms: 0,
            playing: false,
            last_tick: std::time::Instant::now(),
        }
    }

    pub fn load(path: &str, rows: usize, cols: usize) -> std::io::Result<Self> {
        let raw = std::fs::read_to_string(path)?;
        let mut chunks = Vec::new();
        let mut duration = 0u64;
        for line in raw.lines() {
            let Some((time, hex)) = line.split_once('\t') else { continue };
            let Ok(time) = time.parse::<u64>() else { continue };
            let mut bytes = Vec::with_capacity(hex.len() / 2);
            let digits = hex.as_bytes();
            let mut index = 0;
            while index + 1 < digits.len() {
                let pair = std::str::from_utf8(&digits[index..index + 2]).unwrap_or("00");
                bytes.push(u8::from_str_radix(pair, 16).unwrap_or(0));
                index += 2;
            }
            duration = duration.max(time);
            chunks.push((time, bytes));
        }
        let name = std::path::Path::new(path)
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string());
        Ok(Replay {
            name,
            terminal: Terminal::new(rows, cols),
            chunks,
            playhead: 0,
            elapsed_ms: 0,
            duration_ms: duration,
            playing: false,
            last_tick: std::time::Instant::now(),
        })
    }

    pub fn restart(&mut self) {
        self.terminal = Terminal::new(self.terminal.buffer.rows, self.terminal.buffer.cols);
        self.playhead = 0;
        self.elapsed_ms = 0;
        self.last_tick = std::time::Instant::now();
    }

    pub fn seek(&mut self, ms: u64) {
        self.restart();
        self.elapsed_ms = ms.min(self.duration_ms);
        while self.playhead < self.chunks.len() && self.chunks[self.playhead].0 <= self.elapsed_ms {
            let bytes = self.chunks[self.playhead].1.clone();
            self.terminal.feed(&bytes);
            self.playhead += 1;
        }
    }

    /// Advance the playhead by wall-clock time and feed whatever is due.
    pub fn tick(&mut self) {
        let now = std::time::Instant::now();
        let delta = now.duration_since(self.last_tick).as_millis() as u64;
        self.last_tick = now;
        if !self.playing {
            return;
        }
        self.elapsed_ms = (self.elapsed_ms + delta).min(self.duration_ms.max(1));
        while self.playhead < self.chunks.len() && self.chunks[self.playhead].0 <= self.elapsed_ms {
            let bytes = self.chunks[self.playhead].1.clone();
            self.terminal.feed(&bytes);
            self.playhead += 1;
        }
        if self.elapsed_ms >= self.duration_ms {
            self.playing = false;
        }
    }

    /// Mark the whole replay buffer dirty; a newly attached viewer has no cache.
    pub fn repaint(&mut self) {
        self.terminal.buffer.dirty.fill(true);
    }

    pub fn frame(&mut self) -> String {
        let rows = self.terminal.take_dirty_rows(24);
        let mut out = String::with_capacity(rows.len() + 32);
        out.push_str(&rows);
        out.push_str(&self.terminal.cursor_line());
        out
    }

    pub fn meta_json(&self) -> String {
        format!(
            "{{\"name\":\"{}\",\"chunks\":{},\"durationMs\":{},\"elapsedMs\":{},\"playing\":{},\"done\":{}}}",
            self.name.replace('"', ""),
            self.chunks.len(),
            self.duration_ms,
            self.elapsed_ms,
            self.playing,
            self.playhead >= self.chunks.len() && !self.playing
        )
    }
}

/// Spawn `command` on a PTY and write timed chunks to `output`.
pub fn record(output: &str, command: &[String], stop_after_ms: u64) -> std::io::Result<()> {
    let mut master: libc::c_int = 0;
    let slave: libc::c_int = 0;
    let mut size = libc::winsize { ws_row: 24, ws_col: 54, ws_xpixel: 0, ws_ypixel: 0 };
    let pid = unsafe { libc::forkpty(&mut master, std::ptr::null_mut(), std::ptr::null(), &mut size) };
    if pid < 0 {
        return Err(std::io::Error::last_os_error());
    }
    if pid == 0 {
        let cstrings: Vec<std::ffi::CString> = command
            .iter()
            .map(|arg| std::ffi::CString::new(arg.as_str()).unwrap_or_default())
            .collect();
        let mut pointers: Vec<*const libc::c_char> = cstrings.iter().map(|c| c.as_ptr()).collect();
        pointers.push(std::ptr::null());
        unsafe { libc::execvp(pointers[0], pointers.as_ptr()) };
        std::process::exit(127);
    }
    unsafe { libc::close(slave) };
    let _ = slave;

    let started = std::time::Instant::now();
    let mut file = std::io::BufWriter::new(std::fs::File::create(output)?);
    let mut buffer = [0u8; 4096];
    let mut total = 0u64;
    loop {
        let mut poll_fd = libc::pollfd { fd: master, events: libc::POLLIN, revents: 0 };
        let ready = unsafe { libc::poll(&mut poll_fd, 1, 60) };
        if ready > 0 && (poll_fd.revents & libc::POLLIN) != 0 {
            let count = unsafe { libc::read(master, buffer.as_mut_ptr().cast(), buffer.len()) };
            if count <= 0 {
                break;
            }
            let offset = started.elapsed().as_millis() as u64;
            let hex: String = buffer[..count as usize].iter().map(|b| format!("{b:02x}")).collect();
            writeln!(file, "{offset}\t{hex}")?;
            total += count as u64;
        }
        if stop_after_ms > 0 && started.elapsed().as_millis() as u64 > stop_after_ms {
            break;
        }
        if ready == 0 {
            let mut status = 0;
            let done = unsafe { libc::waitpid(pid, &mut status, libc::WNOHANG) };
            if done == pid {
                // Drain remaining output before closing.
                loop {
                    let count = unsafe { libc::read(master, buffer.as_mut_ptr().cast(), buffer.len()) };
                    if count <= 0 {
                        break;
                    }
                    let offset = started.elapsed().as_millis() as u64;
                    let hex: String = buffer[..count as usize].iter().map(|b| format!("{b:02x}")).collect();
                    writeln!(file, "{offset}\t{hex}")?;
                    total += count as u64;
                }
                break;
            }
        }
    }
    file.flush()?;
    unsafe { libc::close(master) };
    println!("recorded {total} bytes to {output}");
    Ok(())
}
