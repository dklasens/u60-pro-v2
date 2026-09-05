use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionRequest {
    pub gateway: String,
    pub adb_serial: Option<String>,
}

#[derive(Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub detection_id: String,
    pub gateway: String,
    pub adb_serial: Option<String>,
    pub router_password: String,
    pub backup_suffix: String,
    pub agent_password: String,
    pub agent_password_confirmation: String,
    pub agent_pin: String,
    pub password_action: PasswordAction,
    pub pin_action: PinAction,
    pub dry_run: bool,
    pub reboot_after: bool,
    pub diagnostic_mode: bool,
    #[serde(default)]
    pub bundle_path: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PasswordAction {
    Keep,
    Replace,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PinAction {
    Keep,
    Set,
    Remove,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDevice {
    pub serial: String,
    pub status: String,
    pub manufacturer: String,
    pub model: String,
    pub product: String,
    pub compatible: bool,
    pub display_name: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallMode {
    Unlock,
    Adb,
    Ssh,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Operation {
    Install,
    Repair,
    Update,
}

impl Operation {
    pub fn label(self) -> &'static str {
        match self {
            Self::Install => "Install",
            Self::Repair => "Repair",
            Self::Update => "Update",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceState {
    pub web: bool,
    pub agent: bool,
    pub ssh: bool,
    pub adb: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionResult {
    pub detection_id: String,
    pub gateway: String,
    pub adb_path: Option<String>,
    pub adb_devices: Vec<AdbDevice>,
    pub selected_adb_serial: Option<String>,
    pub selection_required: bool,
    pub mode: Option<InstallMode>,
    pub operation: Option<Operation>,
    pub services: ServiceState,
    pub connection_summary: String,
    pub plan_summary: String,
    pub ready: bool,
    pub problems: Vec<String>,
    pub recovery: Option<crate::recovery::PendingRecovery>,
}

#[derive(Clone, Debug)]
pub struct DetectionSnapshot {
    pub identity: Option<crate::identity::Identity>,
    pub id: String,
    pub gateway: String,
    pub adb_path: Option<std::path::PathBuf>,
    pub adb_serial: Option<String>,
    pub mode: Option<InstallMode>,
    pub operation: Option<Operation>,
    pub ready: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub kind: String,
    pub message: String,
    pub step: Option<String>,
    pub status: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallOutcome {
    pub result: String,
    #[serde(skip)]
    pub verified_identity: Option<crate::identity::Identity>,
    pub device_model: String,
    pub firmware: String,
    pub release: String,
    pub title: String,
    pub message: String,
    pub operation: Operation,
    pub dashboard_url: Option<String>,
    pub api_url: Option<String>,
    pub ssh_address: Option<String>,
    pub diagnostic_path: Option<String>,
}

#[derive(Clone, Debug, Serialize, thiserror::Error)]
#[error("{summary}")]
#[serde(rename_all = "camelCase")]
pub struct InstallerError {
    pub summary: String,
    pub guidance: String,
    pub details: String,
    pub diagnostic_path: Option<String>,
}

impl InstallerError {
    pub fn new(
        summary: impl Into<String>,
        guidance: impl Into<String>,
        details: impl Into<String>,
    ) -> Self {
        Self {
            summary: summary.into(),
            guidance: guidance.into(),
            details: details.into(),
            diagnostic_path: None,
        }
    }

    pub fn internal(context: &str, error: impl std::fmt::Display) -> Self {
        Self::new(
            "The installer encountered an unexpected problem",
            "Copy the diagnostic details and include them when reporting the issue.",
            format!("{context}: {error}"),
        )
    }
}

#[cfg(test)]
pub fn sample_request() -> InstallRequest {
    InstallRequest {
        detection_id: "sample-plan".into(),
        gateway: "192.168.0.1".into(),
        adb_serial: None,
        router_password: "sample-admin".into(),
        backup_suffix: "sample-suffix".into(),
        agent_password: "sample-password".into(),
        agent_password_confirmation: "sample-password".into(),
        agent_pin: String::new(),
        password_action: PasswordAction::Replace,
        pin_action: PinAction::Remove,
        dry_run: true,
        reboot_after: true,
        diagnostic_mode: false,
        bundle_path: None,
    }
}
