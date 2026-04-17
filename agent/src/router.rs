use serde_json::{json, Value};

use crate::handlers::AppState;
use crate::ubus;
use crate::validate::validate_ubus_input;

pub fn router_dns_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_router.api", "router_get_dns_para", Some("{}")) {
        Ok(data) => {
            // Firmware returns keys with "wan_" prefix (e.g. wan_dns_mode);
            // strip it so iOS client can use clean names (dns_mode, prefer_dns_manual, etc.)
            let mut cleaned = serde_json::Map::new();
            if let Some(obj) = data.as_object() {
                for (k, v) in obj {
                    let key = k.strip_prefix("wan_").unwrap_or(k).to_string();
                    cleaned.insert(key, v.clone());
                }
            }
            // Firmware bug: sometimes returns empty manual DNS values; fill from UCI
            if cleaned.get("dns_mode").and_then(|v| v.as_str()) == Some("manual") {
                if cleaned
                    .get("prefer_dns_manual")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .is_empty()
                {
                    if let Ok(v) = ubus::uci_get("network.wan.dns") {
                        let mut parts = v.split_whitespace();
                        if let Some(primary) = parts.next() {
                            cleaned.insert(
                                "prefer_dns_manual".into(),
                                Value::String(primary.to_string()),
                            );
                        }
                        if let Some(secondary) = parts.next() {
                            cleaned.insert(
                                "standby_dns_manual".into(),
                                Value::String(secondary.to_string()),
                            );
                        }
                    }
                }
            }
            (200, json!({"ok": true, "data": Value::Object(cleaned)}))
        }
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_dns_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_wan_dns",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_lan_get(_state: &AppState) -> (u16, Value) {
    let ip = ubus::uci_get("network.lan.ipaddr").unwrap_or_default();
    let mask = ubus::uci_get("network.lan.netmask").unwrap_or_default();
    let ignore = ubus::uci_get("dhcp.lan.ignore").unwrap_or_default();
    let start = ubus::uci_get("dhcp.lan.start").unwrap_or_default();
    let limit = ubus::uci_get("dhcp.lan.limit").unwrap_or_default();
    let lease = ubus::uci_get("dhcp.lan.leasetime").unwrap_or_default();
    let end = compute_dhcp_end(&ip, &start, &limit);
    (
        200,
        json!({"ok": true, "data": {
            "lan_ipaddr": ip, "lan_netmask": mask,
            "dhcp_enable": if ignore == "1" { "0" } else { "1" },
            "dhcp_start": start, "dhcp_end": end,
            "dhcp_lease_time": lease
        }}),
    )
}

fn compute_dhcp_end(base_ip: &str, start: &str, limit: &str) -> String {
    let start_num: u32 = start.parse().unwrap_or(100);
    let limit_num: u32 = limit.parse().unwrap_or(50);
    let end_host = start_num + limit_num - 1;
    // Replace last octet of base IP with end_host
    if let Some(prefix) = base_ip.rfind('.') {
        format!("{}.{end_host}", &base_ip[..prefix])
    } else {
        format!("192.168.0.{end_host}")
    }
}

pub fn router_lan_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_lan_para",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_router.api", "router_get_firewall_para", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_switch_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_firewall_switch",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_level_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_firewall_level",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_nat_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_nat_switch",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_dmz_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_dmz",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_upnp_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_router.api", "router_get_upnp_switch", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_upnp_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_upnp_switch",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_port_forward_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_router.api", "router_get_portforward_rule", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_port_forward_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_portforward",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_port_forward_switch(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_portforward_switch",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_firewall_filter_rules(_state: &AppState) -> (u16, Value) {
    match ubus::call(
        "zwrt_router.api",
        "router_get_macipport_filter_rule",
        Some("{}"),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_vpn_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_router.api", "router_get_alg_para", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_vpn_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_alg_switch",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_qos_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_router.api", "router_get_qos_switch", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_qos_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_qos_switch",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_domain_filter_get(_state: &AppState) -> (u16, Value) {
    match ubus::call(
        "zwrt_router.api",
        "router_get_domainfilter_rule",
        Some("{}"),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_domain_filter_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_router.api",
        "router_set_domain_filter",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_apn_mode_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_apn_object", "get_apn_mode", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_apn_mode_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call("zwrt_apn_object", "set_apn_mode", Some(&parsed.to_string())) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_apn_profiles_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_apn_object", "get_manu_apn_list", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_apn_profiles_add(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call("zwrt_apn_object", "add_manu_apn", Some(&parsed.to_string())) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_apn_profiles_modify(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_apn_object",
        "modify_manu_apn",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_apn_auto_profiles(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_apn_object", "get_auto_apn_list", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_apn_profiles_delete(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_apn_object",
        "delete_manu_apn",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn router_apn_profiles_activate(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zwrt_apn_object",
        "enable_manu_apn_id",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}
