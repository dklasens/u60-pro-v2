use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let port_path = args.get(1).map(|s| s.as_str()).unwrap_or("/dev/at_mdm0");
    let command = args.get(2).map(|s| s.as_str()).unwrap_or("AT");

    eprintln!("[at_test] Opening {port_path}...");

    let mut rd = match OpenOptions::new().read(true).open(port_path) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[at_test] FAIL open read: {e}");
            std::process::exit(1);
        }
    };

    let mut wr = match OpenOptions::new().write(true).open(port_path) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[at_test] FAIL open write: {e}");
            std::process::exit(1);
        }
    };

    let buffer: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));

    let buf_clone = buffer.clone();
    let stop_clone = stop.clone();
    std::thread::spawn(move || {
        let mut tmp = [0u8; 4096];
        loop {
            if stop_clone.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
            match rd.read(&mut tmp) {
                Ok(0) => {}
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&tmp[..n]).to_string();
                    let mut buf = buf_clone.lock().unwrap();
                    buf.push_str(&chunk);
                }
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(10));
                }
            }
        }
    });

    std::thread::sleep(Duration::from_millis(50));

    eprintln!("[at_test] Sending: {command}");
    if let Err(e) = wr.write_all(format!("{command}\r\n").as_bytes()) {
        eprintln!("[at_test] FAIL write: {e}");
        stop.store(true, std::sync::atomic::Ordering::Relaxed);
        std::process::exit(1);
    }

    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    loop {
        if std::time::Instant::now() >= deadline {
            break;
        }
        let buf = buffer.lock().unwrap();
        if buf.contains("OK") || buf.contains("ERROR") {
            break;
        }
        drop(buf);
        std::thread::sleep(Duration::from_millis(50));
    }

    stop.store(true, std::sync::atomic::Ordering::Relaxed);
    std::thread::sleep(Duration::from_millis(50));

    let response = buffer.lock().unwrap().clone();
    println!("Response: {}", response.trim());
    if response.contains("OK") {
        eprintln!("[at_test] SUCCESS");
    } else {
        eprintln!("[at_test] FAIL no OK in response");
        std::process::exit(1);
    }
}
