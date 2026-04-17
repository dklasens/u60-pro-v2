use serde::{Deserialize, Serialize};

const CONFIG_PATH: &str = "/data/local/tmp/doh_config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DohConfig {
    pub enabled: bool,
    pub listen_addr: String,
    pub upstream_url: String,
    pub timeout_ms: u32,
    pub cache_enabled: bool,
    pub cache_max_entries: usize,
}

impl Default for DohConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            listen_addr: "127.0.0.1:5353".to_string(),
            upstream_url: "https://1.1.1.1/dns-query".to_string(),
            timeout_ms: 3000,
            cache_enabled: true,
            cache_max_entries: 512,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct DohConfigPatch {
    pub listen_addr: Option<String>,
    pub upstream_url: Option<String>,
    pub timeout_ms: Option<u32>,
    pub cache_enabled: Option<bool>,
    pub cache_max_entries: Option<usize>,
}

impl DohConfig {
    pub fn apply_patch(&mut self, patch: DohConfigPatch) {
        if let Some(v) = patch.listen_addr {
            self.listen_addr = v;
        }
        if let Some(v) = patch.upstream_url {
            self.upstream_url = v.trim().to_string();
        }
        if let Some(v) = patch.timeout_ms {
            self.timeout_ms = v;
        }
        if let Some(v) = patch.cache_enabled {
            self.cache_enabled = v;
        }
        if let Some(v) = patch.cache_max_entries {
            self.cache_max_entries = v;
        }
    }
}

pub fn load() -> DohConfig {
    std::fs::read_to_string(CONFIG_PATH)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(config: &DohConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| format!("serialize: {e}"))?;
    std::fs::write(CONFIG_PATH, json).map_err(|e| format!("write {CONFIG_PATH}: {e}"))
}
