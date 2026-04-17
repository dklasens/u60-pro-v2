use std::fs::{self, File};
use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};

use crate::csv_utils::{chrono_lite, csv_escape, now_secs, str_field};
use crate::handlers::AppState;
use crate::ubus;

const LOG_PATH: &str = "/data/local/tmp/signal_log.csv";
const MAX_DURATION: u64 = 86400; // 24 hours

pub struct SignalLogger {
    pub running: AtomicBool,
    stop_flag: Arc<AtomicBool>,
    started_at: AtomicU64,
    duration: AtomicU64,
    interval: AtomicU64,
    samples: AtomicU64,
}

impl SignalLogger {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            stop_flag: Arc::new(AtomicBool::new(false)),
            started_at: AtomicU64::new(0),
            duration: AtomicU64::new(0),
            interval: AtomicU64::new(3),
            samples: AtomicU64::new(0),
        }
    }
}

const HEADER: &str = "timestamp,datetime,network_type,carrier,cell_id,lte_band,lte_pci,lte_earfcn,lte_rsrp,lte_rsrq,lte_sinr,lte_rssi,nr_band,nr_pci,nr_arfcn,nr_rsrp,nr_rsrq,nr_sinr,nr_rssi,lte_ca_bands,nr_ca_bands";

fn format_row(ts: u64, data: &Value) -> String {
    // Parse LTE CA band list from lteca string
    let lteca = str_field(data, "lteca");
    let lte_ca: Vec<String> = lteca
        .split(';')
        .filter(|s| !s.is_empty())
        .filter_map(|seg| seg.split(',').nth(1).map(|b| format!("B{b}")))
        .collect();

    // Parse NR CA band list from nrca string
    let nrca = str_field(data, "nrca");
    let nr_ca: Vec<String> = nrca
        .split(';')
        .filter(|s| !s.is_empty())
        .filter_map(|seg| seg.split(',').nth(3).map(|b| format!("n{b}")))
        .collect();

    // ISO 8601 timestamp
    let dt = chrono_lite(ts);

    format!(
        "{ts},{dt},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}",
        csv_escape(&str_field(data, "network_type")),
        csv_escape(&str_field(data, "network_provider_fullname")),
        str_field(data, "cell_id"),
        csv_escape(&str_field(data, "wan_active_band")),
        str_field(data, "lte_pci"),
        str_field(data, "wan_active_channel"),
        str_field(data, "lte_rsrp"),
        str_field(data, "lte_rsrq"),
        str_field(data, "lte_snr"),
        str_field(data, "lte_rssi"),
        csv_escape(&str_field(data, "nr5g_action_band")),
        str_field(data, "nr5g_pci"),
        str_field(data, "nr5g_action_channel"),
        str_field(data, "nr5g_rsrp"),
        str_field(data, "nr5g_rsrq"),
        str_field(data, "nr5g_snr"),
        str_field(data, "nr5g_rssi"),
        csv_escape(&lte_ca.join("+")),
        csv_escape(&nr_ca.join("+")),
    )
}

fn run(logger: &SignalLogger) {
    let duration = logger.duration.load(Ordering::Relaxed);
    let interval = logger.interval.load(Ordering::Relaxed);

    // Create/truncate log file
    let mut file = match File::create(LOG_PATH) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[WARN] [signal_logger] failed to create log: {e}");
            logger.running.store(false, Ordering::Relaxed);
            return;
        }
    };
    let _ = writeln!(file, "{HEADER}");

    let start = now_secs();
    eprintln!("[INFO] [signal_logger] started: interval={interval}s, duration={duration}s");

    loop {
        if logger.stop_flag.load(Ordering::Relaxed) {
            break;
        }
        let elapsed = now_secs() - start;
        if elapsed >= duration {
            break;
        }

        if let Ok(data) = ubus::call("zte_nwinfo_api", "nwinfo_get_netinfo", Some("{}")) {
            let row = format_row(now_secs(), &data);
            let _ = writeln!(file, "{row}");
            let _ = file.flush();
            logger.samples.fetch_add(1, Ordering::Relaxed);
        }

        std::thread::sleep(Duration::from_secs(interval));
    }

    let samples = logger.samples.load(Ordering::Relaxed);
    eprintln!("[INFO] [signal_logger] stopped: {samples} samples collected");
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

    let logger = &state.signal_logger;
    if logger.running.load(Ordering::Relaxed) {
        return (409, json!({"ok": false, "error": "logger already running"}));
    }

    // Clean up old log
    let _ = fs::remove_file(LOG_PATH);

    logger.stop_flag.store(false, Ordering::Relaxed);
    logger.started_at.store(now_secs(), Ordering::Relaxed);
    logger.duration.store(duration, Ordering::Relaxed);
    logger.interval.store(interval, Ordering::Relaxed);
    logger.samples.store(0, Ordering::Relaxed);
    logger.running.store(true, Ordering::Relaxed);

    let lg = state.signal_logger.clone();
    std::thread::spawn(move || run(&lg));

    (
        200,
        json!({"ok": true, "data": {"duration_secs": duration, "interval_secs": interval}}),
    )
}

pub fn stop_logging(state: &AppState) -> (u16, Value) {
    state.signal_logger.stop_flag.store(true, Ordering::Relaxed);
    (200, json!({"ok": true}))
}

pub fn status(state: &AppState) -> (u16, Value) {
    let logger = &state.signal_logger;
    let running = logger.running.load(Ordering::Relaxed);
    let started = logger.started_at.load(Ordering::Relaxed);
    let duration = logger.duration.load(Ordering::Relaxed);
    let elapsed = if running { now_secs() - started } else { 0 };
    (
        200,
        json!({"ok": true, "data": {
            "running": running,
            "samples": logger.samples.load(Ordering::Relaxed),
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
