use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use tar::Archive;

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateType { Workspace, Runtime, System, Firmware }

impl UpdateType {
    pub fn policy(self) -> (bool, bool, bool, bool) {
        match self {
            Self::Workspace => (false, false, false, false),
            Self::Runtime => (false, true, false, true),
            Self::System => (true, true, true, true),
            Self::Firmware => (true, true, true, true),
        }
    }
}

pub fn classify(paths: &[String]) -> Result<(UpdateType, Vec<String>), String> {
    if paths.is_empty() { return Err("changed must not be empty".into()); }
    let mut level = UpdateType::Workspace;
    let mut changed = BTreeSet::new();
    for path in paths {
        let p = safe_relative(path)?;
        let top = p.components().next().and_then(|c| c.as_os_str().to_str()).unwrap_or("");
        let kind = match top {
            "apps" | "assets" | "themes" | "configs" => UpdateType::Workspace,
            "runtime" | "host" | "renderer" | "ansi" | "terminal" | "pty" => UpdateType::Runtime,
            "rootfs" | "system" | "services" | "etc" | "usr" => UpdateType::System,
            "kernel" | "boot" | "firmware" | "drivers" => UpdateType::Firmware,
            _ if path == "boot.pocket" => UpdateType::Workspace,
            _ => return Err(format!("unclassified path: {path}")),
        };
        level = level.max(kind);
        changed.insert(path.clone());
    }
    Ok((level, changed.into_iter().collect()))
}

fn safe_relative(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if value.is_empty() || path.is_absolute() || value.contains('\\') || path.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(format!("unsafe package path: {value}"));
    }
    Ok(path.to_path_buf())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Manifest {
    pub version: u64,
    pub package: String,
    pub size: u64,
    pub sha256: String,
    pub signature: String,
    pub update_type: UpdateType,
    pub requires_reboot: bool,
    pub requires_slot_switch: bool,
    pub rollback_supported: bool,
    pub health_check_required: bool,
    pub changed: Vec<String>,
    pub changelog: String,
}

impl Manifest {
    pub fn validate(&self, trusted_key_hex: &str) -> Result<(), String> {
        if self.version == 0 || self.package != "package.tar" || self.size == 0 || self.sha256.len() != 64 || !self.sha256.bytes().all(|b| b.is_ascii_hexdigit()) { return Err("invalid manifest metadata".into()); }
        let (kind, changed) = classify(&self.changed)?;
        let policy = kind.policy();
        if self.update_type != kind || self.changed != changed || self.requires_reboot != policy.0 || self.requires_slot_switch != policy.1 || self.rollback_supported != policy.2 || self.health_check_required != policy.3 {
            return Err("manifest policy or changed paths do not match classifier".into());
        }
        let key = decode_hex(trusted_key_hex)?;
        let signature = decode_hex(&self.signature)?;
        if key.len() != 32 || signature.len() != 64 { return Err("invalid Ed25519 key or signature length".into()); }
        let canonical = self.canonical_signed_fields();
        let key_array: [u8;32] = key.try_into().map_err(|_| "invalid public key")?;
        let signature_array: [u8;64] = signature.try_into().map_err(|_| "invalid signature")?;
        ed25519_compact::PublicKey::from_slice(&key_array).map_err(|_| "invalid public key")?
            .verify(canonical.as_bytes(), &ed25519_compact::Signature::new(signature_array))
            .map_err(|_| "manifest signature verification failed".to_string())
    }

    fn canonical_signed_fields(&self) -> String {
        let changed = self.changed.join("\n");
        format!("pocketshell-ota-v1\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}\n{}", self.version, self.package, self.size, self.sha256.to_ascii_lowercase(), self.update_type.as_str(), self.requires_reboot, self.requires_slot_switch, self.rollback_supported, self.health_check_required, changed)
    }
}

impl UpdateType { fn as_str(self) -> &'static str { match self { Self::Workspace=>"workspace",Self::Runtime=>"runtime",Self::System=>"system",Self::Firmware=>"firmware" } } }
fn decode_hex(s: &str) -> Result<Vec<u8>, String> { if s.len()%2!=0 { return Err("invalid hex".into()); } (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i+2],16).map_err(|_| "invalid hex".into())).collect() }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SlotState { pub active: String, pub pending: Option<String>, pub pending_version: Option<u64>, pub boot_failures: u8, pub confirmed_version: u64, pub status: String }

pub trait OTAProvider { fn status(&self) -> &'static str; fn manifest(&self) -> Result<Manifest,String>; fn package(&self) -> Result<Vec<u8>,String>; }
pub struct LocalProvider { pub root: PathBuf }
impl OTAProvider for LocalProvider {
    fn status(&self)-> &'static str { "available" }
    fn manifest(&self)->Result<Manifest,String>{ serde_json::from_slice(&fs::read(self.root.join("manifest.json")).map_err(|e|e.to_string())?).map_err(|e|e.to_string()) }
    fn package(&self)->Result<Vec<u8>,String>{ fs::read(self.root.join("package.tar")).map_err(|e|e.to_string()) }
}
pub struct UnsupportedProvider(pub &'static str);
impl OTAProvider for UnsupportedProvider { fn status(&self)-> &'static str { "unsupported" } fn manifest(&self)->Result<Manifest,String>{Err(format!("{} provider is unsupported",self.0))} fn package(&self)->Result<Vec<u8>,String>{Err(format!("{} provider is unsupported",self.0))} }
pub struct HttpProvider;
impl OTAProvider for HttpProvider { fn status(&self)-> &'static str { "unsupported: HTTPS client and pinned signing-key configuration are not configured" } fn manifest(&self)->Result<Manifest,String>{Err(self.status().into())} fn package(&self)->Result<Vec<u8>,String>{Err(self.status().into())} }

pub struct SlotManager { root: PathBuf }
impl SlotManager {
    pub fn open(root: impl Into<PathBuf>) -> Result<Self,String> {
        let root=root.into(); fs::create_dir_all(&root).map_err(err)?;
        let state=root.join("state.json");
        if !state.exists() {
            for d in ["slot-a","slot-b","recovery","downloads","updates","logs"] { fs::create_dir(root.join(d)).map_err(err)?; }
            fs::write(root.join("slot-a/system.txt"), b"fixture system A\n").map_err(err)?;
            fs::write(root.join("slot-b/system.txt"), b"fixture system B\n").map_err(err)?;
            fs::write(root.join("recovery/recovery.txt"), b"immutable recovery fixture\n").map_err(err)?;
            persist(&root, &SlotState{active:"slot-a".into(),pending:None,pending_version:None,boot_failures:0,confirmed_version:1,status:"idle".into()})?;
        } else {
            for d in ["slot-a","slot-b","recovery","downloads","updates","logs"] {if !root.join(d).is_dir(){return Err(format!("existing simulator root missing expected directory: {d}"));}}
        }
        let manager=Self{root}; manager.recover_interrupted()?; Ok(manager)
    }
    pub fn state(&self)->Result<SlotState,String>{ serde_json::from_slice(&fs::read(self.root.join("state.json")).map_err(err)?).map_err(err) }
    pub fn logs(&self)->String { fs::read_to_string(self.root.join("logs/events.jsonl")).unwrap_or_default() }
    pub fn stage(&self, provider:&dyn OTAProvider, key:&str)->Result<SlotState,String>{
        let old=self.state()?; let manifest=provider.manifest()?; manifest.validate(key)?;
        if manifest.version<=old.confirmed_version { return Err("downgrade or duplicate version rejected".into()); }
        let bytes=provider.package()?;
        if bytes.len() as u64 != manifest.size || digest(&bytes)!=manifest.sha256.to_ascii_lowercase(){return Err("package size or SHA-256 mismatch".into());}
        let inactive=if old.active=="slot-a" {"slot-b"} else {"slot-a"};
        let recovery_hash=tree_hash(&self.root.join("recovery"))?;
        let temp=self.root.join(format!(".{inactive}.stage")); if temp.exists(){fs::remove_dir_all(&temp).map_err(err)?;} fs::create_dir(&temp).map_err(err)?;
        let install=(||{ extract_safe(&bytes,&temp)?; let actual:Vec<String>=list_files(&temp)?.into_iter().map(|p|p.to_string_lossy().replace('\\',"/")).collect(); if actual!=manifest.changed{return Err("package file list differs from signed changed list".into());} sync_tree(&temp)?; Ok(())})();
        if let Err(e)=install {let _=fs::remove_dir_all(&temp);return Err(e);}
        let target=self.root.join(inactive); let backup=self.root.join(format!(".{inactive}.old")); if backup.exists(){fs::remove_dir_all(&backup).map_err(err)?;} fs::rename(&target,&backup).map_err(err)?;
        if let Err(e)=fs::rename(&temp,&target){let _=fs::rename(&backup,&target);return Err(err(e));} sync_dir(&self.root)?;
        let mut next=old; next.pending=Some(inactive.into());next.pending_version=Some(manifest.version);next.boot_failures=0;next.status="pending".into();
        if let Err(e)=persist(&self.root,&next){let _=fs::remove_dir_all(&target);let _=fs::rename(&backup,&target);return Err(e);}
        let _=fs::remove_dir_all(backup); if tree_hash(&self.root.join("recovery"))?!=recovery_hash{return Err("recovery changed during stage".into());}
        self.log("stage", &format!("version={} slot={inactive} provider=local",manifest.version))?; Ok(next)
    }
    pub fn confirm(&self, healthy:bool)->Result<SlotState,String>{let mut s=self.state()?;let slot=s.pending.clone().ok_or("no pending update")?;if !healthy{return self.boot_failure();}s.active=slot;s.confirmed_version=s.pending_version.take().ok_or("pending version missing")?;s.pending=None;s.boot_failures=0;s.status="confirmed".into();persist(&self.root,&s)?;self.log("confirm","health=passed")?;Ok(s)}
    pub fn boot_failure(&self)->Result<SlotState,String>{let mut s=self.state()?;if s.pending.is_none(){return Err("no pending update".into());}s.boot_failures=s.boot_failures.saturating_add(1);if s.boot_failures>=3{s.pending=None;s.pending_version=None;s.status="rolled_back".into();}else{s.status="boot_failed".into();}persist(&self.root,&s)?;self.log("boot_failure",&format!("count={}",s.boot_failures))?;Ok(s)}
    pub fn rollback(&self)->Result<SlotState,String>{let mut s=self.state()?;if let Some(p)=s.pending.take(){let path=self.root.join(p);let _=fs::remove_dir_all(path);s.pending_version=None;s.status="rolled_back".into();}else{let other=if s.active=="slot-a"{"slot-b"}else{"slot-a"};s.active=other.into();s.confirmed_version=s.confirmed_version.saturating_sub(1);s.status="manual_rollback".into();}s.boot_failures=0;persist(&self.root,&s)?;self.log("rollback","requested")?;Ok(s)}
    fn recover_interrupted(&self)->Result<(),String>{let s=self.state()?;for slot in ["slot-a","slot-b"]{let target=self.root.join(slot);let backup=self.root.join(format!(".{slot}.old"));let temp=self.root.join(format!(".{slot}.stage"));if s.pending.as_deref()!=Some(slot){if backup.exists(){if target.exists(){fs::remove_dir_all(&target).map_err(err)?;}fs::rename(&backup,&target).map_err(err)?;}}else if backup.exists(){fs::remove_dir_all(&backup).map_err(err)?;}if temp.exists(){fs::remove_dir_all(temp).map_err(err)?;}} Ok(())}
    fn log(&self,event:&str,detail:&str)->Result<(),String>{let path=self.root.join("logs/events.jsonl");let mut f=OpenOptions::new().create(true).append(true).open(path).map_err(err)?;writeln!(f,"{{\"event\":\"{event}\",\"detail\":\"{}\"}}",detail.replace('"',"\\\"")).map_err(err)?;f.sync_all().map_err(err)}
}

fn persist(root:&Path,state:&SlotState)->Result<(),String>{let tmp=root.join("state.json.tmp");let mut f=File::create(&tmp).map_err(err)?;f.write_all(&serde_json::to_vec_pretty(state).map_err(err)?).map_err(err)?;f.sync_all().map_err(err)?;fs::rename(tmp,root.join("state.json")).map_err(err)?;sync_dir(root)}
fn sync_dir(p:&Path)->Result<(),String>{File::open(p).and_then(|f|f.sync_all()).map_err(err)}
fn sync_tree(p:&Path)->Result<(),String>{for x in list_files(p)?{File::open(p.join(x)).and_then(|f|f.sync_all()).map_err(err)?;}sync_dir(p)}
fn extract_safe(bytes:&[u8],dst:&Path)->Result<(),String>{let mut archive=Archive::new(bytes);for item in archive.entries().map_err(err)?{let mut entry=item.map_err(err)?;let path=entry.path().map_err(err)?.into_owned();safe_relative(path.to_str().ok_or("non-UTF8 package path")?)?;if !entry.header().entry_type().is_file(){return Err("package may contain regular files only".into());}let out=dst.join(path);if let Some(parent)=out.parent(){fs::create_dir_all(parent).map_err(err)?;}let mut f=OpenOptions::new().write(true).create_new(true).open(out).map_err(err)?;std::io::copy(&mut entry,&mut f).map_err(err)?;f.sync_all().map_err(err)?;}Ok(())}
fn list_files(root:&Path)->Result<Vec<PathBuf>,String>{fn walk(root:&Path,at:&Path,out:&mut Vec<PathBuf>)->Result<(),String>{for e in fs::read_dir(at).map_err(err)?{let e=e.map_err(err)?;let ft=e.file_type().map_err(err)?;if ft.is_symlink(){return Err("symlink in staged package".into());}if ft.is_dir(){walk(root,&e.path(),out)?;}else if ft.is_file(){out.push(e.path().strip_prefix(root).map_err(err)?.to_path_buf());}}Ok(())}let mut out=Vec::new();walk(root,root,&mut out)?;out.sort();Ok(out)}
fn digest(bytes:&[u8])->String{Sha256::digest(bytes).iter().map(|b|format!("{b:02x}")).collect()}
fn tree_hash(root:&Path)->Result<String,String>{let mut h=Sha256::new();for path in list_files(root)?{h.update(path.to_string_lossy().as_bytes());let mut f=File::open(root.join(path)).map_err(err)?;let mut buf=[0u8;8192];loop{let n=f.read(&mut buf).map_err(err)?;if n==0{break;}h.update(&buf[..n]);}}Ok(h.finalize().iter().map(|b|format!("{b:02x}")).collect())}
fn err(e:impl std::fmt::Display)->String{e.to_string()}

pub fn check_fixture(root:&Path,fixture:&Path,key_path:&Path)->String { match checked(root,fixture,key_path) {Ok((m,_))=>serde_json::json!({"ok":true,"provider":"local","version":m.version,"update_type":m.update_type,"changed":m.changed,"changelog":m.changelog,"providers":{"http":"unsupported: HTTPS transport is not configured","discovery":"unsupported","github":"unsupported","usb":"unsupported"}}).to_string(),Err(e)=>serde_json::json!({"ok":false,"error":e,"providers":{"http":"unsupported","discovery":"unsupported","github":"unsupported","usb":"unsupported"}}).to_string()} }
pub fn install_fixture(root:&Path,fixture:&Path,key_path:&Path)->String {let result=SlotManager::open(root).and_then(|m|{let p=LocalProvider{root:fixture.to_path_buf()};let key=fs::read_to_string(key_path).map_err(err)?;m.stage(&p,key.trim())});match result{Ok(s)=>serde_json::json!({"ok":true,"simulation":true,"state":s}).to_string(),Err(e)=>serde_json::json!({"ok":false,"error":e}).to_string()}}
fn checked(root:&Path,fixture:&Path,key_path:&Path)->Result<(Manifest,Vec<u8>),String>{let m=LocalProvider{root:fixture.to_path_buf()}.manifest()?;let key=fs::read_to_string(key_path).map_err(err)?;m.validate(key.trim())?;let b=LocalProvider{root:fixture.to_path_buf()}.package()?;if b.len() as u64!=m.size||digest(&b)!=m.sha256.to_ascii_lowercase(){return Err("package size or SHA-256 mismatch".into());}if m.version<=SlotManager::open(root)?.state()?.confirmed_version{return Err("downgrade or duplicate version rejected".into());}Ok((m,b))}
pub fn push_dry_run(root:&str,fixture:&str,key_path:&str)->Result<(),String>{let m=SlotManager::open(root)?;let p=LocalProvider{root:fixture.into()};let manifest=p.manifest()?;let key=fs::read_to_string(key_path).map_err(err)?;let staged=m.stage(&p,key.trim())?;println!("{{\"flow\":[\"build: skipped (host fixture)\",\"classify: {:?}\",\"package: verified {} bytes SHA-256 {}\",\"upload: localhost filesystem provider\",\"stage: {}\",\"handoff: simulated pending; no reboot executed\",\"health: awaiting explicit confirmation or boot failure\"],\"state\":{}}}",manifest.update_type,manifest.size,manifest.sha256,staged.pending.as_deref().unwrap_or("none"),serde_json::to_string(&staged).map_err(err)?);Ok(())}
