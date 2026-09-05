use crate::process::BoundedCommand;
use std::process::Command;
use std::thread;
use std::time::Duration;

use serde::Deserialize;
use serde_json::{json, Value};

use crate::handlers::AppState;
use crate::ubus;

const STOCK_WMS_OBJECT: &str = "zwrt_wms";
const SMS_MEMORY_STORE: u8 = 1;
const SMS_ALL_TAGS: u8 = 10;

fn wms_object() -> String {
    std::env::var("ZTE_AGENT_WMS_OBJECT").unwrap_or_else(|_| STOCK_WMS_OBJECT.to_string())
}

fn value_i64(value: Option<&Value>) -> Option<i64> {
    match value? {
        Value::Number(value) => value.as_i64(),
        Value::String(value) => value.parse().ok(),
        _ => None,
    }
}

fn command_status(object: &str, command: u8) -> Result<i64, String> {
    let payload = json!({"sms_cmd": command}).to_string();
    let response = ubus::call(object, "zwrt_wms_get_cmd_status", Some(&payload))?;
    value_i64(response.get("sms_cmd_status_result"))
        .ok_or_else(|| "WMS returned no command status".to_string())
}

pub fn sms_capabilities(_state: &AppState) -> (u16, Value) {
    let object = wms_object();
    match command_status(&object, 1) {
        Ok(3) => (
            200,
            json!({"ok": true, "data": {
                "available": true,
                "ready": true,
                "object": object,
                "storage": "native",
            }}),
        ),
        Ok(status) => (
            200,
            json!({"ok": true, "data": {
                "available": false,
                "ready": false,
                "object": object,
                "reason": format!("WMS is not ready (status {status})"),
            }}),
        ),
        Err(error) => (
            200,
            json!({"ok": true, "data": {
                "available": false,
                "ready": false,
                "object": object,
                "reason": error,
            }}),
        ),
    }
}

#[derive(Deserialize)]
#[serde(default, deny_unknown_fields)]
struct SmsListRequest {
    page: u16,
    per_page: u16,
}

impl Default for SmsListRequest {
    fn default() -> Self {
        Self {
            page: 0,
            per_page: 500,
        }
    }
}

pub fn sms_list(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let request: SmsListRequest = if body.is_empty() {
        SmsListRequest::default()
    } else {
        match serde_json::from_slice(body) {
            Ok(value) => value,
            Err(error) => {
                return (
                    400,
                    json!({"ok": false, "error": format!("invalid SMS list request: {error}")}),
                )
            }
        }
    };
    if request.per_page == 0 || request.per_page > 500 {
        return (
            400,
            json!({"ok": false, "error": "per_page must be between 1 and 500"}),
        );
    }
    let payload = json!({
        "page": request.page,
        "data_per_page": request.per_page,
        "mem_store": SMS_MEMORY_STORE,
        "tags": SMS_ALL_TAGS,
        "order_by": "order by id desc",
    });
    match ubus::call(
        &wms_object(),
        "zte_libwms_get_sms_data",
        Some(&payload.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(error) => (503, json!({"ok": false, "error": error})),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SmsSendRequest {
    number: String,
    message: String,
}

fn validate_recipient(number: &str) -> Result<(), String> {
    if number.is_empty()
        || number.len() > 32
        || !number
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'+' | b'*' | b'#'))
    {
        return Err(
            "recipient must contain only digits, +, * or # and be at most 32 characters"
                .to_string(),
        );
    }
    Ok(())
}

fn encode_message(message: &str) -> String {
    message
        .chars()
        .map(|character| format!("{:04X}", character as u32))
        .collect()
}

fn encode_type(message: &str) -> &'static str {
    // A conservative subset of GSM 03.38. Anything else is sent as Unicode,
    // which is also what the stock UI does when a character is absent from
    // its GSM7 table.
    const GSM7: &str = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€";
    if message.chars().all(|character| GSM7.contains(character)) {
        "GSM7_default"
    } else {
        "UNICODE"
    }
}

fn sms_timestamp() -> Result<String, String> {
    let output = Command::new("date")
        .arg("+%y;%m;%d;%H;%M;%S;%z")
        .bounded_output()
        .map_err(|error| format!("date exec: {error}"))?;
    if !output.status.success() {
        return Err("cannot generate SMS timestamp".to_string());
    }
    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let Some((prefix, zone)) = raw.rsplit_once(';') else {
        return Err("invalid local timestamp".to_string());
    };
    if zone.len() != 5 {
        return Err("invalid timezone offset".to_string());
    }
    let sign = &zone[..1];
    let hours: f64 = zone[1..3]
        .parse::<f64>()
        .map_err(|_| "invalid timezone hours")?;
    let minutes: f64 = zone[3..5]
        .parse::<f64>()
        .map_err(|_| "invalid timezone minutes")?;
    let offset = hours + minutes / 60.0;
    let offset = if offset.fract() == 0.0 {
        format!("{sign}{}", offset as i32)
    } else {
        format!("{sign}{offset}")
    };
    Ok(format!("{prefix};{offset}"))
}

fn wait_for_command(object: &str, command: u8) -> Result<(), String> {
    for _ in 0..20 {
        thread::sleep(Duration::from_millis(500));
        match command_status(object, command)? {
            3 => return Ok(()),
            2 => return Err(format!("WMS command {command} failed")),
            _ => {}
        }
    }
    Err(format!("WMS command {command} timed out"))
}

pub fn sms_send(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let request: SmsSendRequest = match serde_json::from_slice(body) {
        Ok(value) => value,
        Err(error) => {
            return (
                400,
                json!({"ok": false, "error": format!("invalid SMS: {error}")}),
            )
        }
    };
    if let Err(error) = validate_recipient(&request.number) {
        return (400, json!({"ok": false, "error": error}));
    }
    let length = request.message.chars().count();
    if length == 0 || length > 160 || request.message.chars().any(|character| character == '\0') {
        return (
            400,
            json!({"ok": false, "error": "message must contain 1 to 160 characters"}),
        );
    }
    let payload = json!({
        "number": request.number,
        "sms_time": match sms_timestamp() {
            Ok(value) => value,
            Err(error) => return (500, json!({"ok": false, "error": error})),
        },
        "message_body": encode_message(&request.message),
        "id": "-1",
        "encode_type": encode_type(&request.message),
    });
    let object = wms_object();
    if let Err(error) = ubus::call(&object, "zte_libwms_send_sms", Some(&payload.to_string())) {
        return (503, json!({"ok": false, "error": error}));
    }
    match wait_for_command(&object, 4) {
        Ok(()) => (200, json!({"ok": true, "data": {"result": "success"}})),
        Err(error) => (503, json!({"ok": false, "error": error})),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SmsIds {
    ids: Vec<u64>,
}

fn ids_payload(ids: &[u64]) -> Result<String, String> {
    if ids.is_empty() || ids.len() > 100 || ids.contains(&0) {
        return Err("ids must contain between 1 and 100 positive message identifiers".to_string());
    }
    Ok(ids.iter().map(|id| format!("{id};")).collect())
}

pub fn sms_delete(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let request: SmsIds = match serde_json::from_slice(body) {
        Ok(value) => value,
        Err(error) => {
            return (
                400,
                json!({"ok": false, "error": format!("invalid SMS ids: {error}")}),
            )
        }
    };
    let ids = match ids_payload(&request.ids) {
        Ok(ids) => ids,
        Err(error) => return (400, json!({"ok": false, "error": error})),
    };
    let object = wms_object();
    if let Err(error) = ubus::call(
        &object,
        "zwrt_wms_delete_sms",
        Some(&json!({"id": ids}).to_string()),
    ) {
        return (503, json!({"ok": false, "error": error}));
    }
    match wait_for_command(&object, 6) {
        Ok(()) => (200, json!({"ok": true, "data": {"result": "success"}})),
        Err(error) => (503, json!({"ok": false, "error": error})),
    }
}

pub fn sms_mark_read(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let request: SmsIds = match serde_json::from_slice(body) {
        Ok(value) => value,
        Err(error) => {
            return (
                400,
                json!({"ok": false, "error": format!("invalid SMS ids: {error}")}),
            )
        }
    };
    let ids = match ids_payload(&request.ids) {
        Ok(ids) => ids,
        Err(error) => return (400, json!({"ok": false, "error": error})),
    };
    match ubus::call(
        &wms_object(),
        "zwrt_wms_modify_tag",
        Some(&json!({"id": ids, "tag": 0}).to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(error) => (503, json!({"ok": false, "error": error})),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stock_ucs_encoding_handles_ascii_and_astral_unicode() {
        assert_eq!(encode_message("Hi"), "00480069");
        assert_eq!(encode_message("😀"), "1F600");
        assert_eq!(encode_type("Hello"), "GSM7_default");
        assert_eq!(encode_type("你好"), "UNICODE");
    }

    #[test]
    fn legacy_id_payload_is_generated_only_from_typed_ids() {
        assert_eq!(ids_payload(&[12, 34]).unwrap(), "12;34;");
        assert!(ids_payload(&[]).is_err());
        assert!(ids_payload(&[0]).is_err());
    }

    #[test]
    fn recipient_validation_blocks_arbitrary_wms_input() {
        assert!(validate_recipient("+61400000000").is_ok());
        assert!(validate_recipient("123; reboot").is_err());
    }
}
