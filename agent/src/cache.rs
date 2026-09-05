use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::util::MutexExt;

/// A single value refreshed on demand, at most once per TTL.
///
/// Every `ubus`/`uci` read in this agent is a fork+exec, which is the dominant
/// cost of serving `/api/dashboard`. Wrapping each source in its own TTL means
/// the poll rate is decoupled from the refresh rate: a 3 s dashboard poll no
/// longer re-reads WAN state that changes hourly, and several clients polling
/// at once collapse into one refresh instead of multiplying the load.
pub struct Cached<T> {
    slot: Mutex<Option<(Instant, T)>>,
}

impl<T: Clone> Cached<T> {
    /// Return the cached value if it is younger than `ttl`, otherwise call
    /// `refresh` and store the result.
    ///
    /// The lock is held across `refresh`, so concurrent callers wait for one
    /// refresh rather than each spawning their own subprocess — which is the
    /// point on a device where the subprocess is the expensive part.
    pub fn get_or_refresh(&self, ttl: Duration, refresh: impl FnOnce() -> T) -> T {
        let mut slot = self.slot.safe_lock();
        if let Some((at, value)) = slot.as_ref() {
            if at.elapsed() < ttl {
                return value.clone();
            }
        }
        let value = refresh();
        *slot = Some((Instant::now(), value.clone()));
        value
    }

    /// Force the next `get_or_refresh` to re-read. Call after a mutation that
    /// makes the cached copy wrong by definition.
    pub fn invalidate(&self) {
        *self.slot.safe_lock() = None;
    }
}

impl<T> Default for Cached<T> {
    fn default() -> Self {
        Self {
            slot: Mutex::new(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    #[test]
    fn serves_from_cache_within_ttl() {
        let calls = AtomicU32::new(0);
        let cached: Cached<u32> = Cached::default();
        let refresh = || {
            calls.fetch_add(1, Ordering::Relaxed);
            7
        };

        assert_eq!(cached.get_or_refresh(Duration::from_secs(60), refresh), 7);
        assert_eq!(cached.get_or_refresh(Duration::from_secs(60), refresh), 7);
        assert_eq!(
            calls.load(Ordering::Relaxed),
            1,
            "second call should hit cache"
        );
    }

    #[test]
    fn refreshes_once_ttl_elapses() {
        let calls = AtomicU32::new(0);
        let cached: Cached<u32> = Cached::default();
        let refresh = || calls.fetch_add(1, Ordering::Relaxed);

        cached.get_or_refresh(Duration::from_secs(60), refresh);
        // A zero TTL always counts as stale.
        cached.get_or_refresh(Duration::ZERO, refresh);
        assert_eq!(calls.load(Ordering::Relaxed), 2);
    }
}

/// A source keeps its last successful sample when a refresh fails. Attempts
/// also obey the TTL, so a failed source cannot trigger a subprocess storm.
pub struct Observed<T> {
    slot: Mutex<Observation<T>>,
}
struct Observation<T> {
    attempted: Option<Instant>,
    sampled: Option<Instant>,
    sampled_unix_ms: Option<u128>,
    value: Option<T>,
    error: Option<String>,
}
#[derive(Clone, serde::Serialize)]
pub struct Freshness {
    pub sampled_at_ms: Option<u128>,
    pub age_ms: Option<u128>,
    pub ttl_ms: u128,
    pub stale: bool,
    pub error: Option<String>,
}
pub struct Sample<T> {
    pub value: Option<T>,
    pub freshness: Freshness,
}
impl<T> Default for Observed<T> {
    fn default() -> Self {
        Self {
            slot: Mutex::new(Observation {
                attempted: None,
                sampled: None,
                sampled_unix_ms: None,
                value: None,
                error: None,
            }),
        }
    }
}
impl<T: Clone> Observed<T> {
    pub fn read(&self, ttl: Duration, refresh: impl FnOnce() -> Result<T, String>) -> Sample<T> {
        let mut slot = self.slot.safe_lock();
        if slot.attempted.is_none_or(|at| at.elapsed() >= ttl) {
            match refresh() {
                Ok(value) => {
                    slot.value = Some(value);
                    slot.sampled = Some(Instant::now());
                    slot.sampled_unix_ms = Some(
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis(),
                    );
                    slot.error = None;
                }
                Err(error) => slot.error = Some(error),
            }
            slot.attempted = Some(Instant::now());
        }
        let age = slot.sampled.map(|at| at.elapsed());
        Sample {
            value: slot.value.clone(),
            freshness: Freshness {
                sampled_at_ms: slot.sampled_unix_ms,
                age_ms: age.map(|d| d.as_millis()),
                ttl_ms: ttl.as_millis(),
                stale: slot.error.is_some() || age.is_none_or(|age| age > ttl),
                error: slot.error.clone(),
            },
        }
    }
    pub fn invalidate(&self) {
        self.slot.safe_lock().attempted = None;
    }
}
#[cfg(test)]
mod observation_tests {
    use super::*;
    #[test]
    fn failed_refresh_retains_sample_and_throttles_retries() {
        let source = Observed::default();
        assert_eq!(source.read(Duration::ZERO, || Ok(42)).value, Some(42));
        let failed = source.read(Duration::ZERO, || Err("radio offline".into()));
        assert_eq!(failed.value, Some(42));
        assert!(failed.freshness.stale);
        assert_eq!(failed.freshness.error.as_deref(), Some("radio offline"));
        source.read(Duration::from_secs(60), || panic!("retry must respect TTL"));
        source.invalidate();
        let recovered = source.read(Duration::from_secs(60), || Ok(43));
        assert_eq!(recovered.value, Some(43));
        assert!(!recovered.freshness.stale);
    }
    #[test]
    fn first_failure_is_missing_rather_than_a_fabricated_reading() {
        let source: Observed<u32> = Observed::default();
        let sample = source.read(Duration::ZERO, || Err("unavailable".into()));
        assert!(sample.value.is_none());
        assert!(sample.freshness.sampled_at_ms.is_none());
        assert!(sample.freshness.stale);
    }
    #[test]
    fn concurrent_consumers_share_one_refresh() {
        let source = std::sync::Arc::new(Observed::default());
        let calls = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        std::thread::scope(|scope| {
            for _ in 0..8 {
                scope.spawn(|| {
                    source.read(Duration::from_secs(60), || {
                        calls.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                        Ok(42)
                    });
                });
            }
        });
        assert_eq!(calls.load(std::sync::atomic::Ordering::Relaxed), 1);
    }
}
