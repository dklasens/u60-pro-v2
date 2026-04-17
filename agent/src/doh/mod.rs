mod cache;
pub mod config;
mod dns_packet;
mod upstream;

pub use config::DohConfig;

use std::net::UdpSocket;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};

use crate::util::MutexExt;

pub struct DohProxy {
    config: Mutex<DohConfig>,
    cache: Mutex<cache::DnsCache>,
    running: AtomicBool,
    handle: Mutex<Option<thread::JoinHandle<()>>>,
    queries_total: Mutex<u64>,
    cache_hits: Mutex<u64>,
    cache_misses: Mutex<u64>,
}

impl DohProxy {
    pub fn new() -> Self {
        let cfg = config::load();
        let cache_size = cfg.cache_max_entries;
        Self {
            config: Mutex::new(cfg),
            cache: Mutex::new(cache::DnsCache::new(cache_size)),
            running: AtomicBool::new(false),
            handle: Mutex::new(None),
            queries_total: Mutex::new(0),
            cache_hits: Mutex::new(0),
            cache_misses: Mutex::new(0),
        }
    }

    pub fn start(self: &Arc<Self>) -> Result<(), String> {
        if self.running.load(Ordering::Relaxed) {
            return Err("already running".to_string());
        }

        let addr = self.config.safe_lock().listen_addr.clone();
        let socket = UdpSocket::bind(&addr).map_err(|e| format!("bind {addr}: {e}"))?;
        socket
            .set_read_timeout(Some(Duration::from_millis(500)))
            .map_err(|e| format!("set timeout: {e}"))?;

        self.running.store(true, Ordering::Relaxed);

        let proxy = Arc::clone(self);
        let handle = thread::spawn(move || listener_loop(socket, proxy));
        *self.handle.safe_lock() = Some(handle);
        Ok(())
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
        let handle = self.handle.safe_lock().take();
        if let Some(h) = handle {
            let _ = h.join();
        }
    }

    pub fn status(&self) -> Value {
        let cfg = self.config.safe_lock().clone();
        let running = self.running.load(Ordering::Relaxed);
        let cache_len = self.cache.safe_lock().len();
        let total = *self.queries_total.safe_lock();
        let hits = *self.cache_hits.safe_lock();
        let misses = *self.cache_misses.safe_lock();
        json!({
            "running": running,
            "config": cfg,
            "stats": {
                "queries_total": total,
                "cache_hits": hits,
                "cache_misses": misses,
                "cache_entries": cache_len,
            }
        })
    }

    pub fn update_config(&self, body: &[u8]) -> Result<(), String> {
        let patch: config::DohConfigPatch =
            serde_json::from_slice(body).map_err(|e| format!("invalid config JSON: {e}"))?;
        let mut cfg = self.config.safe_lock();
        cfg.apply_patch(patch);
        self.cache.safe_lock().prune();
        config::save(&cfg)?;
        Ok(())
    }

    pub fn clear_cache(&self) {
        self.cache.safe_lock().clear();
    }

    pub fn cache_entries(&self) -> Value {
        let entries = self.cache.safe_lock().list_entries();
        let list: Vec<Value> = entries
            .into_iter()
            .map(|(qname, qtype, ttl)| {
                json!({"domain": qname, "type": qtype_name(qtype), "type_id": qtype, "ttl": ttl})
            })
            .collect();
        json!(list)
    }

    pub fn config(&self) -> DohConfig {
        self.config.safe_lock().clone()
    }

    pub fn set_enabled(&self, enabled: bool) {
        let mut cfg = self.config.safe_lock();
        cfg.enabled = enabled;
        let _ = config::save(&cfg);
    }

    /// Called on startup — reads config and starts if enabled.
    /// If not enabled, cleans up dnsmasq to prevent orphaned forwarding.
    pub fn auto_start(self: &Arc<Self>) {
        let cfg = self.config.safe_lock().clone();
        if cfg.enabled {
            if self.start().is_err() {
                return;
            }
            // Re-create dnsmasq drop-in (lost on reboot since /tmp is tmpfs)
            let _ = std::fs::write(
                "/tmp/dnsmasq.d/doh.conf",
                "server=127.0.0.1#5353\nno-resolv\n",
            );
            let _ = std::process::Command::new("sh")
                .args(["-c", "/etc/init.d/dnsmasq restart"])
                .output();
        } else {
            // Only clean up if DoH was previously configured
            if std::path::Path::new("/data/local/tmp/doh_config.json").exists() {
                crate::server::dnsmasq_restore_defaults();
            }
        }
    }
}

fn qtype_name(qtype: u16) -> &'static str {
    match qtype {
        1 => "A",
        2 => "NS",
        5 => "CNAME",
        6 => "SOA",
        12 => "PTR",
        15 => "MX",
        16 => "TXT",
        28 => "AAAA",
        33 => "SRV",
        43 => "DS",
        46 => "RRSIG",
        48 => "DNSKEY",
        65 => "HTTPS",
        255 => "ANY",
        _ => "OTHER",
    }
}

fn listener_loop(socket: UdpSocket, proxy: Arc<DohProxy>) {
    let mut buf = [0u8; 512];
    loop {
        if !proxy.running.load(Ordering::Relaxed) {
            break;
        }
        let (len, src) = match socket.recv_from(&mut buf) {
            Ok(r) => r,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => continue,
            Err(_) => {
                continue;
            }
        };
        let query = &buf[..len];
        if !dns_packet::is_valid_query(query) {
            continue;
        }

        let (qname, qtype, _) = match dns_packet::parse_question(query) {
            Some(q) => q,
            None => continue,
        };
        let client_id = u16::from_be_bytes([query[0], query[1]]);

        // Check cache
        {
            let cache = proxy.cache.safe_lock();
            if let Some(cached) = cache.get(&qname, qtype, client_id) {
                *proxy.cache_hits.safe_lock() += 1;
                *proxy.queries_total.safe_lock() += 1;
                let _ = socket.send_to(&cached, src);
                continue;
            }
        }
        *proxy.cache_misses.safe_lock() += 1;
        *proxy.queries_total.safe_lock() += 1;

        // Query upstream
        let config = proxy.config.safe_lock().clone();
        let timeout = Duration::from_millis(config.timeout_ms as u64);
        match upstream::query_doh(query, &config.upstream_url, timeout) {
            Ok(response) => {
                if config.cache_enabled {
                    let ttl = dns_packet::extract_min_ttl(&response);
                    let mut cache = proxy.cache.safe_lock();
                    cache.insert(qname, qtype, &response, ttl);
                }
                let _ = socket.send_to(&response, src);
            }
            Err(_) => {
                // Return SERVFAIL
                let mut fail = query.to_vec();
                if fail.len() >= 4 {
                    fail[2] = 0x81; // QR=1, RD=1
                    fail[3] = 0x82; // RA=1, RCODE=2 (SERVFAIL)
                }
                let _ = socket.send_to(&fail, src);
            }
        }
    }
}
