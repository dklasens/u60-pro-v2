use serde_json::{json, Value};

use crate::handlers::AppState;
use crate::ubus;
use crate::validate::validate_ubus_input;

pub fn modem_data_get(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_data", "get_wwaniface", Some(r#"{"cid":1}"#)) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn modem_data_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call("zwrt_data", "set_wwaniface", Some(&parsed.to_string())) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn modem_airplane(state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    // Use AT+CFUN=1 for ONLINE (ubus nwinfo_set_mode ONLINE is broken for LPM→ONLINE recovery)
    if parsed["operate_mode"].as_str() == Some("ONLINE") {
        return crate::handlers::modem_online(state);
    }
    match ubus::call(
        "zte_nwinfo_api",
        "nwinfo_set_mode",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn modem_network_mode_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zte_nwinfo_api",
        "nwinfo_set_netselect",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn modem_scan(_state: &AppState) -> (u16, Value) {
    match ubus::call("zte_nwinfo_api", "nwinfo_manual_scan", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn modem_scan_status(_state: &AppState) -> (u16, Value) {
    match ubus::call("zte_nwinfo_api", "nwinfo_m_netselect_status", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn modem_scan_results(_state: &AppState) -> (u16, Value) {
    match ubus::call("zte_nwinfo_api", "nwinfo_m_netselect_contents", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn modem_register(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zte_nwinfo_api",
        "nwinfo_manual_register",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn modem_register_result(_state: &AppState) -> (u16, Value) {
    match ubus::call("zte_nwinfo_api", "nwinfo_m_netselect_result", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}
