use std::collections::HashMap;
use std::time::{Duration, Instant};

use super::dns_packet;

struct CacheEntry {
    response: Vec<u8>, // stored with transaction ID = 0
    expires: Instant,
}

pub struct DnsCache {
    entries: HashMap<(String, u16), CacheEntry>,
    max_entries: usize,
}

impl DnsCache {
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: HashMap::new(),
            max_entries,
        }
    }

    /// Look up a cached response. Returns a clone with the transaction ID rewritten to client_id.
    pub fn get(&self, qname: &str, qtype: u16, client_id: u16) -> Option<Vec<u8>> {
        let entry = self.entries.get(&(qname.to_string(), qtype))?;
        if Instant::now() >= entry.expires {
            return None;
        }
        let mut resp = entry.response.clone();
        dns_packet::rewrite_id(&mut resp, client_id);
        Some(resp)
    }

    /// Insert a response into the cache. The response is stored with transaction ID zeroed.
    pub fn insert(&mut self, qname: String, qtype: u16, response: &[u8], ttl: u32) {
        if self.entries.len() >= self.max_entries {
            self.prune();
        }
        // If still at capacity after pruning, evict the entry closest to expiry
        if self.entries.len() >= self.max_entries {
            let oldest_key = self
                .entries
                .iter()
                .min_by_key(|(_, v)| v.expires)
                .map(|(k, _)| k.clone());
            if let Some(key) = oldest_key {
                self.entries.remove(&key);
            }
        }

        let mut stored = response.to_vec();
        dns_packet::rewrite_id(&mut stored, 0);

        // Cap negative responses (NXDOMAIN=3, SERVFAIL=2) at 60s
        let effective_ttl = if response.len() >= 4 {
            let rcode = response[3] & 0x0F;
            if rcode == 2 || rcode == 3 {
                ttl.min(60)
            } else {
                ttl
            }
        } else {
            ttl
        };

        // Don't cache zero-TTL
        if effective_ttl == 0 {
            return;
        }

        let expires = Instant::now() + Duration::from_secs(effective_ttl as u64);
        self.entries.insert(
            (qname, qtype),
            CacheEntry {
                response: stored,
                expires,
            },
        );
    }

    /// Remove all expired entries.
    pub fn prune(&mut self) {
        let now = Instant::now();
        self.entries.retain(|_, v| v.expires > now);
    }

    /// Returns `(qname, qtype, ttl_remaining_secs)` for all non-expired entries.
    pub fn list_entries(&self) -> Vec<(String, u16, u64)> {
        let now = Instant::now();
        self.entries
            .iter()
            .filter(|(_, v)| v.expires > now)
            .map(|((qname, qtype), v)| {
                let remaining = v.expires.duration_since(now).as_secs();
                (qname.clone(), *qtype, remaining)
            })
            .collect()
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }
}
