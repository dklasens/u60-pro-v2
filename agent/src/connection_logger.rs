use crate::csv_utils::{chrono_lite, csv_escape, str_field};
use crate::handlers::AppState;
use serde_json::Value;
pub type ConnectionLogger = crate::logging::Session;
pub const LOG_PATH: &str = "/data/local/tmp/connection_log.csv";

struct Snapshot {
    cell_id: String,
    lte_band: String,
    nr_band: String,
    network_type: String,
    lte_pci: String,
    nr_pci: String,
}

impl Snapshot {
    fn from(data: &Value) -> Self {
        Self {
            cell_id: str_field(data, "cell_id"),
            lte_band: str_field(data, "wan_active_band"),
            nr_band: str_field(data, "nr5g_action_band"),
            network_type: str_field(data, "network_type"),
            lte_pci: str_field(data, "lte_pci"),
            nr_pci: str_field(data, "nr5g_pci"),
        }
    }
}

const HEADER: &str = "timestamp,datetime,event_type,detail,old_value,new_value";

fn rows(ts: u64, data: &Value, previous: &mut Option<Value>) -> Vec<String> {
    let cur = Snapshot::from(data);
    let prev = previous.as_ref().map(Snapshot::from);
    let dt = chrono_lite(ts);
    let mut output = Vec::new();
    if let Some(ref p) = prev {
        // Detect changes
        if cur.cell_id != p.cell_id && !p.cell_id.is_empty() {
            output.push(format!(
                "{ts},{dt},cell_handover,cell_id changed,{},{}",
                csv_escape(&p.cell_id),
                csv_escape(&cur.cell_id)
            ));
        }
        if cur.lte_band != p.lte_band && !p.lte_band.is_empty() {
            output.push(format!(
                "{ts},{dt},lte_band_change,LTE band changed,{},{}",
                csv_escape(&p.lte_band),
                csv_escape(&cur.lte_band)
            ));
        }
        if cur.nr_band != p.nr_band {
            let event = if p.nr_band.is_empty() && !cur.nr_band.is_empty() {
                "nr_connected"
            } else if !p.nr_band.is_empty() && cur.nr_band.is_empty() {
                "nr_disconnected"
            } else if !p.nr_band.is_empty() {
                "nr_band_change"
            } else {
                ""
            };
            if !event.is_empty() {
                output.push(format!(
                    "{ts},{dt},{event},NR band changed,{},{}",
                    csv_escape(&p.nr_band),
                    csv_escape(&cur.nr_band)
                ));
            }
        }
        if cur.network_type != p.network_type && !p.network_type.is_empty() {
            output.push(format!(
                "{ts},{dt},mode_change,Network type changed,{},{}",
                csv_escape(&p.network_type),
                csv_escape(&cur.network_type)
            ));
        }
        if cur.lte_pci != p.lte_pci && !p.lte_pci.is_empty() {
            output.push(format!(
                "{ts},{dt},lte_pci_change,LTE PCI changed,{},{}",
                csv_escape(&p.lte_pci),
                csv_escape(&cur.lte_pci)
            ));
        }
        if cur.nr_pci != p.nr_pci && !p.nr_pci.is_empty() && !cur.nr_pci.is_empty() {
            output.push(format!(
                "{ts},{dt},nr_pci_change,NR PCI changed,{},{}",
                csv_escape(&p.nr_pci),
                csv_escape(&cur.nr_pci)
            ));
        }
    }

    *previous = Some(data.clone());
    output
}
pub fn start_logging(state: &AppState, body: &[u8]) -> (u16, Value) {
    state
        .connection_logger
        .start(body, state.radio.clone(), LOG_PATH, HEADER, rows)
}
pub fn stop_logging(state: &AppState) -> (u16, Value) {
    state.connection_logger.stop()
}
pub fn status(state: &AppState) -> (u16, Value) {
    state.connection_logger.status("events")
}
