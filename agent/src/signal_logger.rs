use crate::csv_utils::{chrono_lite, csv_escape, str_field};
use crate::handlers::AppState;
use serde_json::Value;
pub type SignalLogger = crate::logging::Session;
pub const LOG_PATH: &str = "/data/local/tmp/signal_log.csv";

const HEADER: &str = "timestamp,datetime,network_type,carrier,cell_id,lte_band,lte_pci,lte_earfcn,lte_rsrp,lte_rsrq,lte_sinr,lte_rssi,nr_band,nr_pci,nr_arfcn,nr_rsrp,nr_rsrq,nr_sinr,nr_rssi,lte_ca_bands,nr_ca_bands";

fn format_row(ts: u64, data: &Value) -> String {
    // Parse LTE CA band list from lteca string
    let lteca = str_field(data, "lteca");
    let lte_ca: Vec<String> = lteca
        .split(';')
        .filter(|s| !s.is_empty())
        .filter_map(|seg| seg.split(',').nth(1).map(|b| format!("B{b}")))
        .collect();

    // Parse NR CA band list from nrca string
    let nrca = str_field(data, "nrca");
    let nr_ca: Vec<String> = nrca
        .split(';')
        .filter(|s| !s.is_empty())
        .filter_map(|seg| seg.split(',').nth(3).map(|b| format!("n{b}")))
        .collect();

    // ISO 8601 timestamp
    let dt = chrono_lite(ts);

    format!(
        "{ts},{dt},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}",
        csv_escape(&str_field(data, "network_type")),
        csv_escape(&str_field(data, "network_provider_fullname")),
        str_field(data, "cell_id"),
        csv_escape(&str_field(data, "wan_active_band")),
        str_field(data, "lte_pci"),
        str_field(data, "wan_active_channel"),
        str_field(data, "lte_rsrp"),
        str_field(data, "lte_rsrq"),
        str_field(data, "lte_snr"),
        str_field(data, "lte_rssi"),
        csv_escape(&str_field(data, "nr5g_action_band")),
        str_field(data, "nr5g_pci"),
        str_field(data, "nr5g_action_channel"),
        str_field(data, "nr5g_rsrp"),
        str_field(data, "nr5g_rsrq"),
        str_field(data, "nr5g_snr"),
        str_field(data, "nr5g_rssi"),
        csv_escape(&lte_ca.join("+")),
        csv_escape(&nr_ca.join("+")),
    )
}

pub fn start_logging(state: &AppState, body: &[u8]) -> (u16, Value) {
    state.signal_logger.start(
        body,
        state.radio.clone(),
        LOG_PATH,
        HEADER,
        |ts, data, _| vec![format_row(ts, data)],
    )
}
pub fn stop_logging(state: &AppState) -> (u16, Value) {
    state.signal_logger.stop()
}
pub fn status(state: &AppState) -> (u16, Value) {
    state.signal_logger.status("samples")
}
