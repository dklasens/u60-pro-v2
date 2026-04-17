use std::fs::{self, File};
use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};

use crate::csv_utils::{chrono_lite, csv_escape, now_secs, str_field};
use crate::handlers::AppState;
use crate::ubus;

const LOG_PATH: &str = "/data/local/tmp/connection_log.csv";
const MAX_DURATION: u64 = 86400;

pub struct ConnectionLogger {
    pub running: AtomicBool,
    stop_flag: Arc<AtomicBool>,
    started_at: AtomicU64,
    duration: AtomicU64,
    interval: AtomicU64,
    events: AtomicU64,
}

impl ConnectionLogger {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            stop_flag: Arc::new(AtomicBool::new(false)),
            started_at: AtomicU64::new(0),
            duration: AtomicU64::new(0),
            interval: AtomicU64::new(3),
            events: AtomicU64::new(0),
        }
    }
}

struct Snapshot {
    cell_id: String,
    lte_band: String,
    nr_band: String,
    network_type: String,
    lte_pci: String,
    nr_pci: String,
}

impl Snapshot {
    fn from(data: &Value) -> Self {
        Self {
            cell_id: str_field(data, "cell_id"),
            lte_band: str_field(data, "wan_active_band"),
            nr_band: str_field(data, "nr5g_action_band"),
            network_type: str_field(data, "network_type"),
            lte_pci: str_field(data, "lte_pci"),
            nr_pci: str_field(data, "nr5g_pci"),
        }
    }
}

const HEADER: &str = "timestamp,datetime,event_type,detail,old_value,new_value";

fn run(logger: &ConnectionLogger) {
    let duration = logger.duration.load(Ordering::Relaxed);
    let interval = logger.interval.load(Ordering::Relaxed);

    let mut file = match File::create(LOG_PATH) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[WARN] [connection_logger] failed to create log: {e}");
            logger.running.store(false, Ordering::Relaxed);
            return;
        }
    };
    let _ = writeln!(file, "{HEADER}");

    let start = now_secs();
    eprintln!("[INFO] [connection_logger] started: interval={interval}s, duration={duration}s");

    let mut prev: Option<Snapshot> = None;

    loop {
        if logger.stop_flag.load(Ordering::Relaxed) {
            break;
        }
        if now_secs() - start >= duration {
            break;
        }

        if let Ok(data) = ubus::call("zte_nwinfo_api", "nwinfo_get_netinfo", Some("{}")) {
            let cur = Snapshot::from(&data);
            let ts = now_secs();
            let dt = chrono_lite(ts);

            if let Some(ref p) = prev {
                // Detect changes
                if cur.cell_id != p.cell_id && !p.cell_id.is_empty() {
                    let _ = writeln!(
                        file,
                        "{ts},{dt},cell_handover,cell_id changed,{},{}",
                        csv_escape(&p.cell_id),
                        csv_escape(&cur.cell_id)
                    );
                    logger.events.fetch_add(1, Ordering::Relaxed);
                }
                if cur.lte_band != p.lte_band && !p.lte_band.is_empty() {
                    let _ = writeln!(
                        file,
                        "{ts},{dt},lte_band_change,LTE band changed,{},{}",
                        csv_escape(&p.lte_band),
                        csv_escape(&cur.lte_band)
                    );
                    logger.events.fetch_add(1, Ordering::Relaxed);
                }
                if cur.nr_band != p.nr_band {
                    let event = if p.nr_band.is_empty() && !cur.nr_band.is_empty() {
                        "nr_connected"
                    } else if !p.nr_band.is_empty() && cur.nr_band.is_empty() {
                        "nr_disconnected"
                    } else if !p.nr_band.is_empty() {
                        "nr_band_change"
                    } else {
                        ""
                    };
                    if !event.is_empty() {
                        let _ = writeln!(
                            file,
                            "{ts},{dt},{event},NR band changed,{},{}",
                            csv_escape(&p.nr_band),
                            csv_escape(&cur.nr_band)
                        );
                        logger.events.fetch_add(1, Ordering::Relaxed);
                    }
                }
                if cur.network_type != p.network_type && !p.network_type.is_empty() {
                    let _ = writeln!(
                        file,
                        "{ts},{dt},mode_change,Network type changed,{},{}",
                        csv_escape(&p.network_type),
                        csv_escape(&cur.network_type)
                    );
                    logger.events.fetch_add(1, Ordering::Relaxed);
                }
                if cur.lte_pci != p.lte_pci && !p.lte_pci.is_empty() {
                    let _ = writeln!(
                        file,
                        "{ts},{dt},lte_pci_change,LTE PCI changed,{},{}",
                        csv_escape(&p.lte_pci),
                        csv_escape(&cur.lte_pci)
                    );
                    logger.events.fetch_add(1, Ordering::Relaxed);
                }
                if cur.nr_pci != p.nr_pci && !p.nr_pci.is_empty() && !cur.nr_pci.is_empty() {
                    let _ = writeln!(
                        file,
                        "{ts},{dt},nr_pci_change,NR PCI changed,{},{}",
                        csv_escape(&p.nr_pci),
                        csv_escape(&cur.nr_pci)
                    );
                    logger.events.fetch_add(1, Ordering::Relaxed);
                }
                let _ = file.flush();
            }

            prev = Some(cur);
        }

        std::thread::sleep(Duration::from_secs(interval));
    }

    let events = logger.events.load(Ordering::Relaxed);
    eprintln!("[INFO] [connection_logger] stopped: {events} events captured");
    logger.running.store(false, Ordering::Relaxed);
}

// ── HTTP handlers ────────────────────────────────────────────────────────────

pub fn start_logging(state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };

    let duration = parsed["duration_secs"]
        .as_u64()
        .unwrap_or(3600)
        .min(MAX_DURATION);
    let interval = parsed["interval_secs"].as_u64().unwrap_or(3).max(1);

    let logger = &state.connection_logger;
    if logger.running.load(Ordering::Relaxed) {
        return (409, json!({"ok": false, "error": "logger already running"}));
    }

    let _ = fs::remove_file(LOG_PATH);

    logger.stop_flag.store(false, Ordering::Relaxed);
    logger.started_at.store(now_secs(), Ordering::Relaxed);
    logger.duration.store(duration, Ordering::Relaxed);
    logger.interval.store(interval, Ordering::Relaxed);
    logger.events.store(0, Ordering::Relaxed);
    logger.running.store(true, Ordering::Relaxed);

    let lg = state.connection_logger.clone();
    std::thread::spawn(move || run(&lg));

    (
        200,
        json!({"ok": true, "data": {"duration_secs": duration, "interval_secs": interval}}),
    )
}

pub fn stop_logging(state: &AppState) -> (u16, Value) {
    state
        .connection_logger
        .stop_flag
        .store(true, Ordering::Relaxed);
    (200, json!({"ok": true}))
}

pub fn status(state: &AppState) -> (u16, Value) {
    let logger = &state.connection_logger;
    let running = logger.running.load(Ordering::Relaxed);
    let started = logger.started_at.load(Ordering::Relaxed);
    let duration = logger.duration.load(Ordering::Relaxed);
    let elapsed = if running { now_secs() - started } else { 0 };
    (
        200,
        json!({"ok": true, "data": {
            "running": running,
            "events": logger.events.load(Ordering::Relaxed),
            "elapsed_secs": elapsed,
            "duration_secs": duration,
            "interval_secs": logger.interval.load(Ordering::Relaxed),
        }}),
    )
}

pub fn download(_state: &AppState) -> (u16, Value) {
    match fs::read_to_string(LOG_PATH) {
        Ok(csv) => (200, json!({"ok": true, "data": {"csv": csv}})),
        Err(_) => (404, json!({"ok": false, "error": "no log file"})),
    }
}
