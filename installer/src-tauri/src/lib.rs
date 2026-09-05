mod bundle;
mod deploy;
mod device;
mod identity;
mod model;
mod process;
mod transaction;
mod unlock;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use model::{
    DetectionRequest, DetectionResult, DetectionSnapshot, InstallMode, InstallOutcome,
    InstallRequest, InstallerError,
};
use tauri::{AppHandle, State};

#[derive(Default)]
struct InstallerState {
    detection: Mutex<Option<DetectionSnapshot>>,
    running: AtomicBool,
}

struct RunningGuard<'a>(&'a AtomicBool);

impl Drop for RunningGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[tauri::command]
async fn detect_device(
    app: AppHandle,
    state: State<'_, InstallerState>,
    request: DetectionRequest,
) -> Result<DetectionResult, InstallerError> {
    if state.running.load(Ordering::Acquire) {
        return Err(InstallerError::new(
            "Installation is already in progress",
            "Wait for the current operation to finish before detecting again.",
            "detect_device was invoked while InstallerState.running was true.",
        ));
    }
    let worker_app = app.clone();
    let (result, snapshot) =
        tauri::async_runtime::spawn_blocking(move || device::detect(&worker_app, request))
            .await
            .map_err(|error| InstallerError::internal("waiting for device detection", error))??;
    *state.detection.lock().map_err(|_| {
        InstallerError::internal("saving device detection", "state lock poisoned")
    })? = Some(snapshot);
    Ok(result)
}

#[tauri::command]
fn invalidate_detection(state: State<'_, InstallerState>) -> Result<(), InstallerError> {
    *state.detection.lock().map_err(|_| {
        InstallerError::internal("invalidating device detection", "state lock poisoned")
    })? = None;
    Ok(())
}

fn validate_install_request(
    request: &InstallRequest,
    snapshot: &DetectionSnapshot,
) -> Result<(), InstallerError> {
    if request.detection_id != snapshot.id
        || request.gateway.trim() != snapshot.gateway
        || request.adb_serial != snapshot.adb_serial
    {
        return Err(InstallerError::new(
            "Device detection is out of date",
            "Detect the modem again before continuing.",
            format!(
                "Request detection/address/serial: {:?}/{:?}/{:?}; current: {:?}/{:?}/{:?}",
                request.detection_id,
                request.gateway,
                request.adb_serial,
                snapshot.id,
                snapshot.gateway,
                snapshot.adb_serial,
            ),
        ));
    }
    if !snapshot.ready || snapshot.mode.is_none() || snapshot.operation.is_none() {
        return Err(InstallerError::new(
            "The modem is not ready for installation",
            "Resolve the detection problems and detect again.",
            "The saved detection snapshot was not ready or had no planned mode.",
        ));
    }
    if request.agent_password.is_empty() || request.agent_password.contains('\0') {
        return Err(InstallerError::new(
            "Choose an agent password",
            "This password protects dashboard and API access.",
            "agentPassword was empty.",
        ));
    }
    if request.agent_password != request.agent_password_confirmation {
        return Err(InstallerError::new(
            "The agent passwords do not match",
            "Retype the confirmation and try again.",
            "agentPassword and agentPasswordConfirmation differed.",
        ));
    }
    if !request.agent_pin.is_empty()
        && (request.agent_pin.len() != 6
            || !request
                .agent_pin
                .chars()
                .all(|character| character.is_ascii_digit()))
    {
        return Err(InstallerError::new(
            "The optional agent PIN isn’t valid",
            "Use exactly six digits, or leave the PIN empty.",
            "agentPin was non-empty and not six ASCII digits.",
        ));
    }
    if snapshot.mode == Some(InstallMode::Unlock)
        && (request.router_password.is_empty() || request.backup_suffix.is_empty())
    {
        return Err(InstallerError::new(
            "Unlock credentials are incomplete",
            "Enter the router admin password and backup-key suffix.",
            "A locked-device request omitted routerPassword or backupSuffix.",
        ));
    }
    if snapshot.mode != Some(InstallMode::Adb) && request.reboot_after {
        return Err(InstallerError::new(
            "The reboot option does not apply to this connection",
            "Detect the modem again to refresh the available options.",
            "rebootAfter was true for a non-ADB detection.",
        ));
    }
    Ok(())
}

#[tauri::command]
async fn run_install(
    app: AppHandle,
    state: State<'_, InstallerState>,
    request: InstallRequest,
) -> Result<InstallOutcome, InstallerError> {
    if state.running.swap(true, Ordering::AcqRel) {
        return Err(InstallerError::new(
            "Installation is already in progress",
            "Wait for it to finish before starting another operation.",
            "run_install was invoked while InstallerState.running was true.",
        ));
    }
    let _running = RunningGuard(&state.running);
    let snapshot = state
        .detection
        .lock()
        .map_err(|_| InstallerError::internal("loading device detection", "state lock poisoned"))?
        .take()
        .ok_or_else(|| {
            InstallerError::new(
                "Detect the modem before continuing",
                "Detection confirms the connection and selects the safe installation path.",
                "There was no saved detection snapshot.",
            )
        })?;
    validate_install_request(&request, &snapshot)?;

    let diagnostic_mode = request.diagnostic_mode;
    let worker_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let temporary = tempfile::Builder::new()
            .prefix("open-u60-pro-")
            .tempdir()
            .map_err(|error| InstallerError::internal("creating the temporary workspace", error))?;
        let work = temporary.path().to_owned();
        let reporter = deploy::Reporter::new(worker_app);
        let result = deploy::perform_install(request, snapshot, &work, reporter);
        let diagnostic_path = diagnostic_mode.then(|| temporary.keep().display().to_string());
        match result {
            Ok(mut outcome) => {
                outcome.diagnostic_path = diagnostic_path;
                Ok(outcome)
            }
            Err(mut error) => {
                error.diagnostic_path = diagnostic_path;
                Err(error)
            }
        }
    })
    .await
    .map_err(|error| InstallerError::internal("waiting for installation", error))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(InstallerState::default())
        .invoke_handler(tauri::generate_handler![
            detect_device,
            invalidate_detection,
            run_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Open U60 Pro installer");
}
