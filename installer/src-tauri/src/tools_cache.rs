//! Content-addressed ADB staging: every executable and library is verified.
use crate::model::InstallerError;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
#[derive(Deserialize)]
struct Lock {
    platforms: BTreeMap<String, Platform>,
}
#[derive(Deserialize)]
struct Platform {
    files: BTreeMap<String, String>,
}
fn error(detail: impl std::fmt::Display) -> InstallerError {
    InstallerError::internal("verifying bundled ADB", detail)
}

pub fn stage(source: &Path, root: &Path, windows: bool) -> Result<PathBuf, InstallerError> {
    let lock: Lock =
        serde_json::from_str(include_str!("../../platform-tools.lock.json")).map_err(error)?;
    let files = &lock.platforms[if windows { "windows" } else { "darwin" }].files;
    stage_files(source, root, files, if windows { "adb.exe" } else { "adb" })
}
fn valid(root: &Path, files: &BTreeMap<String, String>) -> bool {
    files.iter().all(|(name, digest)| {
        let path = root.join(name);
        fs::symlink_metadata(&path).is_ok_and(|m| m.is_file() && !m.file_type().is_symlink())
            && fs::read(path).is_ok_and(|bytes| hex::encode(Sha256::digest(bytes)) == *digest)
    })
}
fn stage_files(
    source: &Path,
    root: &Path,
    files: &BTreeMap<String, String>,
    executable: &str,
) -> Result<PathBuf, InstallerError> {
    let digest = hex::encode(Sha256::digest(serde_json::to_vec(files).map_err(error)?));
    let destination = root.join(digest);
    if !valid(&destination, files) {
        if !valid(source, files) {
            return Err(error("The bundled ADB files are incomplete or have changed. Reinstall this desktop application."));
        }
        fs::create_dir_all(root).map_err(error)?;
        let stage = tempfile::tempdir_in(root).map_err(error)?;
        for name in files.keys() {
            let path = stage.path().join(name);
            fs::create_dir_all(path.parent().unwrap()).map_err(error)?;
            fs::copy(source.join(name), &path).map_err(error)?;
        }
        if !valid(stage.path(), files) {
            return Err(error("ADB staging did not pass integrity verification"));
        }
        if destination.exists() {
            // Only our content-addressed cache directory is replaced.
            fs::remove_dir_all(&destination).map_err(error)?;
        }
        fs::rename(stage.path(), &destination).map_err(error)?;
    }
    let executable = destination.join(executable);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o755)).map_err(error)?;
    }
    Ok(executable)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn incomplete_or_modified_cache_is_repaired_from_verified_source() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source");
        let root = temp.path().join("cache");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("adb"), "sample-program").unwrap();
        let files =
            BTreeMap::from([("adb".into(), hex::encode(Sha256::digest(b"sample-program")))]);
        let adb = stage_files(&source, &root, &files, "adb").unwrap();
        fs::write(&adb, "corrupted").unwrap();
        assert_eq!(
            fs::read(stage_files(&source, &root, &files, "adb").unwrap()).unwrap(),
            b"sample-program"
        );
        fs::write(&adb, "corrupted").unwrap();
        fs::write(source.join("adb"), "corrupted").unwrap();
        assert!(stage_files(&source, &root, &files, "adb").is_err());
    }
}
