use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::sync::Mutex;

use serde_json::Value;

const RESTART_DELAY_SECS: u64 = 5;
const IGNORED_EVENTS: &[&str] = &["zwrt_deviceui_event.touchstatus"];

struct Subscriber {
    event: String,
    tx: mpsc::Sender<Value>,
}

pub struct EventBus {
    subscribers: Mutex<Vec<Subscriber>>,
}

impl EventBus {
    pub fn new() -> Self {
        EventBus {
            subscribers: Mutex::new(Vec::new()),
        }
    }

    /// Register interest in a specific ubus event. Returns a receiver
    /// that will get the event payload each time it fires.
    pub fn subscribe(&self, event_name: &str) -> mpsc::Receiver<Value> {
        let (tx, rx) = mpsc::channel();
        let mut subs = self.subscribers.lock().unwrap();
        subs.push(Subscriber {
            event: event_name.to_string(),
            tx,
        });
        rx
    }

    /// Spawn the listener thread. Consumes self into an Arc-compatible form.
    /// Call this after all subscriptions are registered.
    pub fn start(self) {
        std::thread::spawn(move || self.run_loop());
    }

    fn run_loop(&self) {
        loop {
            match spawn_ubus_listen() {
                Ok(mut child) => {
                    eprintln!("[event_bus] ubus listen started (pid {})", child.id());
                    if let Some(stdout) = child.stdout.take() {
                        self.read_events(stdout);
                    }
                    // Process exited — reap it
                    let _ = child.wait();
                    eprintln!("[event_bus] ubus listen exited, restarting in {RESTART_DELAY_SECS}s");
                }
                Err(e) => {
                    eprintln!("[event_bus] failed to spawn ubus listen: {e}");
                }
            }
            std::thread::sleep(std::time::Duration::from_secs(RESTART_DELAY_SECS));
        }
    }

    fn read_events(&self, stdout: std::process::ChildStdout) {
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break, // pipe closed
            };

            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // ubus listen outputs: { "event_name": { ...payload... } }
            let parsed: Value = match serde_json::from_str(trimmed) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let obj = match parsed.as_object() {
                Some(o) => o,
                None => continue,
            };

            // Extract single top-level key as event name
            for (event_name, payload) in obj {
                if IGNORED_EVENTS.contains(&event_name.as_str()) {
                    continue;
                }

                self.dispatch(event_name, payload);
            }
        }
    }

    fn dispatch(&self, event_name: &str, payload: &Value) {
        let subs = self.subscribers.lock().unwrap();
        for sub in subs.iter() {
            if sub.event == event_name {
                // Non-blocking send — drop event if receiver is full/disconnected
                let _ = sub.tx.send(payload.clone());
            }
        }
    }
}

fn spawn_ubus_listen() -> Result<Child, String> {
    Command::new("ubus")
        .arg("listen")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("spawn ubus listen: {e}"))
}
