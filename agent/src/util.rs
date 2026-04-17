use std::sync::{Mutex, MutexGuard};

pub trait MutexExt<T> {
    fn safe_lock(&self) -> MutexGuard<'_, T>;
}

impl<T> MutexExt<T> for Mutex<T> {
    fn safe_lock(&self) -> MutexGuard<'_, T> {
        self.lock().unwrap_or_else(|e| e.into_inner())
    }
}
