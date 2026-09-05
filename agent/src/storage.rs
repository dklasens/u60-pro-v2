//! Data-partition state files: complete replacement or the previous file survives.
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::os::unix::fs::OpenOptionsExt;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT: AtomicU64 = AtomicU64::new(0);

pub fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("state path has no parent"))?;
    let name = path
        .file_name()
        .ok_or_else(|| io::Error::other("state path has no filename"))?
        .to_string_lossy();
    let temp = parent.join(format!(
        ".{name}.{}-{}.tmp",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp, path)?;
        fs::File::open(parent)?.sync_all()
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

/// Persist deletion of a recovery record across power loss.
pub fn durable_remove(path: &Path) -> io::Result<()> {
    fs::remove_file(path)?;
    fs::File::open(
        path.parent()
            .ok_or_else(|| io::Error::other("state path has no parent"))?,
    )?
    .sync_all()
}
