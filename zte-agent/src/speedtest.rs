use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::{json, Value};

use crate::handlers::AppState;
use crate::util::MutexExt;

// --- Data types ---

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Idle,
    Latency,
    Download,
    Upload,
    Complete,
    Cancelled,
    Error,
}

#[derive(Serialize, Clone)]
pub struct SpeedTestProgress {
    phase: Phase,
    progress: u8,
    live_speed_mbps: f64,
    ping_ms: Option<f64>,
    jitter_ms: Option<f64>,
    download_mbps: Option<f64>,
    upload_mbps: Option<f64>,
    download_bytes: u64,
    upload_bytes: u64,
    server: String,
    error: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct TestServer {
    pub id: u64,
    pub name: String,
    pub sponsor: String,
    pub country: String,
    pub host: String,
    pub url: String,
    #[serde(skip)]
    pub base_url: String,
}

pub struct SpeedTest {
    progress: Arc<Mutex<SpeedTestProgress>>,
    cancel: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
    servers_cache: Arc<Mutex<(Vec<TestServer>, Instant)>>,
}

const CACHE_TTL: Duration = Duration::from_secs(300);
const DOWNLOAD_DURATION: Duration = Duration::from_secs(15);
const UPLOAD_SIZE: usize = 1_000_000; // 1 MB
const UPLOAD_ROUNDS: usize = 10;
const PING_COUNT: usize = 10;
const BUF_SIZE: usize = 16384; // 16 KB

impl SpeedTest {
    pub fn new() -> Self {
        Self {
            progress: Arc::new(Mutex::new(SpeedTestProgress {
                phase: Phase::Idle,
                progress: 0,
                live_speed_mbps: 0.0,
                ping_ms: None,
                jitter_ms: None,
                download_mbps: None,
                upload_mbps: None,
                download_bytes: 0,
                upload_bytes: 0,
                server: String::new(),
                error: None,
            })),
            cancel: Arc::new(AtomicBool::new(false)),
            running: Arc::new(AtomicBool::new(false)),
            servers_cache: Arc::new(Mutex::new((Vec::new(), Instant::now() - CACHE_TTL))),
        }
    }
}

// --- Server fetching ---

fn fetch_servers() -> Result<Vec<TestServer>, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(10)))
        .build()
        .into();

    let resp = agent
        .get("https://www.speedtest.net/api/js/servers?engine=js&limit=20")
        .call()
        .map_err(|e| format!("fetch servers: {e}"))?;

    let data: Vec<Value> = resp
        .into_body()
        .read_json()
        .map_err(|e| format!("parse servers: {e}"))?;

    let mut servers = Vec::new();
    for entry in &data {
        let url = entry["url"].as_str().unwrap_or_default();
        // base_url: everything up to and including the last '/'
        let base_url = match url.rfind('/') {
            Some(i) => &url[..=i],
            None => continue,
        };

        servers.push(TestServer {
            id: entry["id"]
                .as_u64()
                .or_else(|| entry["id"].as_str().and_then(|s| s.parse().ok()))
                .unwrap_or(0),
            name: entry["name"].as_str().unwrap_or("").to_string(),
            sponsor: entry["sponsor"].as_str().unwrap_or("").to_string(),
            country: entry["country"].as_str().unwrap_or("").to_string(),
            host: entry["host"].as_str().unwrap_or("").to_string(),
            url: url.to_string(),
            base_url: base_url.to_string(),
        });
    }
    Ok(servers)
}

fn get_servers(cache: &Arc<Mutex<(Vec<TestServer>, Instant)>>) -> Result<Vec<TestServer>, String> {
    let guard = cache.safe_lock();
    if !guard.0.is_empty() && guard.1.elapsed() < CACHE_TTL {
        return Ok(guard.0.clone());
    }
    drop(guard);

    let servers = fetch_servers()?;
    let mut guard = cache.safe_lock();
    guard.0 = servers.clone();
    guard.1 = Instant::now();
    Ok(servers)
}

// --- Background test logic ---

fn run_test(
    server: &TestServer,
    progress: &Arc<Mutex<SpeedTestProgress>>,
    cancel: &Arc<AtomicBool>,
) {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(30)))
        .build()
        .into();

    let ping_agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(5)))
        .build()
        .into();

    // --- Latency phase ---
    {
        let mut guard = progress.safe_lock();
        guard.phase = Phase::Latency;
        guard.progress = 0;
    }

    let ping_url = format!("{}latency.txt", server.base_url);
    let mut rtts = Vec::with_capacity(PING_COUNT);

    for i in 0..PING_COUNT {
        if cancel.load(Ordering::Relaxed) {
            set_cancelled(progress);
            return;
        }

        let start = Instant::now();
        match ping_agent.get(&ping_url).call() {
            Ok(resp) => {
                let _ = resp.into_body().read_to_vec();
                rtts.push(start.elapsed().as_secs_f64() * 1000.0);
            }
            Err(_) => {} // skip failed pings
        }

        let pct = ((i + 1) as u8 * 20) / PING_COUNT as u8;
        let mut guard = progress.safe_lock();
        guard.progress = pct;
    }

    if rtts.is_empty() {
        set_error(progress, "all ping attempts failed");
        return;
    }

    rtts.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median_ping = rtts[rtts.len() / 2];
    let jitter = if rtts.len() > 1 {
        let diffs: Vec<f64> = rtts.windows(2).map(|w| (w[1] - w[0]).abs()).collect();
        diffs.iter().sum::<f64>() / diffs.len() as f64
    } else {
        0.0
    };

    {
        let mut guard = progress.safe_lock();
        guard.ping_ms = Some(round2(median_ping));
        guard.jitter_ms = Some(round2(jitter));
    }

    // --- Download phase ---
    {
        let mut guard = progress.safe_lock();
        guard.phase = Phase::Download;
        guard.progress = 20;
    }

    let download_url = format!("{}random4000x4000.jpg", server.base_url);
    let dl_start = Instant::now();
    let mut dl_bytes: u64 = 0;
    let mut buf = [0u8; BUF_SIZE];

    // Download for DOWNLOAD_DURATION, re-fetching the file if it finishes early
    'dl_outer: while dl_start.elapsed() < DOWNLOAD_DURATION {
        if cancel.load(Ordering::Relaxed) {
            set_cancelled(progress);
            return;
        }

        let resp = match agent.get(&download_url).call() {
            Ok(r) => r,
            Err(_) => break,
        };

        let mut body = resp.into_body();
        let mut reader = body.as_reader();
        loop {
            if cancel.load(Ordering::Relaxed) {
                set_cancelled(progress);
                return;
            }
            if dl_start.elapsed() >= DOWNLOAD_DURATION {
                break 'dl_outer;
            }

            match reader.read(&mut buf) {
                Ok(0) => break, // EOF, re-fetch
                Ok(n) => {
                    dl_bytes += n as u64;
                    let elapsed = dl_start.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        (dl_bytes as f64 * 8.0) / (elapsed * 1_000_000.0)
                    } else {
                        0.0
                    };
                    let pct = 20
                        + ((dl_start.elapsed().as_secs_f64() / DOWNLOAD_DURATION.as_secs_f64())
                            * 40.0)
                            .min(40.0) as u8;
                    let mut guard = progress.safe_lock();
                    guard.live_speed_mbps = round2(speed);
                    guard.download_bytes = dl_bytes;
                    guard.progress = pct;
                }
                Err(_) => break,
            }
        }
    }

    let dl_elapsed = dl_start.elapsed().as_secs_f64();
    let dl_speed = if dl_elapsed > 0.0 {
        (dl_bytes as f64 * 8.0) / (dl_elapsed * 1_000_000.0)
    } else {
        0.0
    };

    {
        let mut guard = progress.safe_lock();
        guard.download_mbps = Some(round2(dl_speed));
        guard.download_bytes = dl_bytes;
        guard.progress = 60;
    }

    // --- Upload phase ---
    {
        let mut guard = progress.safe_lock();
        guard.phase = Phase::Upload;
        guard.live_speed_mbps = 0.0;
    }

    let upload_buf = vec![0u8; UPLOAD_SIZE];
    let ul_start = Instant::now();
    let mut ul_bytes: u64 = 0;

    for i in 0..UPLOAD_ROUNDS {
        if cancel.load(Ordering::Relaxed) {
            set_cancelled(progress);
            return;
        }

        match agent.post(&server.url).send(&upload_buf[..]) {
            Ok(_) => {
                ul_bytes += UPLOAD_SIZE as u64;
            }
            Err(_) => {} // continue on error
        }

        let elapsed = ul_start.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            (ul_bytes as f64 * 8.0) / (elapsed * 1_000_000.0)
        } else {
            0.0
        };
        let pct = 60 + ((i + 1) as u8 * 40) / UPLOAD_ROUNDS as u8;
        let mut guard = progress.safe_lock();
        guard.live_speed_mbps = round2(speed);
        guard.upload_bytes = ul_bytes;
        guard.progress = pct;
    }

    let ul_elapsed = ul_start.elapsed().as_secs_f64();
    let ul_speed = if ul_elapsed > 0.0 {
        (ul_bytes as f64 * 8.0) / (ul_elapsed * 1_000_000.0)
    } else {
        0.0
    };

    {
        let mut guard = progress.safe_lock();
        guard.upload_mbps = Some(round2(ul_speed));
        guard.upload_bytes = ul_bytes;
        guard.phase = Phase::Complete;
        guard.progress = 100;
        guard.live_speed_mbps = 0.0;
    }
}

fn set_cancelled(progress: &Arc<Mutex<SpeedTestProgress>>) {
    let mut guard = progress.safe_lock();
    guard.phase = Phase::Cancelled;
    guard.live_speed_mbps = 0.0;
}

fn set_error(progress: &Arc<Mutex<SpeedTestProgress>>, msg: &str) {
    let mut guard = progress.safe_lock();
    guard.phase = Phase::Error;
    guard.error = Some(msg.to_string());
    guard.live_speed_mbps = 0.0;
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

// --- Handler functions ---

pub fn servers(state: &AppState) -> (u16, Value) {
    match get_servers(&state.speedtest.servers_cache) {
        Ok(list) => (200, json!({"ok": true, "data": list})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn start(state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };

    let server_id = parsed["server_id"].as_u64();

    let server_list = match get_servers(&state.speedtest.servers_cache) {
        Ok(s) => s,
        Err(e) => return (503, json!({"ok": false, "error": e})),
    };

    let server = if let Some(id) = server_id {
        match server_list.iter().find(|s| s.id == id) {
            Some(s) => s.clone(),
            None => return (404, json!({"ok": false, "error": "server not found"})),
        }
    } else {
        match server_list.into_iter().next() {
            Some(s) => s,
            None => return (503, json!({"ok": false, "error": "no servers available"})),
        }
    };

    // Reset state
    state.speedtest.cancel.store(false, Ordering::Relaxed);
    {
        let mut guard = state.speedtest.progress.safe_lock();
        *guard = SpeedTestProgress {
            phase: Phase::Idle,
            progress: 0,
            live_speed_mbps: 0.0,
            ping_ms: None,
            jitter_ms: None,
            download_mbps: None,
            upload_mbps: None,
            download_bytes: 0,
            upload_bytes: 0,
            server: format!("{} ({})", server.sponsor, server.name),
            error: None,
        };
    }

    // Atomically set running=true; if already true, another test is in progress
    if state
        .speedtest
        .running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::Relaxed)
        .is_err()
    {
        return (409, json!({"ok": false, "error": "test already running"}));
    }

    let progress = Arc::clone(&state.speedtest.progress);
    let cancel = Arc::clone(&state.speedtest.cancel);
    let running = Arc::clone(&state.speedtest.running);

    std::thread::spawn(move || {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            run_test(&server, &progress, &cancel);
        }));
        running.store(false, Ordering::Relaxed);
    });

    (200, json!({"ok": true, "data": {"status": "started"}}))
}

pub fn progress(state: &AppState) -> (u16, Value) {
    let guard = state.speedtest.progress.safe_lock();
    (200, json!({"ok": true, "data": *guard}))
}

pub fn stop(state: &AppState, _body: &[u8]) -> (u16, Value) {
    if !state.speedtest.running.load(Ordering::Relaxed) {
        return (200, json!({"ok": true, "data": {"status": "not_running"}}));
    }
    state.speedtest.cancel.store(true, Ordering::Relaxed);
    (200, json!({"ok": true, "data": {"status": "stopping"}}))
}
