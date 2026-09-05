use crate::deploy::Channel;
use crate::identity::{Identity, PROBE};
use crate::model::InstallerError;
use std::fs;
use std::path::Path;

const SCRIPT: &str = include_str!("../../../scripts/device/transaction.sh");
const REMOTE_SCRIPT: &str = "/data/local/tmp/open-u60-transaction.sh";

pub struct DeploymentTransaction {
    id: String,
    identity: Identity,
}
impl DeploymentTransaction {
    pub fn begin(
        channel: &Channel,
        identity: &Identity,
        work: &Path,
    ) -> Result<Self, InstallerError> {
        identity.require_same(&Identity::from_probe(&channel.shell(PROBE, false)?)?)?;
        let transaction = Self {
            id: uuid::Uuid::new_v4().to_string(),
            identity: identity.clone(),
        };
        let script = work.join("transaction.sh");
        fs::write(&script, SCRIPT)
            .map_err(|e| InstallerError::internal("preparing transaction", e))?;
        channel.shell("mkdir -p /data/local/tmp", true)?;
        let listener = work.join("stop-owned-listener.sh");
        fs::write(
            &listener,
            include_str!("../../../scripts/device/stop-owned-listener.sh"),
        )
        .map_err(|e| InstallerError::internal("preparing listener helper", e))?;
        for (local, remote) in [
            (&script, REMOTE_SCRIPT),
            (&listener, "/data/local/tmp/stop_open_u60_listener.sh"),
        ] {
            use sha2::{Digest, Sha256};
            let hash =
                hex::encode(Sha256::digest(fs::read(local).map_err(|e| {
                    InstallerError::internal("reading management script", e)
                })?));
            channel.push(local, &format!("{remote}.new"))?;
            channel.shell(&format!("set -e\ntest \"$(sha256sum {remote}.new | awk '{{print $1}}')\" = {hash}\nsh -n {remote}.new\nchmod 700 {remote}.new\nmv {remote}.new {remote}"), true)?;
        }
        transaction.action(channel, "begin")?;
        Ok(transaction)
    }
    fn action(&self, channel: &Channel, action: &str) -> Result<(), InstallerError> {
        identity_check(channel, &self.identity)?;
        channel.shell(
            &format!(
                "sh {REMOTE_SCRIPT} {action} {} {}",
                self.id, self.identity.fingerprint
            ),
            true,
        )?;
        Ok(())
    }
    pub fn complete(&self, channel: &Channel) -> Result<(), InstallerError> {
        self.action(channel, "complete")
    }
    pub fn restore(&self, channel: &Channel) -> Result<(), InstallerError> {
        identity_check(channel, &self.identity)?;
        self.action(channel, "restore")?;
        Ok(())
    }
    pub fn recovery_details(&self) -> String {
        format!("Recovery snapshot: /data/local/tmp/open-u60-transactions/{}. Reconnect to the same verified modem and run: sh {REMOTE_SCRIPT} restore {} {}", self.id, self.id, self.identity.fingerprint)
    }
}
fn identity_check(channel: &Channel, expected: &Identity) -> Result<(), InstallerError> {
    expected.require_same(&Identity::from_probe(&channel.shell(PROBE, false)?)?)
}
