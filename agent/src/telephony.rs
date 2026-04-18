use serde_json::{json, Value};

use crate::at_cmd;
use crate::handlers::AppState;

// ---------------------------------------------------------------------------
// GSM 7-bit default alphabet → UTF-8
// ---------------------------------------------------------------------------

const GSM7_TABLE: &[&str] = &[
    "@", "\u{00A3}", "$", "\u{00A5}", "\u{00E8}", "\u{00E9}", "\u{00F9}", "\u{00EC}", "\u{00F2}",
    "\u{00C7}", "\n", "\u{00D8}", "\u{00F8}", "\r", "\u{00C5}", "\u{00E5}", "_", "_", " ", "!",
    "\"", "#", "\u{00A4}", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/", "0", "1", "2",
    "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?", "\u{00A1}", "A", "B", "C",
    "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
    "W", "X", "Y", "Z", "\u{00C4}", "\u{00D6}", "\u{00D1}", "\u{00DC}", "\u{00A7}", "\u{00BF}",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s",
    "t", "u", "v", "w", "x", "y", "z", "\u{00E4}", "\u{00F6}", "\u{00F1}", "\u{00FC}", "\u{00E0}",
];

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    let mut i = 0;
    while i + 1 < hex.len() {
        if let Ok(b) = u8::from_str_radix(&hex[i..i + 2], 16) {
            bytes.push(b);
        }
        i += 2;
    }
    bytes
}

fn decode_gsm7(hex_str: &str) -> String {
    if hex_str.is_empty() {
        return String::new();
    }
    let bytes = hex_to_bytes(hex_str);
    // Unpack 7-bit septets from 8-bit octets
    let mut septets = Vec::new();
    let mut shift: u32 = 0;
    for (bi, &byte) in bytes.iter().enumerate() {
        let val = if bi > 0 {
            ((byte as u32) << shift) + ((bytes[bi - 1] as u32) >> (8 - shift))
        } else {
            byte as u32
        };
        septets.push((val % 128) as usize);
        shift += 1;
        if shift == 7 {
            septets.push((byte as u32 >> 1) as usize);
            shift = 0;
        }
    }
    let mut out = String::new();
    for s in septets {
        if let Some(&ch) = GSM7_TABLE.get(s) {
            out.push_str(ch);
        }
    }
    out
}

fn decode_ucs2(hex_str: &str) -> String {
    if hex_str.is_empty() {
        return String::new();
    }
    let mut out = String::new();
    let mut i = 0;
    while i + 3 < hex_str.len() {
        if let Ok(cp) = u32::from_str_radix(&hex_str[i..i + 4], 16) {
            if let Some(ch) = char::from_u32(cp) {
                out.push(ch);
            }
        }
        i += 4;
    }
    out
}

fn decode_ussd_response(hex_str: &str, dcs: u32) -> String {
    if hex_str.is_empty() {
        return String::new();
    }
    let coding = dcs % 16;
    if coding == 8 {
        return decode_ucs2(hex_str);
    }
    if coding == 0 || coding == 15 {
        let decoded = decode_gsm7(hex_str);
        if !decoded.is_empty() {
            return decoded;
        }
    }
    // Fallback: plain ASCII hex
    let mut out = String::new();
    let bytes = hex_to_bytes(hex_str);
    for b in &bytes {
        if *b >= 32 && *b < 127 {
            out.push(*b as char);
        }
    }
    if !out.is_empty() {
        return out;
    }
    hex_str.to_string()
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

fn parse_clcc(raw: &str) -> Vec<Value> {
    let dir_names = ["mo", "mt"];
    let stat_names = [
        "active",
        "held",
        "dialing",
        "alerting",
        "incoming",
        "waiting",
        "releasing",
    ];

    let mut calls = Vec::new();
    for line in raw.lines() {
        // +CLCC: idx,dir,stat,mode,mpty[,"number",type]
        let Some(rest) = line.strip_prefix("+CLCC:") else {
            continue;
        };
        let rest = rest.trim();
        let parts: Vec<&str> = rest.splitn(6, ',').collect();
        if parts.len() < 5 {
            continue;
        }
        let id: i64 = parts[0].trim().parse().unwrap_or(-1);
        let dir_i: usize = parts[1].trim().parse().unwrap_or(0);
        let stat_i: usize = parts[2].trim().parse().unwrap_or(0);
        let mode: i64 = parts[3].trim().parse().unwrap_or(0);
        let number = if parts.len() > 5 {
            parts[5].trim().trim_matches('"').to_string()
        } else {
            String::new()
        };
        let dir = dir_names.get(dir_i).unwrap_or(&"unknown");
        let stat = stat_names.get(stat_i).unwrap_or(&"unknown");
        calls.push(json!({
            "id": id,
            "dir": dir,
            "stat": stat,
            "mode": mode,
            "number": number,
        }));
    }
    calls
}

fn parse_cusd(raw: &str) -> Option<(i64, String, u32)> {
    // Look for +CUSD: status[,"body"[,dcs]]
    for line in raw.lines() {
        let Some(rest) = line.strip_prefix("+CUSD:") else {
            continue;
        };
        let rest = rest.trim();
        // Parse status
        let status_end = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        let status: i64 = rest[..status_end].parse().unwrap_or(-1);
        let after_status = &rest[status_end..];

        // Try to extract body between quotes
        let mut body = String::new();
        let mut dcs: u32 = 15;
        if let Some(q1) = after_status.find('"') {
            let after_q1 = &after_status[q1 + 1..];
            if let Some(q2) = after_q1.find('"') {
                body = after_q1[..q2].to_string();
                // Look for dcs after closing quote
                let after_body = &after_q1[q2 + 1..];
                if let Some(comma) = after_body.find(',') {
                    let dcs_str = after_body[comma + 1..].trim();
                    let dcs_end = dcs_str
                        .find(|c: char| !c.is_ascii_digit())
                        .unwrap_or(dcs_str.len());
                    dcs = dcs_str[..dcs_end].parse().unwrap_or(15);
                }
            }
        }
        return Some((status, body, dcs));
    }
    None
}

// ---------------------------------------------------------------------------
// STK TLV parser
// ---------------------------------------------------------------------------

struct StkMenu {
    title: String,
    items: Vec<Value>,
}

fn parse_stk_menu_tlv(hex: &str) -> Option<StkMenu> {
    if hex.is_empty() {
        return None;
    }
    let mut title = String::new();
    let mut items = Vec::new();
    let mut i = 0;
    while i + 4 <= hex.len() {
        let tag = u8::from_str_radix(&hex[i..i + 2], 16).ok()?;
        let len = usize::from_str_radix(&hex[i + 2..i + 4], 16).ok()?;
        let val_start = i + 4;
        let val_end = val_start + len * 2;
        if val_end > hex.len() {
            break;
        }
        let val_hex = &hex[val_start..val_end];
        match tag {
            0x85 => {
                // Alpha identifier (title)
                title = decode_ucs2(val_hex);
                if title.is_empty() {
                    title = decode_hex_ascii(val_hex);
                }
            }
            0x8F => {
                // Item: first byte = item ID, rest = text
                if val_hex.len() >= 4 {
                    let item_id = u8::from_str_radix(&val_hex[..2], 16).unwrap_or(0);
                    let text_hex = &val_hex[2..];
                    let mut label = decode_ucs2(text_hex);
                    if label.is_empty() {
                        label = decode_hex_ascii(text_hex);
                    }
                    items.push(json!({"id": item_id, "label": label}));
                }
            }
            _ => {}
        }
        i = val_end;
    }
    if !items.is_empty() || !title.is_empty() {
        Some(StkMenu { title, items })
    } else {
        None
    }
}

fn decode_hex_ascii(hex: &str) -> String {
    let bytes = hex_to_bytes(hex);
    let mut out = String::new();
    for b in bytes {
        if b >= 32 {
            out.push(b as char);
        }
    }
    out
}

/// Check if the SIM supports STK by reading EF_DIR (AT+CUAD) for STK/USAT AIDs,
/// and falling back to AT+STIN? as a secondary indicator.
fn detect_stk_support(at_port: &crate::at_cmd::AtPort) -> (bool, String) {
    // Check AT+CUAD for SIM application directory
    if let Ok(resp) = at_cmd::send(at_port, "AT+CUAD", 3) {
        if !resp.contains("ERROR") {
            // Look for STK/USAT AID prefix: A000000009
            let upper = resp.to_uppercase();
            if upper.contains("A000000009") {
                return (true, "STK AID found in EF_DIR (AT+CUAD)".into());
            }
            // CUAD responded but no STK AID
            // Fall through to STIN check
        }
    }

    // Secondary: check AT+STIN? — if the modem returns any STIN value, STK is active
    if let Ok(resp) = at_cmd::send(at_port, "AT+STIN?", 2) {
        if resp.contains("STIN") && !resp.contains("ERROR") {
            return (true, "STK indicated by AT+STIN? response".into());
        }
    }

    (
        false,
        "No STK AID in EF_DIR and no STIN response — SIM does not support STK".into(),
    )
}

fn format_ussd_response(parsed: (i64, String, u32)) -> Value {
    let (status, body, dcs) = parsed;
    let decoded = decode_ussd_response(&body, dcs);
    let response = if decoded.is_empty() { &body } else { &decoded };
    let session_active = status == 1;
    json!({
        "response": response,
        "raw_response": body,
        "status": status,
        "dcs": dcs,
        "session_active": session_active,
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// POST /api/call/dial — body: {"number": "..."}
pub fn call_dial(state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    let number = match parsed["number"].as_str() {
        Some(n) if !n.is_empty() => n,
        _ => return (400, json!({"ok": false, "error": "missing number"})),
    };
    // Sanitize: keep digits, +, *, #
    let clean: String = number
        .chars()
        .filter(|c| c.is_ascii_digit() || "+*#".contains(*c))
        .collect();
    match at_cmd::send(&state.at_port, &format!("ATD{clean};"), 5) {
        Ok(resp) if resp.contains("ERROR") => (500, json!({"ok": false, "error": "dial failed"})),
        Ok(_) => (200, json!({"ok": true, "data": {"status": "ok"}})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// POST /api/call/hangup
pub fn call_hangup(state: &AppState) -> (u16, Value) {
    match at_cmd::send(&state.at_port, "AT+CHUP", 3) {
        Ok(_) => (200, json!({"ok": true, "data": {"status": "ok"}})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// POST /api/call/answer
pub fn call_answer(state: &AppState) -> (u16, Value) {
    match at_cmd::send(&state.at_port, "ATA", 3) {
        Ok(_) => (200, json!({"ok": true, "data": {"status": "ok"}})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// GET /api/call/status
pub fn call_status(state: &AppState) -> (u16, Value) {
    match at_cmd::send(&state.at_port, "AT+CLCC", 2) {
        Ok(resp) => {
            let calls = parse_clcc(&resp);
            (200, json!({"ok": true, "data": {"calls": calls}}))
        }
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// POST /api/call/dtmf — body: {"digits": "123"}
pub fn call_dtmf(state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    let digits = match parsed["digits"].as_str() {
        Some(d) if !d.is_empty() => d,
        _ => return (400, json!({"ok": false, "error": "missing digits"})),
    };
    let cmds: Vec<String> = digits
        .chars()
        .filter(|c| c.is_ascii_digit() || "*#ABCD".contains(*c))
        .map(|d| format!("+VTS={d}"))
        .collect();
    if cmds.is_empty() {
        return (400, json!({"ok": false, "error": "no valid digits"}));
    }
    let at_cmd_str = format!("AT{}", cmds.join(";"));
    match at_cmd::send(&state.at_port, &at_cmd_str, 2) {
        Ok(_) => (200, json!({"ok": true, "data": {"status": "ok"}})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// POST /api/call/mute — body: {"enabled": true/false}
pub fn call_mute(state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    let enabled = parsed["enabled"].as_bool().unwrap_or(false);
    let val = if enabled { "1" } else { "0" };
    match at_cmd::send(&state.at_port, &format!("AT+CMUT={val}"), 2) {
        Ok(_) => (200, json!({"ok": true, "data": {"muted": enabled}})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// POST /api/ussd/send — body: {"code": "*123#"}
pub fn ussd_send(state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    let code = match parsed["code"].as_str() {
        Some(c) if !c.is_empty() => c,
        _ => return (400, json!({"ok": false, "error": "missing code"})),
    };
    let clean: String = code
        .chars()
        .filter(|c| c.is_ascii_digit() || "*#+".contains(*c))
        .collect();
    let at = format!("AT+CUSD=1,\"{clean}\",15");
    match at_cmd::send(&state.at_port, &at, 8) {
        Ok(resp) => {
            if resp.contains("ERROR") {
                return (500, json!({"ok": false, "error": "USSD failed"}));
            }
            match parse_cusd(&resp) {
                Some(parsed) => (
                    200,
                    json!({"ok": true, "data": format_ussd_response(parsed)}),
                ),
                None => {
                    let clean_resp: String = resp.chars().filter(|c| !c.is_control()).collect();
                    (
                        200,
                        json!({"ok": true, "data": {
                            "response": clean_resp,
                            "raw_response": clean_resp,
                            "status": -1,
                            "dcs": 15,
                            "session_active": false,
                        }}),
                    )
                }
            }
        }
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// POST /api/ussd/respond — body: {"reply": "1"}
pub fn ussd_respond(state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    let reply = match parsed["reply"].as_str() {
        Some(r) if !r.is_empty() => r,
        _ => return (400, json!({"ok": false, "error": "missing reply"})),
    };
    let clean: String = reply
        .chars()
        .filter(|c| c.is_ascii_digit() || "*#+".contains(*c))
        .collect();
    let at = format!("AT+CUSD=1,\"{clean}\",15");
    match at_cmd::send(&state.at_port, &at, 8) {
        Ok(resp) => match parse_cusd(&resp) {
            Some(parsed) => (
                200,
                json!({"ok": true, "data": format_ussd_response(parsed)}),
            ),
            None => {
                let clean_resp: String = resp.chars().filter(|c| !c.is_control()).collect();
                (
                    200,
                    json!({"ok": true, "data": {
                        "response": clean_resp,
                        "raw_response": clean_resp,
                        "status": -1,
                        "dcs": 15,
                        "session_active": false,
                    }}),
                )
            }
        },
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// POST /api/ussd/cancel
pub fn ussd_cancel(state: &AppState) -> (u16, Value) {
    match at_cmd::send(&state.at_port, "AT+CUSD=2", 3) {
        Ok(_) => (200, json!({"ok": true, "data": {"status": "ok"}})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// GET /api/stk/menu
pub fn stk_menu(state: &AppState) -> (u16, Value) {
    let (supported, diag) = detect_stk_support(&state.at_port);

    if !supported {
        return (
            200,
            json!({"ok": true, "data": {
                "supported": false,
                "items": [],
                "reason": diag,
            }}),
        );
    }

    let mut diagnostics = vec![diag];

    // Try AT+CUSATD first
    if let Ok(resp) = at_cmd::send(&state.at_port, "AT+CUSATD=1", 5) {
        if !resp.contains("ERROR") {
            let hex = extract_hex(&resp, "CUSATD:");
            if let Some(hex) = hex {
                if let Some(menu) = parse_stk_menu_tlv(&hex) {
                    return (
                        200,
                        json!({"ok": true, "data": {
                            "supported": true,
                            "title": menu.title,
                            "items": menu.items,
                            "source": "at_cusatd",
                        }}),
                    );
                }
            }
            diagnostics.push("AT+CUSATD=1 responded but no parseable menu".into());
        } else {
            diagnostics.push("AT+CUSATD=1 returned ERROR".into());
        }
    }

    // Try AT+STIN? / AT+STGI fallback
    if let Ok(resp) = at_cmd::send(&state.at_port, "AT+STIN?", 3) {
        if resp.contains("STIN") {
            let stin_type = extract_number_after(&resp, "STIN:");
            if stin_type == Some(37) || stin_type == Some(25) {
                let stin_val = stin_type.unwrap();
                if let Ok(stgi) = at_cmd::send(&state.at_port, &format!("AT+STGI={stin_val}"), 5) {
                    if !stgi.contains("ERROR") {
                        let (title, items) = parse_stgi_response(&stgi);
                        if !items.is_empty() {
                            return (
                                200,
                                json!({"ok": true, "data": {
                                    "supported": true,
                                    "title": title,
                                    "items": items,
                                    "source": "at_stgi",
                                }}),
                            );
                        }
                    }
                }
            }
            diagnostics.push(format!(
                "AT+STIN? returned type {:?}, no menu from STGI",
                stin_type
            ));
        }
    }

    // STK supported but no menu currently available
    (
        200,
        json!({"ok": true, "data": {
            "supported": true,
            "items": [],
            "reason": "no proactive command pending",
            "diagnostics": diagnostics,
        }}),
    )
}

/// POST /api/stk/select — body: {"item_id": 1}
pub fn stk_select(state: &AppState, body: &[u8]) -> (u16, Value) {
    let (supported, diag) = detect_stk_support(&state.at_port);
    if !supported {
        return (
            200,
            json!({"ok": true, "data": {
                "supported": false,
                "reason": diag,
            }}),
        );
    }

    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    let item_id = match parsed["item_id"].as_u64() {
        Some(id) => id as u8,
        None => return (400, json!({"ok": false, "error": "missing item_id"})),
    };
    let envelope = format!("D30782020181900101{item_id:02X}");

    if let Ok(resp) = at_cmd::send(&state.at_port, &format!("AT+CUSATE=\"{envelope}\""), 8) {
        if !resp.contains("ERROR") {
            let hex = extract_hex(&resp, "CUSATE:");
            if let Some(hex) = hex {
                if let Some(menu) = parse_stk_menu_tlv(&hex) {
                    if !menu.items.is_empty() {
                        return (
                            200,
                            json!({"ok": true, "data": {
                                "type": "menu",
                                "title": menu.title,
                                "items": menu.items,
                                "source": "at_cusate",
                            }}),
                        );
                    }
                }
            }
            let text: String = resp.chars().filter(|c| !c.is_control()).collect();
            return (
                200,
                json!({"ok": true, "data": {
                    "type": "display",
                    "data": text,
                }}),
            );
        }
    }
    (500, json!({"ok": false, "error": "item selection failed"}))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_hex(resp: &str, prefix: &str) -> Option<String> {
    for line in resp.lines() {
        if let Some(rest) = line.strip_prefix(prefix) {
            let hex: String = rest
                .trim()
                .chars()
                .filter(|c| c.is_ascii_hexdigit())
                .collect();
            if hex.len() >= 4 {
                return Some(hex);
            }
        }
    }
    // Fallback: find any long hex string in response
    for line in resp.lines() {
        let trimmed = line.trim();
        if trimmed.len() >= 8 && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
            return Some(trimmed.to_string());
        }
    }
    None
}

fn extract_number_after(resp: &str, prefix: &str) -> Option<i64> {
    for line in resp.lines() {
        if let Some(rest) = line.strip_prefix(prefix) {
            let num_str: String = rest
                .trim()
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            return num_str.parse().ok();
        }
    }
    None
}

fn parse_stgi_response(stgi: &str) -> (String, Vec<Value>) {
    let mut title = "SIM Menu".to_string();
    let mut items = Vec::new();
    let mut first = true;
    for line in stgi.lines() {
        let Some(rest) = line.strip_prefix("STGI:") else {
            continue;
        };
        let rest = rest.trim();
        if first {
            // First STGI line is the title
            if let Some(t) = rest.strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
                title = t.to_string();
            }
            first = false;
            continue;
        }
        // Item lines: id,type,"label"
        let parts: Vec<&str> = rest.splitn(3, ',').collect();
        if parts.len() >= 3 {
            let id: u64 = parts[0].trim().parse().unwrap_or(0);
            let label = parts[2].trim().trim_matches('"').to_string();
            items.push(json!({"id": id, "label": label}));
        }
    }
    (title, items)
}
