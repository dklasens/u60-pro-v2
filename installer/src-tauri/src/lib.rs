mod bundle;
mod control;
mod credentials;
mod deploy;
mod device;
mod host;
mod identity;
mod model;
mod process;
mod recovery;
mod startup_check;
mod tools_cache;
mod transaction;
mod unlock;

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use model::{
    DetectionRequest, DetectionResult, DetectionSnapshot, InstallMode, InstallOutcome,
    InstallRequest, InstallerError,
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
struct InstallerState {
    detection: Mutex<Option<DetectionSnapshot>>,
    control: Arc<control::Control>,
    checked: Mutex<Option<InstallRequest>>,
    checked_release: Mutex<Option<String>>,
    checked_identity: Mutex<Option<identity::Identity>>,
    detection_generation: AtomicU64,
    dashboard_url: Mutex<Option<String>>,
    startup_check: Option<std::path::PathBuf>,
}

struct RunningGuard(Arc<control::Control>);
impl Drop for RunningGuard {
    fn drop(&mut self) {
        self.0.finish();
    }
}

#[tauri::command]
fn startup_mode(state: State<'_, InstallerState>) -> bool {
    state.startup_check.is_some()
}
#[tauri::command]
async fn finish_startup_check(
    app: AppHandle,
    state: State<'_, InstallerState>,
    frontend_ready: bool,
) -> Result<(), InstallerError> {
    let output = state.startup_check.clone().ok_or_else(|| {
        InstallerError::internal("startup check", "Not running in diagnostic mode")
    })?;
    let worker = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        startup_check::run(&worker, frontend_ready, &output)
    })
    .await
    .map_err(|e| InstallerError::internal("startup check", e))?;
    if result.is_ok() {
        app.exit(0);
    }
    result
}
fn require_normal_mode(state: &InstallerState) -> Result<(), InstallerError> {
    if state.startup_check.is_some() {
        Err(InstallerError::internal(
            "startup check",
            "Device commands are disabled during packaged startup diagnostics",
        ))
    } else {
        Ok(())
    }
}

#[tauri::command]
fn open_help(app: AppHandle) -> Result<(), InstallerError> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(
            "https://github.com/jesther-ai/open-u60-pro/issues/8",
            None::<&str>,
        )
        .map_err(|e| InstallerError::internal("opening unlock help", e))
}
#[tauri::command]
fn open_dashboard(app: AppHandle, state: State<'_, InstallerState>) -> Result<(), InstallerError> {
    use tauri_plugin_opener::OpenerExt;
    let url = state
        .dashboard_url
        .lock()
        .map_err(|_| InstallerError::internal("opening dashboard", "state lock poisoned"))?
        .clone()
        .ok_or_else(|| {
            InstallerError::internal("opening dashboard", "No verified installation is available")
        })?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| InstallerError::internal("opening dashboard", e))
}

#[tauri::command]
async fn recover_device(
    state: State<'_, InstallerState>,
    detection_id: String,
    transaction_id: String,
) -> Result<(), InstallerError> {
    require_normal_mode(&state)?;
    state.control.start()?;
    let _running = RunningGuard(state.control.clone());
    let snapshot = state
        .detection
        .lock()
        .map_err(|_| InstallerError::internal("loading recovery plan", "state lock poisoned"))?
        .clone()
        .ok_or_else(|| InstallerError::internal("recovery", "Detect the modem first"))?;
    if snapshot.id != detection_id {
        return Err(InstallerError::internal(
            "recovery",
            "Detection changed; check the modem again",
        ));
    }
    let identity = snapshot.identity.ok_or_else(|| {
        InstallerError::internal("recovery", "Authenticated identity is required")
    })?;
    let channel = deploy::management_channel(
        &snapshot.gateway,
        snapshot
            .mode
            .ok_or_else(|| InstallerError::internal("recovery", "Management transport missing"))?,
        snapshot.adb_path.as_deref(),
        snapshot.adb_serial.as_deref(),
    )?;
    state.control.enter_critical()?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        recovery::restore(&channel, &identity, &transaction_id)
    })
    .await
    .map_err(|e| InstallerError::internal("recovering installation", e))?;
    *state
        .detection
        .lock()
        .map_err(|_| InstallerError::internal("clearing recovery plan", "state lock poisoned"))? =
        None;
    *state.checked.lock().map_err(|_| {
        InstallerError::internal("clearing recovery check", "state lock poisoned")
    })? = None;
    result
}

#[tauri::command]
fn confirm_unlock(state: State<'_, InstallerState>, accepted: bool) -> Result<(), InstallerError> {
    state.control.confirm(accepted)
}
#[tauri::command]
fn stop_operation(state: State<'_, InstallerState>) -> Result<(), InstallerError> {
    state.control.stop()
}

#[tauri::command]
async fn detect_device(
    app: AppHandle,
    state: State<'_, InstallerState>,
    request: DetectionRequest,
) -> Result<DetectionResult, InstallerError> {
    require_normal_mode(&state)?;
    if state.control.running.load(Ordering::Acquire) {
        return Err(InstallerError::new(
            "Installation is already in progress",
            "Wait for the current operation to finish before detecting again.",
            "detect_device was invoked while InstallerState.running was true.",
        ));
    }
    let generation = state.detection_generation.fetch_add(1, Ordering::AcqRel) + 1;
    *state
        .checked
        .lock()
        .map_err(|_| InstallerError::internal("clearing check", "state lock poisoned"))? = None;
    let worker_app = app.clone();
    let (result, snapshot) =
        tauri::async_runtime::spawn_blocking(move || device::detect(&worker_app, request))
            .await
            .map_err(|error| InstallerError::internal("waiting for device detection", error))??;
    let mut current = state
        .detection
        .lock()
        .map_err(|_| InstallerError::internal("saving device detection", "state lock poisoned"))?;
    if generation != state.detection_generation.load(Ordering::Acquire) {
        return Err(InstallerError::new(
            "Detection was superseded",
            "Check the current address again.",
            "An obsolete detection result was discarded.",
        ));
    }
    *current = Some(snapshot);
    Ok(result)
}

#[tauri::command]
fn invalidate_detection(state: State<'_, InstallerState>) -> Result<(), InstallerError> {
    let mut current = state.detection.lock().map_err(|_| {
        InstallerError::internal("invalidating device detection", "state lock poisoned")
    })?;
    state.detection_generation.fetch_add(1, Ordering::AcqRel);
    *current = None;
    *state
        .checked
        .lock()
        .map_err(|_| InstallerError::internal("clearing check", "state lock poisoned"))? = None;
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
    if request.password_action == model::PasswordAction::Replace
        && (request.agent_password.is_empty() || request.agent_password.contains('\0'))
    {
        return Err(InstallerError::new(
            "Choose an agent password",
            "This password protects dashboard and API access.",
            "agentPassword was empty.",
        ));
    }
    if request.password_action == model::PasswordAction::Replace
        && request.agent_password != request.agent_password_confirmation
    {
        return Err(InstallerError::new(
            "The agent passwords do not match",
            "Retype the confirmation and try again.",
            "agentPassword and agentPasswordConfirmation differed.",
        ));
    }
    if request.pin_action == model::PinAction::Set
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
    if snapshot.mode == Some(InstallMode::Ssh) && request.reboot_after {
        return Err(InstallerError::new(
            "The reboot option does not apply to this connection",
            "Detect the modem again to refresh the available options.",
            "rebootAfter was true for a non-ADB detection.",
        ));
    }
    if snapshot.operation == Some(model::Operation::Install)
        && (request.password_action == model::PasswordAction::Keep
            || request.pin_action == model::PinAction::Keep)
    {
        return Err(InstallerError::new(
            "Choose credentials for the new installation",
            "Set a dashboard password and choose whether to enable a PIN.",
            "A new installation cannot preserve missing credentials.",
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
    require_normal_mode(&state)?;
    state.control.start()?;
    let _running = RunningGuard(state.control.clone());
    let mut snapshot = state
        .detection
        .lock()
        .map_err(|_| InstallerError::internal("loading device detection", "state lock poisoned"))?
        .clone()
        .ok_or_else(|| {
            InstallerError::new(
                "Detect the modem before continuing",
                "Detection confirms the connection and selects the safe installation path.",
                "There was no saved detection snapshot.",
            )
        })?;
    validate_install_request(&request, &snapshot)?;
    let mut checked_request = request.clone();
    checked_request.dry_run = false;
    if !request.dry_run
        && state
            .checked
            .lock()
            .map_err(|_| InstallerError::internal("loading check", "state lock poisoned"))?
            .as_ref()
            != Some(&checked_request)
    {
        return Err(InstallerError::new(
            "Check these settings before installing",
            "Run Check device again after changing installation settings.",
            "No matching successful check exists.",
        ));
    }
    if !request.dry_run {
        snapshot.identity = state
            .checked_identity
            .lock()
            .map_err(|_| {
                InstallerError::internal("loading checked identity", "state lock poisoned")
            })?
            .clone();
    }
    let dry_run = request.dry_run;
    let worker_control = state.control.clone();

    let pinned_release = if dry_run {
        None
    } else {
        state
            .checked_release
            .lock()
            .map_err(|_| {
                InstallerError::internal("loading checked release", "state lock poisoned")
            })?
            .clone()
    };
    let diagnostic_mode = request.diagnostic_mode;
    let worker_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let temporary = tempfile::Builder::new()
            .prefix("open-u60-pro-")
            .tempdir()
            .map_err(|error| InstallerError::internal("creating the temporary workspace", error))?;
        let work = temporary.path().to_owned();
        let reporter = deploy::Reporter::new(worker_app, worker_control);
        let result = deploy::perform_install(request, snapshot, &work, reporter, pinned_release);
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
    .map_err(|error| InstallerError::internal("waiting for installation", error))?;
    *state
        .checked
        .lock()
        .map_err(|_| InstallerError::internal("saving check", "state lock poisoned"))? =
        if dry_run && result.is_ok() {
            Some(checked_request)
        } else {
            None
        };
    if !dry_run {
        *state
            .detection
            .lock()
            .map_err(|_| InstallerError::internal("clearing detection", "state lock poisoned"))? =
            None;
    }
    if let Ok(outcome) = &result {
        *state.checked_identity.lock().map_err(|_| {
            InstallerError::internal("saving checked identity", "state lock poisoned")
        })? = outcome.verified_identity.clone();
        *state.checked_release.lock().map_err(|_| {
            InstallerError::internal("saving checked release", "state lock poisoned")
        })? = Some(outcome.release.clone());
        if outcome.result == "success" {
            *state.dashboard_url.lock().map_err(|_| {
                InstallerError::internal("saving dashboard address", "state lock poisoned")
            })? = outcome.dashboard_url.clone();
        }
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window
                    .state::<InstallerState>()
                    .control
                    .running
                    .load(Ordering::Acquire)
                {
                    api.prevent_close();
                    let _ = window.emit("installer-close-blocked", ());
                }
            }
        })
        .manage(InstallerState {
            startup_check: startup_check::output_path(),
            ..InstallerState::default()
        })
        .invoke_handler(tauri::generate_handler![
            detect_device,
            invalidate_detection,
            run_install,
            confirm_unlock,
            stop_operation,
            open_help,
            open_dashboard,
            recover_device,
            startup_mode,
            finish_startup_check
        ])
        .build(tauri::generate_context!())
        .expect("error while building the Open U60 Pro installer")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if app
                    .state::<InstallerState>()
                    .control
                    .running
                    .load(Ordering::Acquire)
                {
                    api.prevent_exit();
                    let _ = app.emit("installer-close-blocked", ());
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use model::{Operation, PasswordAction, PinAction};
    fn snapshot(mode: InstallMode) -> DetectionSnapshot {
        DetectionSnapshot {
            identity: None,
            id: "sample-plan".into(),
            gateway: "192.168.0.1".into(),
            adb_path: None,
            adb_serial: None,
            mode: Some(mode),
            operation: Some(Operation::Install),
            ready: true,
        }
    }
    #[test]
    fn package_startup_mode_disables_modem_operations() {
        let state = InstallerState {
            startup_check: Some(std::path::PathBuf::from("startup.json")),
            ..InstallerState::default()
        };
        assert!(require_normal_mode(&state).is_err());
        assert!(require_normal_mode(&InstallerState::default()).is_ok());
    }
    #[test]
    fn default_unlock_and_adb_requests_accept_final_reboot() {
        for dry_run in [true, false] {
            for mode in [InstallMode::Unlock, InstallMode::Adb] {
                let mut request = model::sample_request();
                request.dry_run = dry_run;
                assert!(validate_install_request(&request, &snapshot(mode)).is_ok());
            }
        }
        assert!(
            validate_install_request(&model::sample_request(), &snapshot(InstallMode::Ssh))
                .is_err()
        );
    }
    #[test]
    fn maintenance_preserves_credentials_and_pin_actions_are_explicit() {
        let mut request = model::sample_request();
        request.reboot_after = false;
        request.password_action = PasswordAction::Keep;
        request.pin_action = PinAction::Keep;
        request.agent_password.clear();
        request.agent_password_confirmation.clear();
        let mut plan = snapshot(InstallMode::Ssh);
        plan.operation = Some(Operation::Update);
        assert!(validate_install_request(&request, &plan).is_ok());
        request.pin_action = PinAction::Set;
        assert!(validate_install_request(&request, &plan).is_err());
        request.agent_pin = "123456".into();
        assert!(validate_install_request(&request, &plan).is_ok());
        plan.operation = Some(Operation::Install);
        assert!(validate_install_request(&request, &plan).is_err());
    }
    #[test]
    fn stale_plan_or_invalid_password_never_enters_worker() {
        let mut request = model::sample_request();
        request.detection_id = "obsolete".into();
        assert!(validate_install_request(&request, &snapshot(InstallMode::Unlock)).is_err());
        request.detection_id = "sample-plan".into();
        request.agent_password_confirmation.clear();
        assert!(validate_install_request(&request, &snapshot(InstallMode::Unlock)).is_err());
    }
}
