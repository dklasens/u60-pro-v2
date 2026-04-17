use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::os::unix::io::AsRawFd;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

const PORTS: &[&str] = &[
    "/dev/at_mdm0",
    "/dev/at_mdm1",
    "/dev/at_usb0",
    "/dev/smd7",
    "/dev/smd11",
];

pub struct AtPort {
    cached: Mutex<Option<String>>,
    lock: Mutex<()>,
}

impl AtPort {
    pub fn new() -> Self {
        Self {
            cached: Mutex::new(None),
            lock: Mutex::new(()),
        }
    }

    fn detect(&self) -> Option<String> {
        {
            let cached = self.cached.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(ref port) = *cached {
                return Some(port.clone());
            }
        }

        for &port in PORTS {
            if !std::path::Path::new(port).exists() {
                continue;
            }
            if raw_send(port, "AT", 2)
                .ok()
                .map_or(false, |r| r.contains("OK"))
            {
                let mut cached = self.cached.lock().unwrap_or_else(|e| e.into_inner());
                *cached = Some(port.to_string());
                return Some(port.to_string());
            }
        }
        None
    }
}

fn raw_send(port_path: &str, command: &str, timeout_secs: u64) -> Result<String, String> {
    let rd = OpenOptions::new()
        .read(true)
        .open(port_path)
        .map_err(|e| format!("open read {port_path}: {e}"))?;

    let mut wr = OpenOptions::new()
        .write(true)
        .open(port_path)
        .map_err(|e| format!("open write {port_path}: {e}"))?;

    let buffer: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let stop = Arc::new(AtomicBool::new(false));

    let buf_clone = buffer.clone();
    let stop_clone = stop.clone();
    let rd_fd = rd.as_raw_fd();
    std::thread::spawn(move || {
        let mut tmp = [0u8; 4096];
        let mut rd = rd;
        loop {
            if stop_clone.load(Ordering::Relaxed) {
                break;
            }
            let mut fds: [libc::pollfd; 1] = [libc::pollfd {
                fd: rd_fd,
                events: libc::POLLIN,
                revents: 0,
            }];
            let n = unsafe { libc::poll(fds.as_mut_ptr(), 1, 50) };
            if n < 0 {
                break;
            }
            if n > 0 && (fds[0].revents & libc::POLLIN) != 0 {
                match rd.read(&mut tmp) {
                    Ok(0) => {}
                    Ok(n) => {
                        let s = String::from_utf8_lossy(&tmp[..n]);
                        let mut buf = buf_clone.lock().unwrap_or_else(|e| e.into_inner());
                        buf.push_str(&s);
                    }
                    Err(_) => {}
                }
            }
        }
    });

    std::thread::sleep(std::time::Duration::from_millis(50));

    wr.write_all(format!("{command}\r\n").as_bytes())
        .map_err(|e| format!("write: {e}"))?;

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs.max(1));
    loop {
        if std::time::Instant::now() >= deadline {
            break;
        }
        let buf = buffer.lock().unwrap_or_else(|e| e.into_inner());
        if buf.contains("OK") || buf.contains("ERROR") {
            break;
        }
        drop(buf);
        std::thread::sleep(std::time::Duration::from_millis(20));
    }

    stop.store(true, Ordering::Relaxed);
    std::thread::sleep(std::time::Duration::from_millis(50));

    let response = buffer.lock().unwrap_or_else(|e| e.into_inner()).clone();
    Ok(response)
}

/// Send an AT command and return the raw response text.
/// Serialized via mutex to prevent concurrent serial port access.
pub fn send(at_port: &AtPort, command: &str, timeout_secs: u64) -> Result<String, String> {
    let _guard = at_port.lock.lock().unwrap_or_else(|e| e.into_inner());
    let port = at_port.detect().ok_or("no serial port found")?;
    raw_send(&port, command, timeout_secs)
}
