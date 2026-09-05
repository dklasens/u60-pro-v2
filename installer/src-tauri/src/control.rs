//! Safe stopping boundaries and a confirmation owned by the native worker.
use crate::model::InstallerError;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Condvar, Mutex,
};
use std::time::Duration;

#[derive(Default)]
pub struct Control {
    pub running: AtomicBool,
    critical: AtomicBool,
    stopped: AtomicBool,
    approval: Mutex<Option<bool>>,
    waiting: AtomicBool,
    wake: Condvar,
}
impl Control {
    pub fn start(&self) -> Result<(), InstallerError> {
        if self.running.swap(true, Ordering::AcqRel) {
            return Err(error("An operation is already running"));
        }
        self.critical.store(false, Ordering::Release);
        self.stopped.store(false, Ordering::Release);
        *self.approval.lock().unwrap_or_else(|e| e.into_inner()) = None;
        Ok(())
    }
    pub fn finish(&self) {
        self.waiting.store(false, Ordering::Release);
        self.critical.store(false, Ordering::Release);
        self.running.store(false, Ordering::Release);
    }
    pub fn stop(&self) -> Result<(), InstallerError> {
        // Both cancellation and entering critical state use the same lock.
        let _lock = self.approval.lock().unwrap_or_else(|e| e.into_inner());
        if self.critical.load(Ordering::Acquire) {
            return Err(error(
                "Device changes are underway; wait for verification or recovery to finish",
            ));
        }
        self.stopped.store(true, Ordering::Release);
        self.wake.notify_all();
        Ok(())
    }
    pub fn checkpoint(&self) -> Result<(), InstallerError> {
        if self.stopped.load(Ordering::Acquire) {
            Err(error("Stopped before device changes"))
        } else {
            Ok(())
        }
    }
    pub fn enter_critical(&self) -> Result<(), InstallerError> {
        let _lock = self.approval.lock().unwrap_or_else(|e| e.into_inner());
        self.checkpoint()?;
        self.critical.store(true, Ordering::Release);
        Ok(())
    }
    pub fn confirm(&self, accepted: bool) -> Result<(), InstallerError> {
        let mut choice = self.approval.lock().unwrap_or_else(|e| e.into_inner());
        if !self.waiting.load(Ordering::Acquire) {
            return Err(error("No prepared unlock is awaiting confirmation"));
        }
        *choice = Some(accepted);
        self.wake.notify_all();
        Ok(())
    }
    pub fn await_approval(&self, notify: impl FnOnce()) -> Result<(), InstallerError> {
        self.checkpoint()?;
        let mut choice = self.approval.lock().unwrap_or_else(|e| e.into_inner());
        *choice = None;
        self.waiting.store(true, Ordering::Release);
        notify();
        let (choice, timeout) = self
            .wake
            .wait_timeout_while(choice, Duration::from_secs(600), |choice| {
                choice.is_none() && !self.stopped.load(Ordering::Acquire)
            })
            .unwrap_or_else(|e| e.into_inner());
        self.waiting.store(false, Ordering::Release);
        if timeout.timed_out() || *choice != Some(true) || self.stopped.load(Ordering::Acquire) {
            return Err(error("Unlock cancelled before upload"));
        }
        self.critical.store(true, Ordering::Release);
        Ok(())
    }
}
fn error(summary: &str) -> InstallerError {
    InstallerError::new(
        summary,
        "Check the modem again when you are ready to continue.",
        "The installer stopped at a safe boundary.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_cannot_interrupt_critical_writes() {
        let state = Control::default();
        state.start().unwrap();
        state.enter_critical().unwrap();
        assert!(state.stop().is_err());
        assert!(state.start().is_err());
        state.finish();
        state.start().unwrap();
        state.stop().unwrap();
        assert!(state.enter_critical().is_err());
    }
    #[test]
    fn approval_is_only_accepted_for_a_prepared_operation() {
        let state = std::sync::Arc::new(Control::default());
        state.start().unwrap();
        assert!(state.confirm(true).is_err());
        let (tx, rx) = std::sync::mpsc::channel();
        let worker = state.clone();
        let join = std::thread::spawn(move || worker.await_approval(|| tx.send(()).unwrap()));
        rx.recv_timeout(Duration::from_secs(1)).unwrap();
        state.confirm(false).unwrap();
        assert!(join.join().unwrap().is_err());
        assert!(state.confirm(true).is_err());
    }
}
