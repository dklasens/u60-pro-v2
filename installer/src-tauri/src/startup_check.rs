//! A packaged-app startup diagnostic. Never detects or contacts a modem.
use crate::{device, model::InstallerError, process};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub fn output_path() -> Option<PathBuf> {
    let mut args = std::env::args_os().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--startup-check" {
            return args.next().map(PathBuf::from);
        }
    }
    None
}

pub fn run(
    app: &AppHandle,
    frontend_ready: bool,
    output: &std::path::Path,
) -> Result<(), InstallerError> {
    if !frontend_ready {
        return Err(InstallerError::internal(
            "startup check",
            "Frontend did not mount",
        ));
    }
    let adb = device::find_adb(app)?
        .ok_or_else(|| InstallerError::internal("startup check", "Bundled ADB missing"))?;
    let result = process::run_timeout(
        &adb,
        &["version".into()],
        None,
        "checking packaged ADB",
        Duration::from_secs(10),
    )?;
    if !result.status.success() {
        return Err(InstallerError::internal(
            "startup check",
            "Packaged ADB failed to execute",
        ));
    }
    let report = serde_json::json!({"version": app.package_info().version.to_string(), "frontend": "mounted", "adb": "verified and executable", "modem_contacted": false, "resource_directory": app.path().resource_dir().is_ok()});
    std::fs::write(output, serde_json::to_vec_pretty(&report).unwrap())
        .map_err(|e| InstallerError::internal("saving startup check", e))?;
    Ok(())
}
