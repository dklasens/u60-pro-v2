//! Host prerequisites and an application-owned SSH identity.
use crate::model::InstallerError;
use crate::process::{find_on_path, run_timeout};
use ssh_key::{Algorithm, LineEnding, PrivateKey};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub fn key_path() -> Result<PathBuf, InstallerError> {
    Ok(dirs::data_local_dir()
        .ok_or_else(|| {
            InstallerError::internal("SSH identity", "local data directory unavailable")
        })?
        .join("open-u60-pro/ssh/id_ed25519"))
}

pub fn protect_directory(path: &Path) -> Result<(), InstallerError> {
    fs::create_dir_all(path)
        .map_err(|e| InstallerError::internal("creating private directory", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|e| InstallerError::internal("protecting private directory", e))?;
    }
    #[cfg(windows)]
    {
        let whoami = find_on_path("whoami").ok_or_else(|| {
            InstallerError::internal("protecting SSH identity", "whoami unavailable")
        })?;
        let output = run_timeout(
            &whoami,
            &["/user".into(), "/fo".into(), "csv".into(), "/nh".into()],
            None,
            "identifying the current Windows account",
            Duration::from_secs(10),
        )?;
        let text = String::from_utf8_lossy(&output.stdout);
        let sid = text
            .split('"')
            .find(|v| {
                v.starts_with("S-1-")
                    && v.bytes()
                        .all(|b| b.is_ascii_digit() || b == b'-' || b == b'S')
            })
            .ok_or_else(|| {
                InstallerError::internal(
                    "protecting SSH identity",
                    "Windows account SID unavailable",
                )
            })?;
        let icacls = find_on_path("icacls").ok_or_else(|| {
            InstallerError::internal("protecting SSH identity", "icacls unavailable")
        })?;
        let output = run_timeout(
            &icacls,
            &[
                path.as_os_str().into(),
                "/inheritance:r".into(),
                "/grant:r".into(),
                format!("*{sid}:(OI)(CI)F").into(),
            ],
            None,
            "protecting the SSH identity directory",
            Duration::from_secs(10),
        )?;
        if !output.status.success() {
            return Err(InstallerError::internal(
                "protecting SSH identity",
                "Windows ACL update failed",
            ));
        }
    }
    Ok(())
}

pub fn ensure_key() -> Result<String, InstallerError> {
    ensure_key_at(&key_path()?)
}

fn ensure_key_at(path: &Path) -> Result<String, InstallerError> {
    let parent = path.parent().unwrap();
    protect_directory(parent)?;
    let key = if path.exists() {
        PrivateKey::read_openssh_file(path).map_err(|_| InstallerError::new("The installer's SSH identity could not be read", "Restore this application's private SSH identity from your backup. Your personal SSH keys have not been changed.", "Invalid or encrypted installer-managed SSH identity."))?
    } else {
        let key = PrivateKey::random(&mut rand::rngs::OsRng, Algorithm::Ed25519)
            .map_err(|e| InstallerError::internal("generating installer SSH identity", e))?;
        let mut temporary = tempfile::NamedTempFile::new_in(parent)
            .map_err(|e| InstallerError::internal("staging SSH identity", e))?;
        use std::io::Write;
        temporary
            .write_all(
                key.to_openssh(LineEnding::LF)
                    .map_err(|e| InstallerError::internal("encoding SSH identity", e))?
                    .as_bytes(),
            )
            .map_err(|e| InstallerError::internal("writing SSH identity", e))?;
        temporary
            .as_file()
            .sync_all()
            .map_err(|e| InstallerError::internal("syncing SSH identity", e))?;
        temporary
            .persist_noclobber(path)
            .map_err(|e| InstallerError::internal("saving SSH identity", e))?;
        key
    };
    if key.is_encrypted() {
        return Err(InstallerError::internal(
            "installer SSH identity",
            "The managed key must support noninteractive authentication.",
        ));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|e| InstallerError::internal("protecting SSH identity", e))?;
    }
    let public = key
        .public_key()
        .to_openssh()
        .map_err(|e| InstallerError::internal("encoding public SSH identity", e))?;
    fs::write(path.with_extension("pub"), format!("{public}\n"))
        .map_err(|e| InstallerError::internal("saving public SSH identity", e))?;
    Ok(public)
}

pub fn prerequisites(adb: Option<&Path>, gateway: &str) -> Result<(), InstallerError> {
    let ssh = find_on_path("ssh").ok_or_else(|| InstallerError::new("OpenSSH Client is required", "On Windows, install OpenSSH Client from Settings → Optional features, then check again. No modem changes were made.", "SSH is required for all installation paths, including ADB and unlock."))?;
    let output = run_timeout(
        &ssh,
        &["-V".into()],
        None,
        "checking OpenSSH Client",
        Duration::from_secs(10),
    )?;
    if !output.status.success() {
        return Err(InstallerError::internal(
            "checking SSH",
            "OpenSSH Client did not run successfully",
        ));
    }
    if let Some(adb) = adb {
        let output = run_timeout(
            adb,
            &["version".into()],
            None,
            "checking bundled ADB",
            Duration::from_secs(10),
        )?;
        if !output.status.success() {
            return Err(InstallerError::internal(
                "checking ADB",
                "ADB did not run successfully",
            ));
        }
    }
    ensure_key()?;
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| InstallerError::internal("checking modem network", e))?;
    client.get(format!("http://{gateway}/")).send().and_then(reqwest::blocking::Response::error_for_status).map_err(|_| InstallerError::new("Connect this computer to the modem network", "Join the modem Wi-Fi or enable USB tethering, then check again. A working LAN connection is required for verification and dashboard access.", "The stock modem HTTP interface was not reachable from this computer."))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn managed_identity_is_reusable_and_public_key_is_derived_from_private_key() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("private directory/id_ed25519");
        let public = ensure_key_at(&path).unwrap();
        fs::write(path.with_extension("pub"), "stale public key").unwrap();
        assert_eq!(ensure_key_at(&path).unwrap(), public);
        assert_eq!(
            fs::read_to_string(path.with_extension("pub"))
                .unwrap()
                .trim(),
            public
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        fs::write(&path, "corrupted private key").unwrap();
        assert!(ensure_key_at(&path).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "corrupted private key");
    }
}
