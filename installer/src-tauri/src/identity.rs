//! Identity is verified through the transport that will perform deployment.
use crate::model::InstallerError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

pub const PROBE: &str = "set -e\nprintf '__U60_ARCH__%s\\n' \"$(uname -m)\"\nprintf '__U60_UID__%s\\n' \"$(id -u)\"\nubus call zwrt_web device_info '{}'";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Identity {
    pub model: String,
    pub firmware: String,
    // Hash only: device identity must not leak into diagnostic messages.
    pub fingerprint: String,
}

fn field<'a>(info: &'a Value, names: &[&str]) -> Option<&'a str> {
    names.iter().find_map(|name| {
        info.get(*name)
            .and_then(Value::as_str)
            .filter(|s| !s.trim().is_empty())
    })
}
fn rejected(reason: &str) -> InstallerError {
    InstallerError::new("The target modem could not be verified", "No deployment files were changed. Check the address, firmware and selected USB device, then detect again.", reason)
}

impl Identity {
    pub fn from_info(info: &Value) -> Result<Self, InstallerError> {
        let model = field(
            info,
            &[
                "model",
                "model_name",
                "device_name",
                "product_name",
                "modelName",
            ],
        )
        .or_else(|| {
            // Stock B03/B04 zwrt_web reports the product only in its WA build
            // identifier, e.g. BD_XCBZHKMU5250V1.0.0B03. Require that specific
            // product/version marker; unrelated firmware names do not qualify.
            field(info, &["wa_inner_version"])
                .filter(|value| value.starts_with("BD_") && value.contains("MU5250V"))
                .map(|_| "ZTE MU5250")
        })
        .ok_or_else(|| {
            rejected(
                "The device API did not report a supported model or MU5250 firmware identifier.",
            )
        })?;
        let normalized = model.to_ascii_lowercase().replace([' ', '_', '-'], "");
        if !normalized.contains("mu5250") && !normalized.contains("u60pro") {
            return Err(rejected(
                "The device API did not identify a ZTE MU5250 / U60 Pro.",
            ));
        }
        let firmware = field(
            info,
            &[
                "software_version",
                "sw_version",
                "firmware_version",
                "wa_inner_version",
                "version",
            ],
        )
        .ok_or_else(|| rejected("The device API did not report a firmware version."))?;
        let imei = field(info, &["imei"])
            .filter(|s| s.len() == 15 && s.bytes().all(|b| b.is_ascii_digit()))
            .ok_or_else(|| rejected("A valid device identity was not available."))?;
        Ok(Self {
            model: model.trim().into(),
            firmware: firmware.trim().into(),
            fingerprint: hex::encode(Sha256::digest(imei.as_bytes())),
        })
    }

    pub fn from_probe(output: &str) -> Result<Self, InstallerError> {
        let mut lines = output.lines();
        if lines.next() != Some("__U60_ARCH__aarch64") || lines.next() != Some("__U60_UID__0") {
            return Err(rejected(
                "Deployment requires an authenticated root shell on an aarch64 modem.",
            ));
        }
        let info: Value =
            serde_json::from_str(&lines.collect::<Vec<_>>().join("\n")).map_err(|_| {
                rejected("The authenticated shell returned an invalid device identity.")
            })?;
        Self::from_info(&info)
    }

    pub fn require_same(&self, actual: &Self) -> Result<(), InstallerError> {
        if self != actual {
            return Err(rejected(
                "Device identity or firmware changed since detection; a new plan is required.",
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn info() -> Value {
        json!({"model":"ZTE MU5250", "software_version":"test-firmware", "imei":"1".repeat(15)})
    }
    #[test]
    fn rejects_other_hosts_incomplete_identity_and_unprivileged_shells() {
        assert!(Identity::from_probe("__U60_ARCH__x86_64\n__U60_UID__0\n{}").is_err());
        assert!(Identity::from_probe("__U60_ARCH__aarch64\n__U60_UID__1000\n{}").is_err());
        assert!(Identity::from_info(&json!({"model":"MU5250"})).is_err());
        let mut other = info();
        other["model"] = json!("unrelated router");
        assert!(Identity::from_info(&other).is_err());
    }
    #[test]
    fn stock_firmware_identity_without_separate_model_is_supported() {
        let stock = json!({"wa_inner_version": "BD_XCBZHKMU5250V1.0.0B03", "imei": "1".repeat(15)});
        assert_eq!(Identity::from_info(&stock).unwrap().model, "ZTE MU5250");
        let unrelated = json!({"wa_inner_version": "BD_OTHER_PRODUCTV1", "imei": "1".repeat(15)});
        assert!(Identity::from_info(&unrelated).is_err());
    }
    #[test]
    fn pins_identity_and_firmware_without_retaining_imei() {
        let before = Identity::from_info(&info()).unwrap();
        let mut other = info();
        other["imei"] = json!("2".repeat(15));
        assert!(before
            .require_same(&Identity::from_info(&other).unwrap())
            .is_err());
        other = info();
        other["software_version"] = json!("changed-firmware");
        assert!(before
            .require_same(&Identity::from_info(&other).unwrap())
            .is_err());
        assert!(!format!("{before:?}").contains(&"1".repeat(15)));
    }
}
