//! Discover and recover a durable device transaction after application restart.
use crate::{
    deploy::Channel,
    identity::{Identity, PROBE},
    model::InstallerError,
};
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingRecovery {
    pub id: String,
    pub incomplete: bool,
}
const BASE: &str = "/data/local/tmp/open-u60-transactions";
fn error(details: &str) -> InstallerError {
    InstallerError::new("An interrupted installation needs attention", "Reconnect the same modem. Restore the retained snapshot before starting another installation; do not delete recovery files.", details)
}

fn parse(text: &str) -> Result<Option<PendingRecovery>, InstallerError> {
    let Some((kind, id)) = text.trim().split_once(':') else {
        return if text.trim() == "none" {
            Ok(None)
        } else {
            Err(error("The recovery marker could not be read."))
        };
    };
    if !["pending", "incomplete"].contains(&kind) || uuid::Uuid::parse_str(id).is_err() {
        return Err(error(
            "The recovery marker is invalid; manual inspection is required.",
        ));
    }
    Ok(Some(PendingRecovery {
        id: id.into(),
        incomplete: kind == "incomplete",
    }))
}

pub(crate) fn inspect(channel: &Channel) -> Result<Option<PendingRecovery>, InstallerError> {
    parse(&channel.shell(&format!("if [ -f {BASE}/active ]; then printf 'pending:'; cat {BASE}/active; elif [ -d {BASE}/lock ]; then printf 'incomplete:'; cat {BASE}/lock/owner; else printf none; fi"), true)?)
}

pub(crate) fn restore(
    channel: &Channel,
    identity: &Identity,
    expected_id: &str,
) -> Result<(), InstallerError> {
    identity.require_same(&Identity::from_probe(&channel.shell(PROBE, false)?)?)?;
    let pending =
        inspect(channel)?.ok_or_else(|| error("No pending snapshot remains; detect again."))?;
    if pending.id != expected_id {
        return Err(error("The pending transaction changed; detect again."));
    }
    let script = "/data/local/tmp/open-u60-transaction.sh";
    let expected_hash = hex::encode(Sha256::digest(include_bytes!(
        "../../../scripts/device/transaction.sh"
    )));
    if channel.shell(&format!("sha256sum {script} | awk '{{print $1}}'"), true)? != expected_hash {
        return Err(error("The on-device recovery helper differs from this installer. Use the recovery instructions from the release that created the snapshot."));
    }
    let action = if pending.incomplete {
        "discard-incomplete"
    } else {
        "restore"
    };
    // IDs are parsed as UUIDs and fingerprints originate in authenticated identity.
    channel.shell(
        &format!(
            "sh {script} {action} {} {}",
            pending.id, identity.fingerprint
        ),
        true,
    )?;
    if inspect(channel)?.is_some() {
        return Err(error("Recovery has not cleared the pending transaction."));
    }
    identity.require_same(&Identity::from_probe(&channel.shell(PROBE, false)?)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recovery_markers_require_a_real_transaction_id() {
        assert!(parse("none").unwrap().is_none());
        let id = uuid::Uuid::new_v4();
        assert!(
            !parse(&format!("pending:{id}\n"))
                .unwrap()
                .unwrap()
                .incomplete
        );
        assert!(
            parse(&format!("incomplete:{id}"))
                .unwrap()
                .unwrap()
                .incomplete
        );
        for input in [
            "pending:../../other",
            "pending:$(command)",
            "",
            "unknown:id",
        ] {
            assert!(parse(input).is_err());
        }
    }
}
