use std::ffi::OsString;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::model::{
    AdbDevice, DetectionRequest, DetectionResult, DetectionSnapshot, InstallMode, InstallerError,
    Operation, ServiceState,
};
use crate::process::{find_on_path, output_text, run_timeout};

const AGENT_PORT: u16 = 9090;
const SSH_PORT: u16 = 2222;

#[derive(Debug)]
struct RawAdbDevice {
    serial: String,
    status: String,
    description: String,
}

pub fn validate_gateway(gateway: &str) -> Result<String, InstallerError> {
    let gateway = gateway.trim();
    if gateway.is_empty()
        || gateway.len() > 253
        || gateway.starts_with('-')
        || !gateway
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-'))
    {
        return Err(InstallerError::new(
            "The device address isn’t valid",
            "Enter an IP address or hostname only, such as 192.168.0.1.",
            format!("Rejected device address: {gateway:?}"),
        ));
    }
    Ok(gateway.to_owned())
}

pub fn find_adb(app: &AppHandle) -> Result<Option<PathBuf>, InstallerError> {
    let executable = if cfg!(windows) { "adb.exe" } else { "adb" };
    let mut bundled_directories = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        bundled_directories.push(resource_dir.join("platform-tools"));
    }
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            bundled_directories.push(parent.join("platform-tools"));
        }
    }
    bundled_directories
        .push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../assets/platform-tools"));
    for source in bundled_directories {
        if source.join(executable).is_file() {
            let root = app
                .path()
                .app_cache_dir()
                .map_err(|e| InstallerError::internal("locating ADB cache", e))?
                .join("verified-adb");
            return crate::tools_cache::stage(&source, &root, cfg!(windows)).map(Some);
        }
    }
    if cfg!(debug_assertions) {
        Ok(find_on_path("adb"))
    } else {
        Err(InstallerError::new(
            "Bundled ADB is missing",
            "Reinstall the desktop application from the release download.",
            "A production installer requires its verified bundled ADB.",
        ))
    }
}

fn raw_adb_devices(adb: &Path) -> Result<Vec<RawAdbDevice>, InstallerError> {
    let output = run_timeout(
        adb,
        &["devices".into(), "-l".into()],
        None,
        "ADB",
        Duration::from_secs(15),
    )?;
    let (stdout, stderr) = output_text(&output);
    if !output.status.success() {
        return Err(InstallerError::new(
            "ADB could not inspect connected devices",
            "Reconnect the USB cable and try detection again.",
            format!("adb devices -l failed\n{stdout}\n{stderr}"),
        ));
    }
    Ok(stdout
        .lines()
        .skip(1)
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            let serial = fields.next()?.to_owned();
            let status = fields.next()?.to_owned();
            Some(RawAdbDevice {
                serial,
                status,
                description: fields.collect::<Vec<_>>().join(" "),
            })
        })
        .collect())
}

pub fn compatible_adb_devices(adb: &Path) -> Result<Vec<AdbDevice>, InstallerError> {
    Ok(raw_adb_devices(adb)?
        .into_iter()
        .map(|raw| adb_identity(adb, raw))
        .filter(|device| device.compatible)
        .collect())
}

fn adb_identity(adb: &Path, raw: RawAdbDevice) -> AdbDevice {
    let mut manufacturer = String::new();
    let mut model = field_value(&raw.description, "model").unwrap_or_default();
    let mut product = field_value(&raw.description, "product").unwrap_or_default();
    let mut probe = String::new();

    if raw.status == "device" {
        let args = vec![
            "-s".into(),
            raw.serial.clone().into(),
            "shell".into(),
            "printf '%s\\n' \"$(getprop ro.product.manufacturer)\" \"$(getprop ro.product.model)\" \"$(getprop ro.product.name)\" \"$(getprop ro.product.device)\"; ubus call zwrt_web device_info '{}' 2>/dev/null"
                .into(),
        ];
        if let Ok(output) = run_timeout(
            adb,
            &args,
            None,
            "ADB device identification",
            Duration::from_secs(15),
        ) {
            let (stdout, _) = output_text(&output);
            let mut lines = stdout.lines();
            manufacturer = lines.next().unwrap_or_default().trim().to_owned();
            let property_model = lines.next().unwrap_or_default().trim();
            let property_product = lines.next().unwrap_or_default().trim();
            let property_device = lines.next().unwrap_or_default().trim();
            if model.is_empty() {
                model = property_model.to_owned();
            }
            if product.is_empty() {
                product = [property_product, property_device]
                    .into_iter()
                    .filter(|value| !value.is_empty())
                    .collect::<Vec<_>>()
                    .join(" / ");
            }
            probe = stdout;
        }
    }

    let identity = format!(
        "{} {} {} {} {}",
        manufacturer, model, product, raw.description, probe
    )
    .to_ascii_lowercase();
    let is_zte = identity.contains("zte");
    let is_mu5250 = ["mu5250", "u60 pro", "u60_pro", "u60pro"]
        .iter()
        .any(|marker| identity.contains(marker));
    let compatible = raw.status == "device" && is_zte && is_mu5250;

    let display_model = if model.is_empty() {
        if compatible {
            "ZTE MU5250"
        } else {
            "Unknown device"
        }
    } else {
        &model
    };
    AdbDevice {
        display_name: format!("{display_model} — {}", raw.serial),
        serial: raw.serial,
        status: raw.status,
        manufacturer,
        model,
        product,
        compatible,
    }
}

fn field_value(description: &str, name: &str) -> Option<String> {
    let prefix = format!("{name}:");
    description
        .split_whitespace()
        .find_map(|field| field.strip_prefix(&prefix))
        .map(|value| value.replace('_', " "))
}

fn tcp_up(gateway: &str, port: u16) -> bool {
    let addresses: Vec<SocketAddr> = match (gateway, port).to_socket_addrs() {
        Ok(addresses) => addresses.collect(),
        Err(_) => return false,
    };
    addresses
        .into_iter()
        .any(|address| TcpStream::connect_timeout(&address, Duration::from_millis(1400)).is_ok())
}

pub fn detect(
    app: &AppHandle,
    request: DetectionRequest,
) -> Result<(DetectionResult, DetectionSnapshot), InstallerError> {
    let gateway = validate_gateway(&request.gateway)?;
    let adb_path = find_adb(app)?;
    let adb_devices = match &adb_path {
        Some(adb) => raw_adb_devices(adb)?
            .into_iter()
            .map(|raw| adb_identity(adb, raw))
            .collect::<Vec<_>>(),
        None => Vec::new(),
    };
    let compatible = adb_devices
        .iter()
        .filter(|device| device.compatible)
        .collect::<Vec<_>>();
    let selected_adb_serial = request
        .adb_serial
        .filter(|serial| compatible.iter().any(|device| device.serial == *serial))
        .or_else(|| (compatible.len() == 1).then(|| compatible[0].serial.clone()));
    let selection_required = compatible.len() > 1 && selected_adb_serial.is_none();

    let services = ServiceState {
        web: tcp_up(&gateway, 80),
        agent: tcp_up(&gateway, AGENT_PORT),
        ssh: tcp_up(&gateway, SSH_PORT),
        adb: selected_adb_serial.is_some(),
    };

    let mode = if services.adb {
        Some(InstallMode::Adb)
    } else if services.ssh {
        Some(InstallMode::Ssh)
    } else if services.web && !services.agent {
        Some(InstallMode::Unlock)
    } else {
        None
    };
    let operation = mode.map(|mode| match mode {
        InstallMode::Unlock => Operation::Install,
        InstallMode::Adb if services.agent && services.ssh => Operation::Update,
        InstallMode::Adb if services.agent || services.ssh => Operation::Repair,
        InstallMode::Adb => Operation::Install,
        InstallMode::Ssh if services.agent => Operation::Update,
        InstallMode::Ssh => Operation::Repair,
    });

    let mut problems = Vec::new();
    if adb_path.is_none() && mode == Some(InstallMode::Unlock) {
        problems.push("ADB is not available. The packaged app includes it; source builds need Android platform-tools on PATH.".into());
    }
    if selection_required {
        problems
            .push("More than one compatible modem is connected. Choose the modem to use.".into());
    }
    for device in &adb_devices {
        if device.status == "unauthorized" {
            problems.push(format!(
                "{} has not authorised this computer for ADB.",
                device.serial
            ));
        } else if device.status != "device" {
            problems.push(format!(
                "{} is reported by ADB as {}.",
                device.serial, device.status
            ));
        } else if !device.compatible {
            problems.push(format!(
                "{} was ignored because it is not identified as a ZTE MU5250.",
                device.display_name
            ));
        }
    }
    if services.agent && !services.adb && !services.ssh {
        problems.push(
            "The agent is reachable, but neither ADB nor SSH is available for maintenance.".into(),
        );
    } else if mode.is_none() && !selection_required {
        problems.push("No supported management connection was found. Connect to the modem by Wi‑Fi or USB and try again.".into());
    }
    if mode.is_some() && find_on_path("ssh").is_none() {
        problems.push(
            "The system SSH client is missing. Enable OpenSSH Client and detect again.".into(),
        );
    }

    // An open TCP port is discovery only. Verify the actual selected transport
    // before allowing a maintenance plan. Locked web devices are authenticated
    // and identified in run_unlock before preparing a backup.
    let identity =
        if matches!(mode, Some(InstallMode::Ssh | InstallMode::Adb)) && !selection_required {
            match crate::deploy::probe_identity(
                &gateway,
                mode.unwrap(),
                adb_path.as_deref(),
                selected_adb_serial.as_deref(),
            ) {
                Ok(identity) => Some(identity),
                Err(error) => {
                    problems.push(error.summary + ": " + &error.details);
                    None
                }
            }
        } else {
            None
        };
    let recovery = if identity.is_some() {
        let channel = crate::deploy::management_channel(
            &gateway,
            mode.unwrap(),
            adb_path.as_deref(),
            selected_adb_serial.as_deref(),
        )?;
        crate::recovery::inspect(&channel)?
    } else {
        None
    };
    if recovery.is_some() {
        problems.push("An interrupted installation was found. Restore the previous installation before continuing.".into());
    }
    let ready = recovery.is_none()
        && mode.is_some()
        && (mode == Some(InstallMode::Unlock) || identity.is_some())
        && !selection_required
        && !(mode == Some(InstallMode::Unlock) && adb_path.is_none())
        && find_on_path("ssh").is_some();
    let connection_summary = match mode {
        Some(InstallMode::Unlock) => format!("Locked modem at {gateway} (web connection)"),
        Some(InstallMode::Adb) => format!(
            "ZTE MU5250 connected over ADB ({})",
            selected_adb_serial.as_deref().unwrap_or("unknown serial")
        ),
        Some(InstallMode::Ssh) => format!("Provisioned modem at {gateway} (SSH)"),
        None if selection_required => "Multiple compatible ADB modems found".into(),
        None => "No usable modem connection detected".into(),
    };
    let plan_summary = operation.map_or_else(
        || "Resolve the items below, then detect again.".into(),
        |operation| match mode.expect("operation always has a mode") {
            InstallMode::Unlock => {
                "Unlock, install the agent, configure SSH, and deploy the dashboard.".into()
            }
            InstallMode::Adb => format!(
                "{} the agent, SSH configuration, and dashboard over ADB.",
                operation.label()
            ),
            InstallMode::Ssh => format!(
                "{} the agent, SSH configuration, and dashboard over SSH.",
                operation.label()
            ),
        },
    );

    let id = uuid::Uuid::new_v4().to_string();
    let snapshot = DetectionSnapshot {
        identity,
        id: id.clone(),
        gateway: gateway.clone(),
        adb_path: adb_path.clone(),
        adb_serial: selected_adb_serial.clone(),
        mode,
        operation,
        ready,
    };
    let result = DetectionResult {
        detection_id: id,
        gateway,
        adb_path: adb_path.map(|path| path.display().to_string()),
        adb_devices,
        selected_adb_serial,
        selection_required,
        mode,
        operation,
        services,
        connection_summary,
        plan_summary,
        ready,
        problems,
        recovery,
    };
    Ok((result, snapshot))
}

pub fn adb_args(serial: &str, tail: &[&str]) -> Vec<OsString> {
    let mut args = vec!["-s".into(), serial.into()];
    args.extend(tail.iter().map(OsString::from));
    args
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_adb_description_fields() {
        assert_eq!(
            field_value("product:P model:MU5250 device:X", "model"),
            Some("MU5250".into())
        );
    }

    #[test]
    fn rejects_urls_as_gateway_addresses() {
        assert!(validate_gateway("http://192.168.0.1").is_err());
        assert_eq!(validate_gateway("192.168.0.1").unwrap(), "192.168.0.1");
    }
}
