use serde_json::Value;

const MAX_DEPTH: usize = 8;
const MAX_STRING_LEN: usize = 4096;
const MAX_KEYS: usize = 64;
const MAX_ARRAY_LEN: usize = 256;

pub fn validate_ubus_input(value: &Value) -> Result<(), String> {
    match value {
        Value::Object(_) | Value::Array(_) => check_depth(value, 0),
        Value::Null => Err("expected JSON object or array, got null".into()),
        _ => Err("expected JSON object or array".into()),
    }
}

fn check_depth(v: &Value, depth: usize) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Err("JSON nesting too deep".into());
    }
    match v {
        Value::Object(map) => {
            if map.len() > MAX_KEYS {
                return Err(format!("too many keys ({})", map.len()));
            }
            for val in map.values() {
                check_depth(val, depth + 1)?;
            }
        }
        Value::Array(arr) => {
            if arr.len() > MAX_ARRAY_LEN {
                return Err(format!("array too large ({})", arr.len()));
            }
            for val in arr {
                check_depth(val, depth + 1)?;
            }
        }
        Value::String(s) if s.len() > MAX_STRING_LEN => {
            return Err(format!("string too long ({})", s.len()));
        }
        _ => {}
    }
    Ok(())
}
