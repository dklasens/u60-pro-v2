use std::process::Command;

use serde_json::{json, Value};

use crate::handlers::AppState;
use crate::ubus;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn uci_get_wireless(key: &str) -> String {
    ubus::uci_get(&format!("wireless.{key}")).unwrap_or_default()
}

fn uci_get_mbb(key: &str) -> String {
    ubus::uci_get(&format!("zte_mbb.{key}")).unwrap_or_default()
}

fn iw_info(iface: &str) -> (String, String) {
    let output = Command::new("iw").args([iface, "info"]).output().ok();
    let out = output
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();
    let channel = out
        .lines()
        .find_map(|l| {
            let l = l.trim();
            if l.starts_with("channel ") {
                l.split_whitespace().nth(1).map(|s| s.to_string())
            } else {
                None
            }
        })
        .unwrap_or_default();
    let bw = out
        .lines()
        .find_map(|l| {
            let l = l.trim();
            if let Some(pos) = l.find("width:") {
                let rest = l[pos + 6..].trim();
                let end = rest.find("MHz").map(|i| i + 3).unwrap_or(rest.len());
                Some(rest[..end].trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_default();
    (channel, bw)
}

fn station_count(iface: &str) -> u64 {
    let output = Command::new("sh")
        .args([
            "-c",
            &format!("iw {iface} station dump 2>/dev/null | grep -c Station"),
        ])
        .output()
        .ok();
    output
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .parse::<u64>()
                .ok()
        })
        .unwrap_or(0)
}

fn sanitize_uci_value(v: &str) -> String {
    v.chars()
        .filter(|c| {
            !matches!(
                c,
                '\'' | '"' | ';' | '$' | '`' | '\\' | '|' | '<' | '>' | '&'
            )
        })
        .collect()
}

// ---------------------------------------------------------------------------
// GET /api/wifi/status
// ---------------------------------------------------------------------------

pub fn wifi_status(_state: &AppState) -> (u16, Value) {
    let mut result = serde_json::Map::new();

    // Global switches from zte_mbb
    let mut wifi_onoff = uci_get_mbb("wifi.wifi_onoff");
    let mut wifi6_switch = uci_get_mbb("wifi.wifi6_switch");

    // Fallback: if mbb UCI keys are missing, read from zwrt_wlan report
    if wifi_onoff.is_empty() || wifi6_switch.is_empty() {
        if let Ok(report) = ubus::call("zwrt_wlan", "report", Some("{}")) {
            if wifi_onoff.is_empty() {
                wifi_onoff = report["wifi_onoff"].as_str().unwrap_or("1").to_string();
            }
            if wifi6_switch.is_empty() {
                wifi6_switch = report["wifi6_switch"].as_str().unwrap_or("0").to_string();
            }
        }
    }
    result.insert("wifi_onoff".into(), json!(wifi_onoff));
    result.insert("wifi6_switch".into(), json!(wifi6_switch));

    // Radio config
    result.insert(
        "radio2_disabled".into(),
        json!(uci_get_wireless("wifi0.disabled")),
    );
    result.insert(
        "radio5_disabled".into(),
        json!(uci_get_wireless("wifi1.disabled")),
    );
    result.insert(
        "channel_2g".into(),
        json!(uci_get_wireless("wifi0.channel")),
    );
    result.insert(
        "channel_5g".into(),
        json!(uci_get_wireless("wifi1.channel")),
    );
    result.insert(
        "txpower_2g".into(),
        json!(uci_get_wireless("wifi0.txpowerpercent")),
    );
    result.insert(
        "txpower_5g".into(),
        json!(uci_get_wireless("wifi1.txpowerpercent")),
    );
    result.insert("htmode_2g".into(), json!(uci_get_wireless("wifi0.htmode")));
    result.insert("htmode_5g".into(), json!(uci_get_wireless("wifi1.htmode")));
    result.insert(
        "country_code".into(),
        json!(uci_get_wireless("wifi0.country")),
    );

    // Interface config
    result.insert("ssid_2g".into(), json!(uci_get_wireless("main_2g.ssid")));
    result.insert("ssid_5g".into(), json!(uci_get_wireless("main_5g.ssid")));
    result.insert(
        "has_key_2g".into(),
        json!(!uci_get_wireless("main_2g.key").is_empty()),
    );
    result.insert(
        "has_key_5g".into(),
        json!(!uci_get_wireless("main_5g.key").is_empty()),
    );
    result.insert(
        "encryption_2g".into(),
        json!(uci_get_wireless("main_2g.encryption")),
    );
    result.insert(
        "encryption_5g".into(),
        json!(uci_get_wireless("main_5g.encryption")),
    );
    result.insert(
        "hidden_2g".into(),
        json!(uci_get_wireless("main_2g.hidden")),
    );
    result.insert(
        "hidden_5g".into(),
        json!(uci_get_wireless("main_5g.hidden")),
    );

    // Runtime info from iw
    let (ch2, bw2) = iw_info("wlan0");
    let (ch5, bw5) = iw_info("wlan2");
    result.insert("actual_channel_2g".into(), json!(ch2));
    result.insert("actual_bw_2g".into(), json!(bw2));
    result.insert("actual_channel_5g".into(), json!(ch5));
    result.insert("actual_bw_5g".into(), json!(bw5));

    // Client counts
    let c2g = station_count("wlan0");
    let c5g = station_count("wlan2");
    result.insert("clients_2g".into(), json!(c2g));
    result.insert("clients_5g".into(), json!(c5g));
    result.insert("clients_total".into(), json!(c2g + c5g));

    // Guest WiFi summary
    result.insert(
        "guest_disabled_2g".into(),
        json!(uci_get_wireless("guest_2g.disabled")),
    );
    result.insert(
        "guest_disabled_5g".into(),
        json!(uci_get_wireless("guest_5g.disabled")),
    );
    result.insert(
        "guest_ssid".into(),
        json!(uci_get_wireless("guest_2g.ssid")),
    );

    (200, json!({"ok": true, "data": result}))
}

// ---------------------------------------------------------------------------
// PUT /api/wifi/settings
// ---------------------------------------------------------------------------

pub fn wifi_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    let obj = match parsed.as_object() {
        Some(o) => o,
        None => return (400, json!({"ok": false, "error": "expected JSON object"})),
    };

    let uci_map: &[(&str, &str)] = &[
        ("ssid_2g", "wireless.main_2g.ssid"),
        ("ssid_5g", "wireless.main_5g.ssid"),
        ("key_2g", "wireless.main_2g.key"),
        ("key_5g", "wireless.main_5g.key"),
        ("encryption_2g", "wireless.main_2g.encryption"),
        ("encryption_5g", "wireless.main_5g.encryption"),
        ("hidden_2g", "wireless.main_2g.hidden"),
        ("hidden_5g", "wireless.main_5g.hidden"),
        ("channel_2g", "wireless.wifi0.channel"),
        ("channel_5g", "wireless.wifi1.channel"),
        ("txpower_2g", "wireless.wifi0.txpowerpercent"),
        ("txpower_5g", "wireless.wifi1.txpowerpercent"),
        ("htmode_2g", "wireless.wifi0.htmode"),
        ("htmode_5g", "wireless.wifi1.htmode"),
        ("radio2_disabled", "wireless.wifi0.disabled"),
        ("radio5_disabled", "wireless.wifi1.disabled"),
    ];
    let mbb_map: &[(&str, &str)] = &[
        ("wifi_onoff", "zte_mbb.wifi.wifi_onoff"),
        ("wifi6_switch", "zte_mbb.wifi.wifi6_switch"),
    ];

    let txpower_keys: &[&str] = &["txpower_2g", "txpower_5g"];

    let mut wireless_changed = false;
    let mut mbb_changed = false;
    let mut only_txpower = true;
    let mut txpower_2g_val: Option<u32> = None;
    let mut txpower_5g_val: Option<u32> = None;

    for (key, value) in obj {
        let val_str = match value {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            Value::Bool(b) => if *b { "1" } else { "0" }.to_string(),
            _ => continue,
        };
        let val_str = sanitize_uci_value(&val_str);

        // Check wireless UCI map
        if let Some(&(_, path)) = uci_map.iter().find(|&&(k, _)| k == key) {
            let current = ubus::uci_get(path).unwrap_or_default();
            if current != val_str {
                if let Err(e) = ubus::uci_set_no_commit(path, &val_str) {
                    return (500, json!({"ok": false, "error": e}));
                }
                wireless_changed = true;
                if !txpower_keys.contains(&key.as_str()) {
                    only_txpower = false;
                } else if key == "txpower_2g" {
                    txpower_2g_val = val_str.parse().ok();
                } else if key == "txpower_5g" {
                    txpower_5g_val = val_str.parse().ok();
                }
            }
            continue;
        }

        // Check mbb map
        if let Some(&(_, path)) = mbb_map.iter().find(|&&(k, _)| k == key) {
            let current = ubus::uci_get(path).unwrap_or_default();
            if current != val_str {
                // mbb keys are firmware-dependent; skip silently if missing
                if ubus::uci_set_no_commit(path, &val_str).is_ok() {
                    mbb_changed = true;
                    only_txpower = false;
                }
            }
        }
    }

    // Commit batched changes
    if wireless_changed {
        if let Err(e) = ubus::uci_commit("wireless") {
            return (500, json!({"ok": false, "error": e}));
        }
    }
    if mbb_changed {
        if let Err(e) = ubus::uci_commit("zte_mbb") {
            return (500, json!({"ok": false, "error": e}));
        }
    }

    if !wireless_changed && !mbb_changed {
        return (
            200,
            json!({"ok": true, "data": {"status": "ok", "note": "no changes"}}),
        );
    }

    // Hot-apply txpower if that's the only change
    if wireless_changed && only_txpower {
        if let Some(val) = txpower_2g_val {
            let _ = Command::new("iw")
                .args([
                    "dev",
                    "wlan0",
                    "set",
                    "txpower",
                    "limit",
                    &(val * 30).to_string(),
                ])
                .output();
        }
        if let Some(val) = txpower_5g_val {
            let _ = Command::new("iw")
                .args([
                    "dev",
                    "wlan2",
                    "set",
                    "txpower",
                    "limit",
                    &(val * 30).to_string(),
                ])
                .output();
        }
        return (
            200,
            json!({"ok": true, "data": {"status": "ok", "hot": true}}),
        );
    }

    // Full reload needed
    if wireless_changed {
        let _ = Command::new("sh")
            .args(["-c", "ubus call zwrt_wlan reload >/dev/null 2>&1 &"])
            .output();
    }

    (200, json!({"ok": true, "data": {"status": "ok"}}))
}

// ---------------------------------------------------------------------------
// GET /api/wifi/guest
// ---------------------------------------------------------------------------

pub fn guest_status(_state: &AppState) -> (u16, Value) {
    let mut result = serde_json::Map::new();

    result.insert("ssid".into(), json!(uci_get_wireless("guest_2g.ssid")));
    result.insert("key".into(), json!(uci_get_wireless("guest_2g.key")));
    result.insert(
        "encryption".into(),
        json!(uci_get_wireless("guest_2g.encryption")),
    );
    result.insert(
        "disabled_2g".into(),
        json!(uci_get_wireless("guest_2g.disabled")),
    );
    result.insert(
        "disabled_5g".into(),
        json!(uci_get_wireless("guest_5g.disabled")),
    );
    result.insert("hidden".into(), json!(uci_get_wireless("guest_2g.hidden")));
    result.insert(
        "isolate".into(),
        json!(uci_get_wireless("guest_2g.isolate")),
    );
    result.insert(
        "guest_active_time".into(),
        json!(uci_get_wireless("guest_2g.guest_active_time")),
    );

    // Runtime remaining time
    let remaining = ubus::call("zwrt_wlan", "wlan_get_guest_access_left_time", Some("{}"))
        .ok()
        .and_then(|v| {
            v["guest_left_time"]
                .as_str()
                .and_then(|s| s.parse::<i64>().ok())
        })
        .unwrap_or(-1);
    result.insert("remaining_seconds".into(), json!(remaining));

    (200, json!({"ok": true, "data": result}))
}

// ---------------------------------------------------------------------------
// PUT /api/wifi/guest
// ---------------------------------------------------------------------------

pub fn guest_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    let obj = match parsed.as_object() {
        Some(o) => o,
        None => return (400, json!({"ok": false, "error": "expected JSON object"})),
    };

    let guest_map: &[(&str, &[&str])] = &[
        (
            "guest_ssid",
            &["wireless.guest_2g.ssid", "wireless.guest_5g.ssid"],
        ),
        (
            "guest_key",
            &["wireless.guest_2g.key", "wireless.guest_5g.key"],
        ),
        (
            "guest_encryption",
            &[
                "wireless.guest_2g.encryption",
                "wireless.guest_5g.encryption",
            ],
        ),
        (
            "guest_disabled",
            &["wireless.guest_2g.disabled", "wireless.guest_5g.disabled"],
        ),
        ("guest_disabled_2g", &["wireless.guest_2g.disabled"]),
        ("guest_disabled_5g", &["wireless.guest_5g.disabled"]),
        (
            "guest_hidden",
            &["wireless.guest_2g.hidden", "wireless.guest_5g.hidden"],
        ),
        (
            "guest_isolate",
            &["wireless.guest_2g.isolate", "wireless.guest_5g.isolate"],
        ),
        (
            "guest_active_time",
            &[
                "wireless.guest_2g.guest_active_time",
                "wireless.guest_5g.guest_active_time",
            ],
        ),
    ];

    let mut changed = false;
    for (key, value) in obj {
        let val_str = match value {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            Value::Bool(b) => if *b { "1" } else { "0" }.to_string(),
            _ => continue,
        };
        let val_str = sanitize_uci_value(&val_str);

        if let Some(&(_, paths)) = guest_map.iter().find(|&&(k, _)| k == key) {
            for &path in paths {
                // Guest interfaces may not exist; skip silently if missing
                if ubus::uci_set_no_commit(path, &val_str).is_ok() {
                    changed = true;
                }
            }
        }
    }

    if !changed {
        return (
            200,
            json!({"ok": true, "data": {"status": "ok", "note": "no changes"}}),
        );
    }

    // Commit batched changes
    if let Err(e) = ubus::uci_commit("wireless") {
        return (500, json!({"ok": false, "error": e}));
    }

    let _ = Command::new("sh")
        .args(["-c", "ubus call zwrt_wlan reload >/dev/null 2>&1 &"])
        .output();

    (200, json!({"ok": true, "data": {"status": "ok"}}))
}
