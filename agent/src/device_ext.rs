use std::fs;

use serde_json::{json, Value};

use crate::handlers::AppState;
use crate::ubus;

/// GET /api/device/thermal/all — read all useful thermal zones from sysfs
pub fn device_thermal_all(_state: &AppState) -> (u16, Value) {
    let zones: &[(&str, &str)] = &[
        ("cpu_0", "/sys/class/thermal/thermal_zone16/temp"),
        ("cpu_1", "/sys/class/thermal/thermal_zone17/temp"),
        ("cpu_2", "/sys/class/thermal/thermal_zone18/temp"),
        ("cpu_3", "/sys/class/thermal/thermal_zone19/temp"),
        ("modem", "/sys/class/thermal/thermal_zone22/temp"), // mdmq6-0
        ("modem_ss0", "/sys/class/thermal/thermal_zone24/temp"), // mdmss-0
        ("modem_ss1", "/sys/class/thermal/thermal_zone25/temp"), // mdmss-1
        ("modem_ss2", "/sys/class/thermal/thermal_zone26/temp"), // mdmss-2
        ("battery", "/sys/class/thermal/thermal_zone39/temp"),
        ("usb", "/sys/class/thermal/thermal_zone38/temp"),
        ("eth_phy", "/sys/class/thermal/thermal_zone20/temp"), // ethphy-0
        ("pmic", "/sys/class/thermal/thermal_zone28/temp"),    // pmx75_tz
        ("xo_therm", "/sys/class/thermal/thermal_zone35/temp"), // crystal osc (ambient proxy)
        ("pa", "/sys/class/thermal/thermal_zone0/temp"),       // sdr0_pa
        ("sdr", "/sys/class/thermal/thermal_zone1/temp"),      // sdr0
    ];

    let mut data = serde_json::Map::new();
    for (name, path) in zones {
        if let Ok(s) = fs::read_to_string(path) {
            if let Ok(millideg) = s.trim().parse::<i64>() {
                // Skip invalid readings: -273000 = sensor offline, valid range -40°C to +150°C
                if millideg > -40_000 && millideg < 150_000 {
                    let temp_c = millideg as f64 / 1000.0;
                    data.insert(name.to_string(), json!(temp_c));
                }
            }
        }
    }
    data.insert("available".to_string(), json!(!data.is_empty()));
    (200, json!({"ok": true, "data": data}))
}

/// GET /api/device/battery/detail — extended battery stats from sysfs
pub fn device_battery_detail(_state: &AppState) -> (u16, Value) {
    let read_sysfs = |name: &str| -> Option<String> {
        fs::read_to_string(format!("/sys/class/power_supply/battery/{name}"))
            .ok()
            .map(|s| s.trim().to_string())
    };
    let read_i64 = |name: &str| -> Option<i64> { read_sysfs(name)?.parse().ok() };

    let capacity = read_i64("capacity");
    let status = read_sysfs("status");
    let voltage_uv = read_i64("voltage_now");
    let voltage_max_uv = read_i64("voltage_max");
    let voltage_ocv_uv = read_i64("voltage_ocv");
    let current_ua = read_i64("current_now");
    // power_now sysfs is unreliable on PM7550B — compute from V * I instead
    let _ = read_i64("power_now"); // ignore sysfs value
    let temp_tenths = read_i64("temp");
    let charge_type = read_sysfs("charge_type");
    let health = read_sysfs("health");
    let cycle_count = read_i64("cycle_count");
    let charge_counter_uah = read_i64("charge_counter");
    let charge_full_uah = read_i64("charge_full");
    let charge_full_design_uah = read_i64("charge_full_design");
    let time_to_full = read_i64("time_to_full_avg").filter(|value| *value >= 0);
    let time_to_empty = read_i64("time_to_empty_avg").filter(|value| *value >= 0);

    // Compute power from voltage * current (more accurate than sysfs power_now)
    let power_mw = voltage_uv
        .zip(current_ua)
        .map(|(voltage, current)| (voltage as f64 * current as f64 / 1e9) as i64);
    let available = capacity.is_some() || status.is_some() || voltage_uv.is_some();

    (
        200,
        json!({"ok": true, "data": {
            "available": available,
            "capacity": capacity,
            "status": status,
            "voltage_mv": voltage_uv.map(|value| value / 1000),
            "voltage_max_mv": voltage_max_uv.map(|value| value / 1000),
            "voltage_ocv_mv": voltage_ocv_uv.map(|value| value / 1000),
            "current_ma": current_ua.map(|value| value / 1000),
            "power_mw": power_mw,
            "temperature_c": temp_tenths.map(|value| value as f64 / 10.0),
            "charge_type": charge_type,
            "health": health,
            "cycle_count": cycle_count,
            "charge_counter_mah": charge_counter_uah.map(|value| value / 1000),
            "charge_full_mah": charge_full_uah.map(|value| value / 1000),
            "charge_full_design_mah": charge_full_design_uah.map(|value| value / 1000),
            "time_to_full_secs": time_to_full,
            "time_to_empty_secs": time_to_empty,
        }}),
    )
}

pub fn device_charger(_state: &AppState) -> (u16, Value) {
    match ubus::call("zwrt_bsp.charger", "list", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn device_reboot(_state: &AppState) -> (u16, Value) {
    match ubus::call("system", "reboot", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn device_shutdown(_state: &AppState) -> (u16, Value) {
    match ubus::call(
        "zwrt_mc.device.manager",
        "device_poweroff",
        Some(r#"{"moduleName":"zte-agent"}"#),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn agent_restart(_state: &AppState) -> (u16, Value) {
    // Spawn a detached process that waits, then kills and restarts the agent.
    // We respond first so the client gets a 200 before we die.
    let script = "sleep 1; kill $(pidof zte-agent) 2>/dev/null; sleep 1; sh /data/local/tmp/start_zte_agent.sh >/dev/null 2>&1 &";
    match std::process::Command::new("sh")
        .args(["-c", script])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(_) => (
            200,
            json!({"ok": true, "message": "Agent restarting in ~2 seconds"}),
        ),
        Err(e) => (
            500,
            json!({"ok": false, "error": format!("failed to spawn restart: {e}")}),
        ),
    }
}

/// GET /api/device/charge-control — charge stop state + limit enforcer config
pub fn charge_control_get(state: &AppState) -> (u16, Value) {
    let read_sysfs = |path: &str| -> Option<String> {
        fs::read_to_string(path)
            .ok()
            .map(|value| value.trim().to_string())
    };

    let battery_status = read_sysfs("/sys/class/power_supply/battery/status");
    let capacity: Option<i64> =
        read_sysfs("/sys/class/power_supply/battery/capacity").and_then(|value| value.parse().ok());

    // Inverted firmware semantics: direct_power_supply_mode "enable" = charging STOPPED
    let charging_stopped = ubus::call("zwrt_bsp.charger", "list", Some("{}"))
        .ok()
        .and_then(|v| {
            v["direct_power_supply_mode"]
                .as_str()
                .map(|s| s == "enable")
        });
    let battery_available = capacity.is_some() || battery_status.is_some();
    let charger_available = charging_stopped.is_some();

    let (limit_enabled, limit_pct, hysteresis, manual_override) = state.charge_limit.get();

    (
        200,
        json!({
            "ok": true,
            "data": {
                "available": battery_available || charger_available,
                "battery_available": battery_available,
                "charger_available": charger_available,
                "charging_stopped": charging_stopped,
                "battery_status": battery_status,
                "capacity": capacity,
                "charge_limit_enabled": limit_enabled,
                "charge_limit": limit_pct,
                "hysteresis": hysteresis,
                "manual_override": manual_override,
                "last_error": state.charge_limit.last_error(),
            }
        }),
    )
}

/// PUT /api/device/charge-control — manual charge stop/resume and limit config
pub fn charge_control_set(state: &AppState, body: &[u8]) -> (u16, Value) {
    let update: crate::charge_policy::ChargeUpdate = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(e) => {
            return (
                400,
                json!({"ok": false, "error": format!("invalid charge control: {e}")}),
            )
        }
    };
    if let Err(error) = state.charge_limit.update(update) {
        return (503, json!({"ok": false, "error": error}));
    }
    charge_control_get(state)
}
