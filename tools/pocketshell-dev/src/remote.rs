use serde::Deserialize;
use serde_json::{json, Value};

pub const VERSION: u16 = 1;
pub const MAX_TEXT_BYTES: usize = 4096;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Hello { version: u16 },
    Input { workspace: usize, key: Option<String>, text: Option<String> },
    SwitchWorkspace { workspace: usize },
    Snapshot,
    FrameMirror { enabled: bool },
}


pub fn envelope(seq: u64, kind: &str, payload: Value) -> Value {
    let mut value = json!({"version": VERSION, "seq": seq, "type": kind});
    if let (Some(dst), Some(src)) = (value.as_object_mut(), payload.as_object()) {
        dst.extend(src.clone());
    }
    value
}

pub fn validate_input(workspace: usize, key: Option<&str>, text: Option<&str>) -> Result<(), &'static str> {
    if workspace >= 5 { return Err("workspace must be 0..4"); }
    match (key, text) {
        (Some(key), None) if ["UP", "DOWN", "LEFT", "RIGHT", "ENTER", "ESC", "TAB", "BACKSPACE", "PGUP", "PGDN", "HOME", "END", "CTRL_C", "CTRL_D", "CTRL_L", "X", "Y", "L", "R", "L1", "R1", "START", "SELECT"].contains(&key) => Ok(()),
        (None, Some(text)) if !text.is_empty() && text.len() <= MAX_TEXT_BYTES && !text.chars().any(char::is_control) => Ok(()),
        _ => Err("invalid or oversized input"),
    }
}

pub fn key_command(key: &str) -> Option<&'static str> {
    Some(match key {
        "UP" => "UP", "DOWN" => "DOWN", "LEFT" => "LEFT", "RIGHT" => "RIGHT",
        "ENTER" => "ENTER", "ESC" => "ESC", "TAB" => "TAB", "BACKSPACE" => "BACKSPACE",
        "PGUP" => "PGUP", "PGDN" => "PGDN", "HOME" => "HOME", "END" => "END",
        "CTRL_C" => "CTRL_C", "CTRL_D" => "CTRL_D", "CTRL_L" => "CTRL_L",
        "X" => "KEY X", "Y" => "KEY Y", "L" => "KEY L", "R" => "KEY R", "L1" => "KEY L1", "R1" => "KEY R1", "START" => "KEY START", "SELECT" => "KEY SELECT", _ => return None,
    })
}

pub fn message_error(seq: u64, code: &str, message: &str) -> Value {
    envelope(seq, "error", json!({"code": code, "message": message}))
}
