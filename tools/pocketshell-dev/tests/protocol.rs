//! Host integration test for the remote protocol.

use base64::Engine;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::Command;
use std::thread;
use std::time::Duration;

struct Ws(TcpStream);
impl Ws {
    fn connect(address: &str) -> Self {
        let mut stream = TcpStream::connect(address).unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
        let key = base64::engine::general_purpose::STANDARD.encode([5u8; 16]);
        stream.write_all(format!("GET /ws HTTP/1.1\r\nHost: {address}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").as_bytes()).unwrap();
        let mut response = Vec::new();
        let mut byte = [0u8;1];
        while !response.ends_with(b"\r\n\r\n") { stream.read_exact(&mut byte).unwrap(); response.push(byte[0]); }
        assert!(String::from_utf8_lossy(&response).contains("101 Switching Protocols"));
        Self(stream)
    }
    fn send(&mut self, json: &str) {
        let payload=json.as_bytes(); let mask=[11u8,37,91,143]; let mut frame=vec![0x81];
        if payload.len()<126 { frame.push(0x80|payload.len() as u8); }
        else if payload.len()<65536 { frame.push(0xfe); frame.extend_from_slice(&(payload.len() as u16).to_be_bytes()); }
        else { frame.push(0xff); frame.extend_from_slice(&(payload.len() as u64).to_be_bytes()); }
        frame.extend_from_slice(&mask); frame.extend(payload.iter().enumerate().map(|(i,b)|b^mask[i%4])); self.0.write_all(&frame).unwrap();
    }
    fn read(&mut self) -> serde_json::Value {
        let mut h=[0u8;2]; self.0.read_exact(&mut h).unwrap();
        let mut len=(h[1]&127) as u64;
        if len==126 {let mut b=[0u8;2];self.0.read_exact(&mut b).unwrap();len=u16::from_be_bytes(b) as u64;}
        else if len==127 {let mut b=[0u8;8];self.0.read_exact(&mut b).unwrap();len=u64::from_be_bytes(b);}
        let mut data=vec![0;len as usize];self.0.read_exact(&mut data).unwrap();serde_json::from_slice(&data).unwrap()
    }
}

#[test]
fn protocol_integration() {
    let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port=listener.local_addr().unwrap().port();drop(listener);
    let port_arg=port.to_string();
    let mut server=Command::new(env!("CARGO_BIN_EXE_pocketshell-dev")).args(["--bind","127.0.0.1","--port",&port_arg]).spawn().unwrap();
    thread::sleep(Duration::from_millis(400));
    let address=format!("127.0.0.1:{port}");
    let mut ws=Ws::connect(&address);
    ws.send(r#"{"type":"hello","version":1}"#);
    let mut types=Vec::new();let mut last=0;
    for _ in 0..6 {let msg=ws.read();assert_eq!(msg["version"],1);let seq=msg["seq"].as_u64().unwrap();assert!(seq>last);last=seq;types.push(msg["type"].as_str().unwrap().to_owned());}
    for kind in ["workspace_state","terminal_buffer","logs","runtime_state","metrics"] {assert!(types.contains(&kind.to_string()),"missing {kind}: {types:?}");}
    ws.send(r#"{"type":"switch_workspace","workspace":2}"#);
    let mut switched=false;
    for _ in 0..4 {let msg=ws.read();if msg["type"]=="workspace_state"&&msg["state"]["view"]==2{switched=true;break;}}
    assert!(switched,"workspace switch must synchronize");
    ws.send(r#"{"type":"input","workspace":0,"key":"UP"}"#);
    ws.send(r#"{"type":"input","workspace":0,"text":"echo hello\n"}"#);
    ws.send(r#"{"type":"input","workspace":99,"key":"UP"}"#);
    let mut rejected=false;
    for _ in 0..8 {let msg=ws.read();if msg["type"]=="error"&&msg["code"]=="invalid_input"{rejected=true;break;}}
    assert!(rejected,"invalid input must be rejected");
    drop(ws);server.kill().unwrap();
}
