use std::io::{self, Read};
use std::time::Instant;

use serde_json::{json, Value};
use tiny_http::{Header, Request, Response, StatusCode};

/// Zero-fill reader — generates zeros on the fly, no heap allocation.
struct ZeroReader {
    remaining: usize,
}

impl Read for ZeroReader {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if self.remaining == 0 {
            return Ok(0);
        }
        let n = buf.len().min(self.remaining);
        buf[..n].fill(0);
        self.remaining -= n;
        Ok(n)
    }
}

/// GET /api/lan/ping — empty 200 for RTT measurement.
pub fn ping() -> (u16, Value) {
    (200, json!({"ok": true}))
}

/// GET /api/lan/download?size=N — streams N bytes of zeros.
/// Called before body is read; responds directly on the request.
pub fn download(request: Request, size: usize, extra_headers: Vec<Header>) {
    let reader = ZeroReader { remaining: size };
    let mut headers = vec![Header::from_bytes("Content-Type", "application/octet-stream").unwrap()];
    headers.extend(extra_headers);
    let response = Response::new(StatusCode(200), headers, reader, Some(size), None);
    let _ = request.respond(response);
}

/// POST /api/lan/upload — reads and discards body, returns measured throughput.
pub fn upload(request: &mut Request) -> (u16, Value) {
    let start = Instant::now();
    let mut buf = [0u8; 131072]; // 128 KB for high-throughput USB-C
    let mut total: u64 = 0;
    let reader = request.as_reader();
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => total += n as u64,
            Err(_) => break,
        }
    }
    let elapsed = start.elapsed().as_secs_f64();
    let mbps = if elapsed > 0.0 {
        (total as f64 * 8.0) / (elapsed * 1_000_000.0)
    } else {
        0.0
    };
    let round2 = |v: f64| (v * 100.0).round() / 100.0;
    (
        200,
        json!({
            "ok": true,
            "data": {
                "bytes": total,
                "duration_secs": round2(elapsed),
                "mbps": round2(mbps),
            }
        }),
    )
}
