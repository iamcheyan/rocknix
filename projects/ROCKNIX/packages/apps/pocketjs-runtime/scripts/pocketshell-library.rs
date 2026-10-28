//! Bounded filesystem bridge for the PocketShell Library workspace.
use std::env;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};

const DEFAULT_ROOTS: [&str; 4] = ["/storage/docs", "/storage/books", "/storage/reports", "/storage/library"];
const DEFAULT_DATA: &str = "/storage/pocketshell/library";
pub const MAX_READ: usize = 16 * 1024;

fn roots() -> Vec<PathBuf> {
    env::var_os("POCKETSHELL_LIBRARY_ROOTS").map(|value| env::split_paths(&value).collect()).unwrap_or_else(|| DEFAULT_ROOTS.iter().map(PathBuf::from).collect())
}
fn data_dir() -> PathBuf {
    env::var_os("POCKETSHELL_LIBRARY_DATA_ROOT").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(DEFAULT_DATA))
}
fn allowed(path: &Path) -> bool {
    path.components().all(|part| !matches!(part, Component::ParentDir)) && roots().iter().any(|root| path.starts_with(root))
}
fn state_name(name: &str) -> bool {
    ["progress.json", "bookmarks.json", "history.json", "settings.json"].contains(&name)
}
fn escape(input: &str) -> String {
    input.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n").replace('\r', "\\r")
}

pub fn command(input: &str) -> String {
    let mut fields = input.splitn(4, '\t');
    let Some(op) = fields.next() else { return String::new() };
    match op {
        "LIST" => {
            let Some(root) = fields.next().map(PathBuf::from) else { return "[]".into() };
            if !allowed(&root) { return "[]".into() }
            let Ok(entries) = fs::read_dir(root) else { return "[]".into() };
            let values = entries.filter_map(Result::ok).filter_map(|entry| {
                let path = entry.path(); if !allowed(&path) { return None }
                let metadata = entry.metadata().ok()?;
                Some(format!("{{\"path\":\"{}\",\"directory\":{},\"size\":{}}}", escape(&path.to_string_lossy()), metadata.is_dir(), metadata.len()))
            }).collect::<Vec<_>>();
            format!("[{}]", values.join(","))
        }
        "STAT" => {
            let Some(path) = fields.next().map(PathBuf::from) else { return String::new() };
            if !allowed(&path) { return String::new() }
            match fs::metadata(path) { Ok(metadata) => format!("{{\"size\":{},\"directory\":{}}}", metadata.len(), metadata.is_dir()), Err(_) => String::new() }
        }
        "READ" => {
            let (Some(path), Some(offset), Some(length)) = (fields.next(), fields.next(), fields.next()) else { return String::new() };
            let path = Path::new(path); if !allowed(path) { return String::new() }
            let (Ok(offset), Ok(length)) = (offset.parse::<u64>(), length.parse::<usize>()) else { return String::new() };
            let Ok(mut file) = fs::File::open(path) else { return String::new() };
            let Ok(metadata) = file.metadata() else { return String::new() };
            if offset > metadata.len() { return String::new() }
            let start = offset.saturating_sub(3);
            if file.seek(SeekFrom::Start(start)).is_err() { return String::new() }
            let mut bytes = vec![0; length.min(MAX_READ).saturating_add((offset - start) as usize).saturating_add(4)];
            let Ok(count) = file.read(&mut bytes) else { return String::new() };
            bytes.truncate(count);
            let prefix = (offset - start) as usize;
            let valid_start = if start == 0 { 0 } else { (0..=prefix.min(bytes.len())).find(|index| *index == bytes.len() || (bytes[*index] & 0xc0) != 0x80).unwrap_or(prefix) };
            let text = String::from_utf8_lossy(&bytes[valid_start..]);
            let skip = String::from_utf8_lossy(&bytes[valid_start..prefix.min(bytes.len())]).chars().count();
            text.chars().skip(skip).take(length.min(MAX_READ)).collect()
        }
        "STATE_GET" => {
            let Some(name) = fields.next() else { return String::new() };
            if !state_name(name) { return String::new() }
            fs::read_to_string(data_dir().join(name)).unwrap_or_default()
        }
        "STATE_SET" => {
            let (Some(name), Some(value)) = (fields.next(), fields.next()) else { return String::new() };
            if !state_name(name) || value.len() > 1024 * 1024 { return String::new() }
            let directory = data_dir(); if fs::create_dir_all(&directory).is_err() { return String::new() }
            let destination = directory.join(name); let temporary = destination.with_extension("json.tmp");
            if fs::write(&temporary, value).is_err() || fs::rename(temporary, destination).is_err() { return String::new() }
            "ok".into()
        }
        _ => String::new(),
    }
}
