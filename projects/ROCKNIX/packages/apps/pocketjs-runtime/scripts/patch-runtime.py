#!/usr/bin/env python3
"""Add the small native action bridge needed by the ROCKNIX KMS launcher."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
guest = root / "engine/guest-rquickjs/src/lib.rs"
source = guest.read_text()
if "with_koro_action_sink" not in source:
    source = source.replace("use rquickjs::{", "use std::sync::Arc;\nuse rquickjs::{", 1)
    source = source.replace("    last_error: Option<String>,\n}", "    last_error: Option<String>,\n    koro_action_sink: Option<Arc<dyn Fn(String) + Send + Sync>>,\n}", 1)
    source = source.replace("            last_error: None,\n        }", "            last_error: None,\n            koro_action_sink: None,\n        }", 1)
    marker = "    pub fn last_error(&self) -> Option<&str> {"
    source = source.replace(marker, "    pub fn with_koro_action_sink(mut self, sink: Arc<dyn Fn(String) + Send + Sync>) -> Self {\n        self.koro_action_sink = Some(sink);\n        self\n    }\n" + marker, 1)
    old = "        let result = context.with(|ctx| mount_ui(&ctx, ops, environment, self.profile));"
    new = """        let sink = self.koro_action_sink.clone();
        let result: rquickjs::Result<()> = context.with(|ctx| {
            mount_ui(&ctx, ops, environment, self.profile)?;
            if let Some(sink) = sink {
                let ui: Object = ctx.globals().get("ui")?;
                ui.set("__koroAction", Function::new(ctx.clone(), move |action: String| {
                    if action.len() > 128 || !action.bytes().all(|b| b.is_ascii_alphanumeric() || b == b':' || b == b'-') {
                        return false;
                    }
                    sink(action);
                    true
                })?)?;
                ui.set("__koroTheme", Function::new(ctx.clone(), || {
                    std::fs::read_to_string("/storage/pocketjs/theme")
                        .ok().map(|value| value.trim().to_owned())
                        .filter(|value| value == "dark" || value == "light")
                        .unwrap_or_else(|| "dark".to_owned())
                })?)?;
            }
            Ok(())
        });"""
    if old not in source:
        raise SystemExit("RquickjsGuest initialization site not found")
    guest.write_text(source.replace(old, new, 1))

    main = root / "programs/linux-kms/src/main.rs"
    source = main.read_text()
    source = source.replace("    sync::atomic::{AtomicBool, Ordering},\n};", "    sync::{atomic::{AtomicBool, Ordering}, mpsc, Arc},\n    process::Command,\n};", 1)
    old = "    runtime\n        .set_guest(Box::new(RquickjsGuest::default()))\n        .map_err(error)?;"
    new = """    let (action_tx, action_rx) = mpsc::channel::<String>();
    let action_sink = Arc::new(move |action| { let _ = action_tx.send(action); });
    runtime
        .set_guest(Box::new(RquickjsGuest::default().with_koro_action_sink(action_sink)))
        .map_err(error)?;"""
    if old not in source:
        raise SystemExit("Linux KMS guest installation site not found")
    source = source.replace(old, new, 1)
    old = "        runtime.tick().map_err(error)?;\n        frames += 1;"
    new = """        runtime.tick().map_err(error)?;
        frames += 1;
        if let Ok(action) = action_rx.try_recv() {
            if let Some(app) = action.strip_prefix("launch:") {
                let _ = Command::new("systemd-run").args([
                    "--quiet", "--no-block", "--collect", "--unit=pocketjs-native-launch",
                    "/usr/bin/pocketjs-native-launch", app,
                ]).spawn();
                break;
            }
            if let Some(service) = action.strip_prefix("service:") {
                let mut parts = service.split(':');
                if let (Some(key), Some(verb)) = (parts.next(), parts.next()) {
                    if parts.next().is_none() && ["adbd", "avahi", "ftp", "http", "rsyncd", "samba", "syncthing", "telnet", "ssh"].contains(&key) && ["start", "stop", "toggle"].contains(&verb) {
                        let _ = Command::new("/usr/bin/rocknix-services").args([verb, key]).status();
                    }
                }
            }
            if let Some(theme) = action.strip_prefix("theme:") {
                if ["dark", "light"].contains(&theme) {
                    let _ = std::fs::write("/storage/pocketjs/theme", theme);
                }
            }
        }"""
    if old not in source:
        raise SystemExit("Linux KMS frame loop site not found")
    main.write_text(source.replace(old, new, 1))
