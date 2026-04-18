use serde_json::{json, Value};

use crate::handlers::AppState;
use crate::ubus;

pub fn network_wan(_state: &AppState) -> (u16, Value) {
    match ubus::call("network.interface.zte_wan", "status", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn network_wan6(_state: &AppState) -> (u16, Value) {
    match ubus::call("network.interface.zte_wan6", "status", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn network_lan_status(_state: &AppState) -> (u16, Value) {
    match ubus::call("network.interface.lan", "status", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn network_clients(_state: &AppState) -> (u16, Value) {
    // Build hostname lookup from DHCP leases
    let mut hostname_by_mac: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    if let Ok(dhcp) = ubus::call("luci-rpc", "getDHCPLeases", Some(r#"{"family":4}"#)) {
        if let Some(leases) = dhcp.get("dhcp_leases").and_then(|v| v.as_array()) {
            for l in leases {
                if let (Some(mac), Some(host)) = (l["macaddr"].as_str(), l["hostname"].as_str()) {
                    if !host.is_empty() {
                        hostname_by_mac.insert(mac.to_lowercase(), host.to_string());
                    }
                }
            }
        }
    }

    // Read ARP table for actually-connected clients (flags 0x2 = complete/reachable)
    let mut clients = Vec::new();
    if let Ok(arp) = std::fs::read_to_string("/proc/net/arp") {
        for line in arp.lines().skip(1) {
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() >= 6 {
                let ip = cols[0];
                let flags = cols[2];
                let mac = cols[3].to_lowercase();
                let dev = cols[5];
                // Skip incomplete entries (flags 0x0) and loopback
                if flags == "0x0" || mac == "00:00:00:00:00:00" {
                    continue;
                }
                // Only LAN interfaces (br-lan, usb0, etc)
                if dev.starts_with("rmnet") {
                    continue;
                }
                let hostname = hostname_by_mac.get(&mac).cloned();
                clients.push(json!({
                    "mac": mac,
                    "ip": ip,
                    "hostname": hostname,
                }));
            }
        }
    }
    (200, json!({"ok": true, "data": { "clients": clients }}))
}

pub fn network_speeds(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_data", "get_wwandst", Some(r#"{"cid":1,"type":1}"#)) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn network_rmnet(_state: &AppState) -> (u16, Value) {
    match ubus::call(
        "network.device",
        "status",
        Some(r#"{"name":"rmnet_data0"}"#),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn network_battery_ubus(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_bsp.battery", "list", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}
