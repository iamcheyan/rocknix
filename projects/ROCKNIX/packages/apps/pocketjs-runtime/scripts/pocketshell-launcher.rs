use std::process::{Command, Stdio};

pub fn command(value: &str) -> String {
    let fields: Vec<&str> = value.split('\t').collect();
    match fields.as_slice() {
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
        ["LEVEL", "volume"] => {
            for (program, args) in [("pactl", vec!["get-sink-volume", "@DEFAULT_SINK@"]), ("amixer", vec!["get", "Master"])] {
                if let Ok(out) = Command::new(program).args(args).output() {
                    for word in String::from_utf8_lossy(&out.stdout).split_whitespace() {
                        let token = word.trim_matches(|c| c == '[' || c == ']');
                        if let Some(n) = token.strip_suffix('%').and_then(|s| s.parse::<u32>().ok()) { return n.min(100).to_string(); }
                    }
                }
            }
            "unknown".into()
        }
        ["LAUNCH", app] if ["disk", "xmplayer"].contains(app) => {
            match Command::new("systemd-run")
                .args(["--unit=pocketjs-launcher", "--collect", "--no-block", "/usr/bin/pocketjs-native-launch", app])
                .stdout(Stdio::null()).stderr(Stdio::null()).status() {
                Ok(status) if status.success() => "Opening application".into(),
                _ => "Unable to start application".into(),
            }
        }
        ["CONTROL", control, value] if ["volume", "brightness", "wifi", "bluetooth"].contains(control) => {
            let valid = if ["volume", "brightness"].contains(control) {
                value.parse::<u8>().is_ok_and(|n| n <= 100)
            } else { ["on", "off"].contains(value) };
            if !valid { return "Invalid setting".into(); }
            match Command::new("heya-control").args([control, value]).output() {
                Ok(out) if out.status.success() => "Setting updated".into(),
                _ => "Setting failed".into(),
            }
        }
        ["SERVICE", key] if ["adbd.enabled", "adbusb.enabled", "ssh.enabled", "avahi.enabled", "ftp.enabled", "http.enabled", "rsyncd.enabled", "samba.enabled", "syncthing.enabled", "telnet.enabled", "pocketshell-dev.enabled"].contains(key) => {
            match Command::new("rocknix-services").args(["toggle", key]).output() {
                Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).trim().to_string(),
                _ => "Service change failed".into(),
            }
        }
        ["SLEEP", timeout] => {
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
                if !content.ends_with('\\n') { new_lines.push(String::new()); }
                if !in_section {
                    new_lines.push("[sleep]".to_string());
                }
                new_lines.push(format!("timeout = {}", timeout));
            }
            match std::fs::write(path, new_lines.join("\\n") + "\\n") {
                Ok(_) => {
                    // Reload the daemon if it is running.
                    let _ = Command::new("systemctl").args(["try-restart", "pocketjs-sleep.service"]).output();
                    format!("Screen timeout set to {}", timeout)
                }
                Err(_) => "Failed to save timeout".into(),
            }
        }
        _ => "Unknown launcher action".into(),
    }
}
