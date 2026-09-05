//! Radio selection: network mode, band locking and cell locking.
//! All of it is driven by the dashboard's Signal → Mode & Locking tab.

use serde::Deserialize;
use serde_json::{json, Value};

use crate::handlers::AppState;
use crate::ubus;
use crate::validate::validate_ubus_input;

pub const LTE_BANDS: &[u8] = &[
    1, 2, 3, 4, 5, 7, 8, 18, 19, 20, 26, 28, 29, 32, 34, 38, 39, 40, 41, 42, 43, 48, 66, 71,
];
pub const NR_BANDS: &[u8] = &[
    1, 2, 3, 5, 7, 8, 18, 20, 26, 28, 29, 38, 40, 41, 48, 66, 71, 75, 77, 78, 79,
];
pub const NETWORK_MODES: &[(&str, &str)] = &[
    ("WL_AND_5G", "5G / 4G / 3G"),
    ("LTE_AND_5G", "5G NSA"),
    ("Only_5G", "5G SA"),
    ("WCDMA_AND_LTE", "4G / 3G"),
    ("Only_LTE", "4G only"),
    ("Only_WCDMA", "3G only"),
];

pub fn modem_capabilities(_state: &AppState) -> (u16, Value) {
    let network_modes: Vec<Value> = NETWORK_MODES
        .iter()
        .map(|(value, label)| json!({"value": value, "label": label}))
        .collect();
    (
        200,
        json!({"ok": true, "data": {
            "network_modes": network_modes,
            "lte_bands": LTE_BANDS,
            "nr_sa_bands": NR_BANDS,
            "nr_nsa_band_lock_supported": false,
        }}),
    )
}

pub fn cell_lock_nr(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zte_nwinfo_api",
        "nwinfo_lock_nr_cell",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn cell_lock_lte(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return (400, json!({"ok": false, "error": "invalid JSON"})),
    };
    if let Err(e) = validate_ubus_input(&parsed) {
        return (400, json!({"ok": false, "error": e}));
    }
    match ubus::call(
        "zte_nwinfo_api",
        "nwinfo_lock_lte_cell",
        Some(&parsed.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn cell_lock_reset(_state: &AppState) -> (u16, Value) {
    match ubus::call(
        "zte_nwinfo_api",
        "nwinfo_reset_band_cell_setting",
        Some("{}"),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

pub fn cell_band_nr(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: NrBandLock = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(e) => {
            return (
                400,
                json!({"ok": false, "error": format!("invalid NR band selection: {e}")}),
            )
        }
    };
    if let Err(e) = parsed.validate() {
        return (400, json!({"ok": false, "error": e}));
    }
    let params = json!({"nr5g_type": "SA", "nr5g_band": parsed.nr5g_band}).to_string();
    eprintln!("[INFO] [band_nr] ubus call zte_nwinfo_api nwinfo_set_nrbandlock '{params}'");
    match ubus::call("zte_nwinfo_api", "nwinfo_set_nrbandlock", Some(&params)) {
        Ok(data) => {
            eprintln!("[INFO] [band_nr] success: {data}");
            (200, json!({"ok": true, "data": data}))
        }
        Err(e) => {
            eprintln!("[WARN] [band_nr] error: {e}");
            (503, json!({"ok": false, "error": e}))
        }
    }
}

pub fn cell_band_lte(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: LteBandLock = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(e) => {
            return (
                400,
                json!({"ok": false, "error": format!("invalid LTE band selection: {e}")}),
            )
        }
    };
    if let Err(e) = parsed.validate() {
        return (400, json!({"ok": false, "error": e}));
    }
    let params = json!({
        "is_lte_band": "1",
        "lte_band_mask": parsed.lte_band_mask,
        "is_gw_band": "0",
        "gw_band_mask": "0",
    })
    .to_string();
    eprintln!("[INFO] [band_lte] ubus call zte_nwinfo_api nwinfo_set_gwl_bandlock '{params}'");
    match ubus::call("zte_nwinfo_api", "nwinfo_set_gwl_bandlock", Some(&params)) {
        Ok(data) => {
            eprintln!("[INFO] [band_lte] success: {data}");
            (200, json!({"ok": true, "data": data}))
        }
        Err(e) => {
            eprintln!("[WARN] [band_lte] error: {e}");
            (503, json!({"ok": false, "error": e}))
        }
    }
}

pub fn cell_band_reset(_state: &AppState) -> (u16, Value) {
    match ubus::call("zte_nwinfo_api", "nwinfo_rest_band_rat", Some("{}")) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

/// PUT /api/modem/network-mode — preferred RAT (5G SA/NSA, LTE-only, …).
pub fn modem_network_mode_set(_state: &AppState, body: &[u8]) -> (u16, Value) {
    let parsed: NetworkMode = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(e) => {
            return (
                400,
                json!({"ok": false, "error": format!("invalid network mode: {e}")}),
            )
        }
    };
    if !NETWORK_MODES
        .iter()
        .any(|(mode, _)| *mode == parsed.net_select)
    {
        return (
            400,
            json!({"ok": false, "error": "network mode is not supported by U60 Pro firmware"}),
        );
    }
    let payload = json!({"net_select": parsed.net_select});
    match ubus::call(
        "zte_nwinfo_api",
        "nwinfo_set_netselect",
        Some(&payload.to_string()),
    ) {
        Ok(data) => (200, json!({"ok": true, "data": data})),
        Err(e) => (503, json!({"ok": false, "error": e})),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NetworkMode {
    net_select: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NrBandLock {
    nr5g_type: String,
    nr5g_band: String,
}

impl NrBandLock {
    fn validate(&self) -> Result<(), String> {
        if self.nr5g_type != "SA" {
            return Err("this firmware only supports NR band locking in SA mode".to_string());
        }
        let bands = parse_band_list(&self.nr5g_band)?;
        if bands.iter().any(|band| !NR_BANDS.contains(band)) {
            return Err(
                "NR selection contains a band not supported by U60 Pro firmware".to_string(),
            );
        }
        Ok(())
    }
}

fn parse_band_list(value: &str) -> Result<Vec<u8>, String> {
    let bands: Vec<u8> = value
        .split(',')
        .map(str::trim)
        .map(|band| {
            band.parse::<u8>()
                .map_err(|_| "band list must contain comma-separated numbers".to_string())
        })
        .collect::<Result<_, _>>()?;
    if bands.is_empty() || bands.len() > NR_BANDS.len() {
        return Err("select at least one band".to_string());
    }
    let mut unique = bands.clone();
    unique.sort_unstable();
    unique.dedup();
    if unique.len() != bands.len() {
        return Err("band list contains duplicates".to_string());
    }
    Ok(bands)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LteBandLock {
    is_lte_band: String,
    lte_band_mask: String,
    is_gw_band: String,
    gw_band_mask: String,
}

impl LteBandLock {
    fn validate(&self) -> Result<(), String> {
        if self.is_lte_band != "1" || self.is_gw_band != "0" || self.gw_band_mask != "0" {
            return Err("LTE band request does not match the firmware contract".to_string());
        }
        let mask = self
            .lte_band_mask
            .parse::<u128>()
            .map_err(|_| "lte_band_mask must be a decimal bitmask".to_string())?;
        let allowed_mask = LTE_BANDS
            .iter()
            .fold(0_u128, |allowed, band| allowed | (1_u128 << (band - 1)));
        if mask == 0 || mask & !allowed_mask != 0 {
            return Err(
                "LTE mask is empty or contains a band not supported by U60 Pro firmware"
                    .to_string(),
            );
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn firmware_capability_lists_are_exact() {
        assert!(LTE_BANDS.contains(&71));
        assert!(!LTE_BANDS.contains(&12));
        assert!(NR_BANDS.contains(&79));
        assert!(NETWORK_MODES
            .iter()
            .any(|(mode, _)| *mode == "WCDMA_AND_LTE"));
    }

    #[test]
    fn band_validation_rejects_unsupported_choices() {
        assert!(NrBandLock {
            nr5g_type: "SA".into(),
            nr5g_band: "1,78".into()
        }
        .validate()
        .is_ok());
        assert!(NrBandLock {
            nr5g_type: "SA".into(),
            nr5g_band: "12".into()
        }
        .validate()
        .is_err());
        let valid_mask = ((1_u128 << 0) | (1_u128 << 70)).to_string();
        assert!(LteBandLock {
            is_lte_band: "1".into(),
            lte_band_mask: valid_mask,
            is_gw_band: "0".into(),
            gw_band_mask: "0".into(),
        }
        .validate()
        .is_ok());
    }
}
