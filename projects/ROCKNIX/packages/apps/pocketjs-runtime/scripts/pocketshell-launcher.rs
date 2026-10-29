use std::process::{Command, Stdio};

/// Run an external command with a hard timeout. This runs on the guest's single
/// render thread, so it must never be able to block the UI: `pactl` on this
/// device blocks forever waiting for a PulseAudio socket, which froze the whole
/// launcher (black screen, dead input) until it was wrapped in `timeout`.
fn run(program: &str, args: &[&str]) -> Option<String> {
    let mut argv: Vec<&str> = vec!["2", program];
    argv.extend_from_slice(args);
    match Command::new("/usr/bin/timeout")
        .args(&argv)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
    {
        Ok(out) if out.status.success() => Some(String::from_utf8_lossy(&out.stdout).into_owned()),
        _ => None,
    }
}

const LANGUAGE_PATH: &str = "/storage/pocketshell/launcher/settings.json";

fn language_command(fields: &[&str]) -> String {
    match fields {
        ["LANGUAGE"] => std::fs::read_to_string(LANGUAGE_PATH)
            .ok()
            .and_then(|value| {
                let language = value.trim().trim_matches('"');
                ["ja", "zh", "en"].contains(&language).then(|| language.to_owned())
            })
            .unwrap_or_else(|| "ja".into()),
        ["LANGUAGE", language] if ["ja", "zh", "en"].contains(language) => {
            let path = std::path::Path::new(LANGUAGE_PATH);
            let Some(parent) = path.parent() else { return "Unable to save language".into() };
            if std::fs::create_dir_all(parent).is_err() { return "Unable to save language".into() }
            let temporary = parent.join("settings.json.new");
            if std::fs::write(&temporary, format!("\"{language}\"\n")).is_err()
                || std::fs::rename(&temporary, path).is_err() {
                let _ = std::fs::remove_file(temporary);
                return "Unable to save language".into();
            }
            (*language).into()
        }
        _ => "Invalid language".into(),
    }
}

pub fn command(value: &str) -> String {
    let fields: Vec<&str> = value.split('\t').collect();
    match fields.as_slice() {
        ["LANGUAGE"] | ["LANGUAGE", _] => language_command(&fields),
        ["STATE", "brightness"] => {
            if let Ok(entries) = std::fs::read_dir("/sys/class/backlight") {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let read = |name| std::fs::read_to_string(path.join(name)).ok()?.trim().parse::<u32>().ok();
                    if let (Some(current), Some(max)) = (read("brightness"), read("max_brightness")) {
                        if max > 0 { return (current * 100 / max).to_string(); }
                    }
                }
            }
            "unknown".into()
        }
        ["STATE", "volume"] => {
            for (program, args) in [("amixer", vec!["get", "Master"]), ("pactl", vec!["get-sink-volume", "@DEFAULT_SINK@"])] {
                let Some(text) = run(program, &args) else { continue };
                for word in text.split_whitespace() {
                    let token = word.trim_matches(|c| c == '[' || c == ']');
                    if let Some(n) = token.strip_suffix('%').and_then(|s| s.parse::<u32>().ok()) { return n.min(100).to_string(); }
                }
            }
            "unknown".into()
        }
        ["STATE", "wifi"] => match run("rocknix-settings", &["--command", "load", "--key", "wifi.enabled"]) {
            Some(text) if !text.trim().is_empty() => text.trim().to_string(),
            _ => "unknown".into(),
        },
        ["STATE", "bluetooth"] => std::fs::read_to_string("/storage/.config/system/configs/system.cfg")
            .ok()
            .and_then(|text| text.lines().find_map(|line| line.trim().strip_prefix("controllers.bluetooth.enabled=").map(str::to_string)))
            .unwrap_or_else(|| "unknown".into()),
        ["STATE", "timeout"] => {
            let content = std::fs::read_to_string("/storage/.config/pocketjs/runtime.conf").unwrap_or_default();
            let mut in_section = false;
            let configured = content.lines().find_map(|line| {
                let trimmed = line.trim();
                if trimmed.starts_with('[') && trimmed.ends_with(']') { in_section = trimmed == "[sleep]"; return None; }
                if in_section { return trimmed.split_once('=').filter(|(name, _)| name.trim() == "timeout").map(|(_, value)| value.trim().to_string()); }
                None
            });
            configured.unwrap_or_else(|| "30m".into())
        }
        ["STATE", key] if ["adbusb", "ssh", "avahi", "ftp", "http", "rsyncd", "samba", "syncthing", "telnet", concat!("pocket", "shell-dev")].contains(key) => {
            match run("rocknix-services", &["status", &format!("{key}.enabled")]) {
                Some(text) => text.trim().split('=').nth(1).unwrap_or("unknown").to_string(),
                None => "unknown".into(),
            }
        }
        ["LEVEL", "brightness"] => {
            if let Ok(entries) = std::fs::read_dir("/sys/class/backlight") {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let read = |name| std::fs::read_to_string(path.join(name)).ok()?.trim().parse::<u32>().ok();
                    if let (Some(current), Some(max)) = (read("brightness"), read("max_brightness")) {
                        if max > 0 { return (current * 100 / max).to_string(); }
                    }
                }
            }
            "unknown".into()
        }
        // Real battery percentage from the fuel gauge (0-100), or "unknown".
        ["LEVEL", "battery"] => {
            for name in ["battery", "BAT0", "BAT1", "rk817-battery", "cw2015-battery"] {
                let base = std::path::Path::new("/sys/class/power_supply").join(name);
                if let Ok(raw) = std::fs::read_to_string(base.join("capacity")) {
                    if let Ok(level) = raw.trim().parse::<u32>() {
                        return level.min(100).to_string();
                    }
                }
            }
            // Fall back to any supply that exposes a capacity.
            if let Ok(entries) = std::fs::read_dir("/sys/class/power_supply") {
                for entry in entries.flatten() {
                    if let Ok(raw) = std::fs::read_to_string(entry.path().join("capacity")) {
                        if let Ok(level) = raw.trim().parse::<u32>() {
                            return level.min(100).to_string();
                        }
                    }
                }
            }
            "unknown".into()
        }
        // First IPv4 address of an interface that is up and not loopback: "iface|addr" or "--".
        ["LEVEL", "ip"] => {
            if let Some(text) = run("ip", &["-o", "-4", "addr", "show"]) {
                for line in text.lines() {
                    let f: Vec<&str> = line.split_whitespace().collect();
                    // inet 192.168.1.5/24 brd ... scope global eth0
                    if f.len() < 4 || f.get(2) != Some(&"inet") { continue; }
                    let iface = *f.last().unwrap_or(&"");
                    if iface == "lo" { continue; }
                    if line.contains("scope host") { continue; }
                    let addr = f[3].split('/').next().unwrap_or("");
                    if addr.is_empty() { continue; }
                    return format!("{}|{}", iface, addr);
                }
            }
            "--".into()
        }
        // "on" when a wireless interface is up and associated, else "off".
        ["LEVEL", "wifi"] => {
            let associated = std::fs::read_dir("/sys/class/net")
                .map(|entries| {
                    entries.flatten().any(|e| {
                        let inet = e.path().join("wireless");
                        let oper = std::fs::read_to_string(e.path().join("operstate"))
                            .map(|s| s.trim() == "up")
                            .unwrap_or(false);
                        inet.exists() && oper
                    })
                })
                .unwrap_or(false);
            if associated { "on".into() } else { "off".into() }
        }
        ["LEVEL", "volume"] => {
            for (program, args) in [("amixer", vec!["get", "Master"]), ("pactl", vec!["get-sink-volume", "@DEFAULT_SINK@"])] {
                let Some(text) = run(program, &args) else { continue };
                for word in text.split_whitespace() {
                    let token = word.trim_matches(|c| c == '[' || c == ']');
                    if let Some(n) = token.strip_suffix('%').and_then(|s| s.parse::<u32>().ok()) { return n.min(100).to_string(); }
                }
            }
            "unknown".into()
        }
        ["LAUNCH", app] if ["disk", "xmplayer"].contains(app) => {
            match run("systemd-run", &["--unit=pocketjs-launcher", "--collect", "--no-block", "/usr/bin/pocketjs-native-launch", app]) {
                Some(_) => "Opening application".into(),
                None => "Unable to start application".into(),
            }
        }
        ["CONTROL", control, value] if ["volume", "brightness", "wifi", "bluetooth"].contains(control) => {
            let valid = if ["volume", "brightness"].contains(control) {
                value.parse::<u8>().is_ok_and(|n| n <= 100)
            } else { ["on", "off"].contains(value) };
            if !valid { return "Invalid setting".into(); }
            match run("heya-control", &[control, value]) {
                Some(_) => "Setting updated".into(),
                None => "Setting failed".into(),
            }
        }
        ["SERVICE", key] if ["adbd.enabled", "adbusb.enabled", "ssh.enabled", "avahi.enabled", "ftp.enabled", "http.enabled", "rsyncd.enabled", "samba.enabled", "syncthing.enabled", "telnet.enabled", "pocketshell-dev.enabled"].contains(key) => {
            match run("rocknix-services", &["toggle", key]) {
                Some(text) => text.trim().to_string(),
                None => "Service change failed".into(),
            }
        }
        ["SLEEP", timeout] if ["never", "10s", "30s", "1m", "5m", "15m", "30m", "1h"].contains(timeout) => {
            let path = std::path::Path::new("/storage/.config/pocketjs/runtime.conf");
            let mut content = std::fs::read_to_string(path).unwrap_or_default();
            let mut in_section = false;
            let mut replaced = false;
            let mut new_lines: Vec<String> = Vec::new();
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('[') && trimmed.ends_with(']') {
                    in_section = trimmed == "[sleep]";
                    new_lines.push(line.to_string());
                    continue;
                }
                if in_section && trimmed.starts_with("timeout") {
                    new_lines.push(format!("timeout = {}", timeout));
                    replaced = true;
                } else {
                    new_lines.push(line.to_string());
                }
            }
            if !replaced {
                if !content.ends_with('\n') { new_lines.push(String::new()); }
                if !in_section {
                    new_lines.push("[sleep]".to_string());
                }
                new_lines.push(format!("timeout = {}", timeout));
            }
            match std::fs::write(path, new_lines.join("\n") + "\n") {
                Ok(_) => {
                    // Reload the daemon if it is running.
                    let _ = run("systemctl", &["try-restart", "pocketjs-sleep.service"]);
                    format!("Screen timeout set to {}", timeout)
                }
                Err(_) => "Failed to save timeout".into(),
            }
        }
        _ => "Unknown launcher action".into(),
    }
}
