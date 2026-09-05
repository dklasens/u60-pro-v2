//! Private UCI staging prevents failed requests leaking into another commit.
use std::collections::BTreeSet;
use std::fs;
use std::os::unix::fs::DirBuilderExt;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use crate::{process::BoundedCommand, ubus};

pub static WIFI_CHANGE: Mutex<()> = Mutex::new(());
static NEXT: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug)]
pub struct Change {
    pub key: String,
    pub before: String,
    pub after: String,
}

trait Backend {
    fn check(&self, changes: &[Change]) -> Result<(), String>;
    fn set(&self, key: &str, value: &str) -> Result<(), String>;
    fn commit(&self, config: &str) -> Result<(), String>;
    fn apply(&self) -> Result<(), String>;
}

struct UciStage {
    directory: PathBuf,
}
impl UciStage {
    fn new() -> Result<Self, String> {
        let directory = PathBuf::from(format!(
            "/tmp/zte-agent-uci-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::DirBuilder::new()
            .mode(0o700)
            .create(&directory)
            .map_err(|e| e.to_string())?;
        Ok(Self { directory })
    }
    fn command(&self, args: &[&str]) -> Result<String, String> {
        let output = Command::new("uci")
            .arg("-t")
            .arg(&self.directory)
            .args(args)
            .bounded_output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            // Do not include argv or UCI stderr: either can contain Wi-Fi keys.
            return Err(format!(
                "UCI {} failed",
                args.first().unwrap_or(&"operation")
            ));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().into())
    }
}
impl Drop for UciStage {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}
impl Backend for UciStage {
    fn check(&self, changes: &[Change]) -> Result<(), String> {
        for config in configs(changes) {
            let output = Command::new("uci")
                .args(["changes", config])
                .bounded_output()
                .map_err(|e| e.to_string())?;
            if !output.status.success() || !output.stdout.is_empty() {
                return Err(format!(
                    "{config} has pending firmware changes; wait and retry"
                ));
            }
        }
        for change in changes {
            if ubus::uci_get(&change.key)? != change.before {
                return Err(
                    "Wi-Fi configuration changed during this request; refresh and retry".into(),
                );
            }
        }
        Ok(())
    }
    fn set(&self, key: &str, value: &str) -> Result<(), String> {
        self.command(&["set", &format!("{key}={value}")])
            .map(|_| ())
    }
    fn commit(&self, config: &str) -> Result<(), String> {
        self.command(&["commit", config]).map(|_| ())
    }
    fn apply(&self) -> Result<(), String> {
        ubus::call("zwrt_wlan", "reload", Some("{}")).map(|_| ())
    }
}
fn configs(changes: &[Change]) -> BTreeSet<&str> {
    changes
        .iter()
        .map(|c| c.key.split('.').next().unwrap())
        .collect()
}

fn execute(backend: &impl Backend, changes: &[Change]) -> Result<(), String> {
    backend.check(changes)?;
    for change in changes {
        backend.set(&change.key, &change.after)?;
    }
    // Staged values are private; the live configuration must still match the
    // snapshot before any package is committed.
    backend.check(changes)?;
    let result = (|| {
        for config in configs(changes) {
            backend.commit(config)?;
        }
        backend.apply()
    })();
    if let Err(error) = result {
        let mut errors = Vec::new();
        for change in changes {
            if let Err(e) = backend.set(&change.key, &change.before) {
                errors.push(e);
            }
        }
        for config in configs(changes) {
            if let Err(e) = backend.commit(config) {
                errors.push(e);
            }
        }
        if let Err(e) = backend.apply() {
            errors.push(e);
        }
        return Err(if errors.is_empty() {
            format!("{error}; previous Wi-Fi configuration restored")
        } else {
            format!(
                "{error}; restoration needs attention: {}",
                errors.join("; ")
            )
        });
    }
    Ok(())
}

pub fn apply(changes: &[Change]) -> Result<(), String> {
    if changes.is_empty() {
        return Ok(());
    }
    execute(&UciStage::new()?, changes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;
    struct Fake {
        live: RefCell<HashMap<String, String>>,
        staged: RefCell<HashMap<String, String>>,
        fail: RefCell<Option<&'static str>>,
    }
    impl Backend for Fake {
        fn check(&self, _: &[Change]) -> Result<(), String> {
            Ok(())
        }
        fn set(&self, key: &str, value: &str) -> Result<(), String> {
            if self.fail.borrow().as_deref() == Some("set") {
                self.fail.take();
                return Err("set failed".into());
            }
            self.staged.borrow_mut().insert(key.into(), value.into());
            Ok(())
        }
        fn commit(&self, config: &str) -> Result<(), String> {
            if self.fail.borrow().as_deref() == Some(config) {
                self.fail.take();
                return Err("commit failed".into());
            }
            for (k, v) in self
                .staged
                .borrow()
                .iter()
                .filter(|(k, _)| k.starts_with(config))
            {
                self.live.borrow_mut().insert(k.clone(), v.clone());
            }
            Ok(())
        }
        fn apply(&self) -> Result<(), String> {
            if self.fail.borrow().as_deref() == Some("reload") {
                self.fail.take();
                return Err("reload failed".into());
            }
            Ok(())
        }
    }
    #[test]
    fn stage_commit_and_reload_failures_preserve_previous_configuration() {
        let changes = vec![
            Change {
                key: "wireless.main_2g.ssid".into(), // gitleaks:allow -- UCI option path, not a credential.
                before: "old".into(),
                after: "new".into(),
            },
            Change {
                key: "zte_mbb.wifi.wifi_onoff".into(),
                before: "1".into(),
                after: "0".into(),
            },
        ];
        for failure in ["set", "zte_mbb", "reload"] {
            let original: HashMap<_, _> = changes
                .iter()
                .map(|c| (c.key.clone(), c.before.clone()))
                .collect();
            let fake = Fake {
                live: RefCell::new(original.clone()),
                staged: RefCell::default(),
                fail: RefCell::new(Some(failure)),
            };
            assert!(execute(&fake, &changes).is_err());
            assert_eq!(*fake.live.borrow(), original, "failure at {failure}");
        }
    }
}
