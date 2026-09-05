use std::fs;
use std::io::{Cursor, Read};
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use cbc::{Decryptor, Encryptor};
use cipher::block_padding::Pkcs7;
use cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use des::TdesEde3;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use rand::RngCore;
use reqwest::blocking::{multipart, Client};
use reqwest::header::{ORIGIN, REFERER};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tar::{Archive, Builder, Header};

use crate::identity::Identity;
use crate::model::InstallerError;

const INNER: &str = "tmp/back_parameter_r1.tgz";
const MD5_PATH: &str = "tmp/back_parameter_r.md5";
const RC_LOCAL: &str = "etc/rc.local";

struct Router {
    base: String,
    password: String,
    client: Client,
    session: Option<String>,
}

impl Router {
    fn new(gateway: &str, password: &str) -> Result<Self, InstallerError> {
        let client = Client::builder()
            .cookie_store(true)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(120))
            .user_agent("open-u60-pro-installer")
            .build()
            .map_err(|error| InstallerError::internal("creating the router HTTP client", error))?;
        Ok(Self {
            base: format!("http://{gateway}"),
            password: password.to_owned(),
            client,
            session: None,
        })
    }

    fn call(
        &self,
        object: &str,
        method: &str,
        params: Value,
        session: Option<&str>,
    ) -> Result<Value, InstallerError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let body = json!([{
            "jsonrpc": "2.0",
            "id": 1,
            "method": "call",
            "params": [
                session.or(self.session.as_deref()).unwrap_or(""),
                object,
                method,
                params
            ]
        }]);
        self.client
            .post(format!("{}/ubus/?t={timestamp}", self.base))
            .header(ORIGIN, &self.base)
            .header(REFERER, format!("{}/", self.base))
            .json(&body)
            .send()
            .and_then(reqwest::blocking::Response::error_for_status)
            .and_then(reqwest::blocking::Response::json)
            .map_err(|error| {
                InstallerError::new(
                    "The modem’s web API did not respond as expected",
                    "Make sure this computer is connected to the modem and try detection again.",
                    format!("{object}.{method}: {error}"),
                )
            })
    }

    fn login(&mut self) -> Result<(), InstallerError> {
        let zero_session = "00000000000000000000000000000000";
        let info = self.call("zwrt_web", "web_login_info", json!({}), Some(zero_session))?;
        let salt = info
            .pointer("/0/result/1/zte_web_sault")
            .and_then(Value::as_str)
            .ok_or_else(|| InstallerError::internal("router login", "login salt was absent"))?;
        let inner = hex::encode_upper(Sha256::digest(self.password.as_bytes()));
        let response_hash = hex::encode_upper(Sha256::digest(format!("{inner}{salt}").as_bytes()));
        let response = self.call(
            "zwrt_web",
            "web_login",
            json!({ "password": response_hash }),
            Some(zero_session),
        )?;
        self.session = response
            .pointer("/0/result/1/ubus_rpc_session")
            .and_then(Value::as_str)
            .map(str::to_owned);
        if self.session.is_none() {
            return Err(InstallerError::new(
                "Couldn’t sign in to the modem",
                "Check the router admin password and try again.",
                format!("zwrt_web.web_login response: {response}"),
            ));
        }
        Ok(())
    }

    fn get(&self, path: &str) -> Result<Vec<u8>, InstallerError> {
        self.client
            .get(format!("{}{}", self.base, path))
            .header(REFERER, format!("{}/", self.base))
            .send()
            .and_then(reqwest::blocking::Response::error_for_status)
            .and_then(reqwest::blocking::Response::bytes)
            .map(|bytes| bytes.to_vec())
            .map_err(|error| {
                InstallerError::new(
                    "Couldn’t download the modem configuration backup",
                    "Keep the modem connected and try again. No restore was attempted.",
                    error.to_string(),
                )
            })
    }

    fn upload(&self, data: Vec<u8>) -> Result<Value, InstallerError> {
        let part = multipart::Part::bytes(data)
            .file_name("back_parameter")
            .mime_str("application/octet-stream")
            .map_err(|error| InstallerError::internal("preparing restore upload", error))?;
        let form = multipart::Form::new()
            .text("filename", "/tmp/back_parameter")
            .part("filedata", part);
        self.client
            .post(format!("{}/cgi-bin/cgi-upload", self.base))
            .header(ORIGIN, &self.base)
            .header(REFERER, format!("{}/", self.base))
            .multipart(form)
            .send()
            .and_then(reqwest::blocking::Response::error_for_status)
            .and_then(reqwest::blocking::Response::json)
            .map_err(|error| {
                InstallerError::new(
                    "The patched backup could not be uploaded",
                    "The restore was not triggered. Keep the modem connected and retry.",
                    error.to_string(),
                )
            })
    }
}

fn evp_bytes_to_key(password: &[u8], salt: &[u8]) -> ([u8; 24], [u8; 8]) {
    let mut material = Vec::with_capacity(64);
    let mut previous = Vec::new();
    while material.len() < 32 {
        let mut hasher = Sha256::new();
        hasher.update(&previous);
        hasher.update(password);
        hasher.update(salt);
        previous = hasher.finalize().to_vec();
        material.extend_from_slice(&previous);
    }
    let mut key = [0_u8; 24];
    let mut iv = [0_u8; 8];
    key.copy_from_slice(&material[..24]);
    iv.copy_from_slice(&material[24..32]);
    (key, iv)
}

fn decrypt_backup(data: &[u8], password: &str) -> Result<Vec<u8>, InstallerError> {
    if data.len() < 24 || &data[..8] != b"Salted__" || !(data.len() - 16).is_multiple_of(8) {
        return Err(InstallerError::new(
            "The downloaded backup has an unexpected format",
            "Do not restore this file. Retry, and report the diagnostic details if it repeats.",
            "Backup is not an OpenSSL Salted__ 3DES-CBC container.",
        ));
    }
    let (key, iv) = evp_bytes_to_key(password.as_bytes(), &data[8..16]);
    Decryptor::<TdesEde3>::new(&key.into(), &iv.into())
        .decrypt_padded_vec_mut::<Pkcs7>(&data[16..])
        .map_err(|_| {
            InstallerError::new(
                "The backup-key suffix was not accepted",
                "Check that the suffix matches this modem family and firmware, then try again.",
                "3DES-CBC decryption failed PKCS#7 validation (wrong key or corrupt backup).",
            )
        })
}

fn encrypt_backup(data: &[u8], password: &str) -> Vec<u8> {
    let mut salt = [0_u8; 8];
    rand::thread_rng().fill_bytes(&mut salt);
    let (key, iv) = evp_bytes_to_key(password.as_bytes(), &salt);
    let encrypted =
        Encryptor::<TdesEde3>::new(&key.into(), &iv.into()).encrypt_padded_vec_mut::<Pkcs7>(data);
    [
        b"Salted__".as_slice(),
        salt.as_slice(),
        encrypted.as_slice(),
    ]
    .concat()
}

fn gzip_tar(entries: Vec<(Header, Vec<u8>)>) -> Result<Vec<u8>, InstallerError> {
    let output = Vec::new();
    let encoder = GzEncoder::new(output, Compression::default());
    let mut builder = Builder::new(encoder);
    for (mut header, data) in entries {
        header.set_size(data.len() as u64);
        header.set_cksum();
        builder
            .append(&header, Cursor::new(data))
            .map_err(|error| {
                InstallerError::internal("rebuilding the configuration archive", error)
            })?;
    }
    let encoder = builder
        .into_inner()
        .map_err(|error| InstallerError::internal("finishing the configuration archive", error))?;
    encoder
        .finish()
        .map_err(|error| InstallerError::internal("compressing the configuration archive", error))
}

fn read_inner(outer: &[u8]) -> Result<Vec<u8>, InstallerError> {
    let decoder = GzDecoder::new(Cursor::new(outer));
    let mut archive = Archive::new(decoder);
    for item in archive
        .entries()
        .map_err(|error| InstallerError::internal("reading the outer backup", error))?
    {
        let mut entry =
            item.map_err(|error| InstallerError::internal("reading an outer backup entry", error))?;
        if entry.path().ok().as_deref() == Some(Path::new(INNER)) {
            let mut bytes = Vec::new();
            entry
                .read_to_end(&mut bytes)
                .map_err(|error| InstallerError::internal("reading the inner backup", error))?;
            return Ok(bytes);
        }
    }
    Err(InstallerError::new(
        "The modem backup layout is not recognised",
        "No restore was attempted. This firmware may need to be reviewed before installation.",
        format!("Missing {INNER} in the decrypted backup."),
    ))
}

fn usb_path(text: &str) -> Option<String> {
    text.split_whitespace().find_map(|token| {
        let cleaned = token.trim_matches(|character: char| {
            matches!(character, '`' | '\'' | '"' | ';' | ')' | '(' | '>' | '<')
        });
        (cleaned.starts_with("/sys/") && cleaned.contains("usb_op")).then(|| cleaned.to_owned())
    })
}

fn patch_outer(outer: &[u8], log: &dyn Fn(&str)) -> Result<Vec<u8>, InstallerError> {
    let inner = read_inner(outer)?;
    let decoder = GzDecoder::new(Cursor::new(inner));
    let mut archive = Archive::new(decoder);
    let mut entries = Vec::new();
    let mut patched = false;

    for item in archive
        .entries()
        .map_err(|error| InstallerError::internal("reading configuration entries", error))?
    {
        let mut entry =
            item.map_err(|error| InstallerError::internal("reading a configuration entry", error))?;
        let path = entry
            .path()
            .map_err(|error| InstallerError::internal("reading a configuration path", error))?
            .into_owned();
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|error| InstallerError::internal("reading configuration data", error))?;
        let mut header = entry.header().clone();
        if path == Path::new(RC_LOCAL) && header.entry_type().is_file() {
            let text = String::from_utf8_lossy(&bytes);
            let node = usb_path(&text).ok_or_else(|| InstallerError::new(
                "This firmware’s USB debug path could not be identified safely",
                "No restore was attempted. Please report the diagnostic details for firmware review.",
                "No /sys/.../usb_op path was present in etc/rc.local.",
            ))?;
            let payload = format!("echo 1 > {node}");
            if text.contains(&payload) {
                return Err(InstallerError::new(
                    "The backup already enables ADB",
                    "Reboot the modem and detect again. If ADB still does not appear, check the USB driver.",
                    format!("etc/rc.local already contains: {payload}"),
                ));
            }
            let mut lines = text.lines().map(str::to_owned).collect::<Vec<_>>();
            let position = lines
                .iter()
                .position(|line| line.trim() == "#!/bin/sh")
                .map_or(0, |index| index + 1);
            lines.insert(position, payload.clone());
            bytes = format!("{}\n", lines.join("\n")).into_bytes();
            log(&format!(
                "[+] Prepared the boot-time ADB setting using {node}"
            ));
            patched = true;
        }
        header
            .set_path(&path)
            .map_err(|error| InstallerError::internal("preserving a backup path", error))?;
        entries.push((header, bytes));
    }
    if !patched {
        return Err(InstallerError::new(
            "The modem backup does not contain rc.local",
            "No restore was attempted. This firmware may not be compatible with the unlock flow.",
            format!("Missing {RC_LOCAL} in inner backup."),
        ));
    }
    let rebuilt_inner = gzip_tar(entries)?;
    let digest = format!("{:x}\n", md5::compute(&rebuilt_inner));

    fn outer_header(path: &str, size: usize) -> Result<Header, InstallerError> {
        let mut header = Header::new_gnu();
        header
            .set_path(path)
            .map_err(|error| InstallerError::internal("creating an outer backup path", error))?;
        header.set_mode(0o644);
        header.set_uid(0);
        header.set_gid(0);
        header.set_size(size as u64);
        header.set_cksum();
        Ok(header)
    }

    gzip_tar(vec![
        (outer_header(INNER, rebuilt_inner.len())?, rebuilt_inner),
        (outer_header(MD5_PATH, digest.len())?, digest.into_bytes()),
    ])
}

fn save_recovery_backup(
    bytes: &[u8],
    identity: &Identity,
) -> Result<std::path::PathBuf, InstallerError> {
    use std::io::Write;
    let root = dirs::data_local_dir()
        .ok_or_else(|| {
            InstallerError::internal("saving recovery backup", "local data directory unavailable")
        })?
        .join("open-u60-pro/recovery");
    fs::create_dir_all(&root)
        .map_err(|e| InstallerError::internal("creating recovery directory", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700))
            .map_err(|e| InstallerError::internal("protecting recovery directory", e))?;
    }
    let directory = root.join(uuid::Uuid::new_v4().to_string());
    fs::create_dir(&directory)
        .map_err(|e| InstallerError::internal("creating recovery snapshot", e))?;
    let path = directory.join("back_parameter.orig");
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&path)
        .map_err(|e| InstallerError::internal("saving recovery backup", e))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| InstallerError::internal("saving recovery backup", e))?;
    let metadata = json!({"device": identity, "sha256": hex::encode(Sha256::digest(bytes)), "format": "original encrypted firmware backup"});
    fs::write(
        directory.join("identity.json"),
        serde_json::to_vec_pretty(&metadata)
            .map_err(|e| InstallerError::internal("writing recovery identity", e))?,
    )
    .map_err(|e| InstallerError::internal("saving recovery identity", e))?;
    #[cfg(unix)]
    fs::File::open(&directory)
        .and_then(|f| f.sync_all())
        .map_err(|e| InstallerError::internal("syncing recovery directory", e))?;
    Ok(path)
}

pub fn run_unlock(
    gateway: &str,
    router_password: &str,
    suffix: &str,
    dry_run: bool,
    work: &Path,
    log: &dyn Fn(&str),
) -> Result<Identity, InstallerError> {
    fs::create_dir_all(work)
        .map_err(|error| InstallerError::internal("creating unlock workspace", error))?;
    let mut router = Router::new(gateway, router_password)?;
    log("[*] Signing in to the modem web interface…");
    router.login()?;

    let info = router.call("zwrt_web", "device_info", json!({}), None)?;
    let identity = Identity::from_info(info.pointer("/0/result/1").ok_or_else(|| {
        InstallerError::internal("device identity", "device_info result missing")
    })?)?;
    let imei = info
        .pointer("/0/result/1/imei")
        .and_then(Value::as_str)
        .ok_or_else(|| InstallerError::internal("reading device identity", "IMEI was absent"))?;
    log(&format!(
        "[+] Device identity confirmed: {}*********",
        &imei[..imei.len().min(6)]
    ));

    log("[*] Requesting a fresh configuration backup…");
    let backup_response = router.call(
        "zwrt_mc.device.manager",
        "device_backup_proc",
        json!({ "procType": "web" }),
        None,
    )?;
    if backup_response
        .pointer("/0/result/0")
        .and_then(Value::as_i64)
        != Some(0)
    {
        return Err(InstallerError::new(
            "The modem did not create a configuration backup",
            "No changes were made. Restart the modem and try again.",
            backup_response.to_string(),
        ));
    }
    std::thread::sleep(Duration::from_secs(2));
    let encrypted_original = router.get("/backup/back_parameter")?;
    fs::write(work.join("back_parameter.orig"), &encrypted_original).map_err(|error| {
        InstallerError::internal("saving the original diagnostic backup", error)
    })?;
    log(&format!(
        "[+] Backup downloaded ({} bytes)",
        encrypted_original.len()
    ));

    let recovery_path = save_recovery_backup(&encrypted_original, &identity)?;
    log(&format!(
        "[+] Original encrypted recovery backup retained: {}",
        recovery_path.display()
    ));
    let password = format!("{imei}{suffix}");
    log("[*] Decrypting and validating the backup…");
    let outer = decrypt_backup(&encrypted_original, &password)?;
    fs::write(work.join("outer.tgz"), &outer).map_err(|error| {
        InstallerError::internal("saving the decrypted diagnostic backup", error)
    })?;
    let patched_outer = patch_outer(&outer, log)?;
    fs::write(work.join("outer.patched.tgz"), &patched_outer)
        .map_err(|error| InstallerError::internal("saving the patched diagnostic backup", error))?;
    let encrypted_patched = encrypt_backup(&patched_outer, &password);
    fs::write(work.join("back_parameter.patched"), &encrypted_patched)
        .map_err(|error| InstallerError::internal("saving the patched backup", error))?;
    let sha = hex::encode(Sha256::digest(&encrypted_patched));
    log(&format!(
        "[+] Patched backup prepared and verified (SHA-256 {}…)",
        &sha[..16]
    ));

    if dry_run {
        log("[+] Dry run complete. Nothing was uploaded and the modem was not changed.");
        return Ok(identity);
    }

    log("[*] Uploading the verified patched backup…");
    let upload_response = router.upload(encrypted_patched)?;
    if upload_response.get("sha256sum").and_then(Value::as_str) != Some(sha.as_str()) {
        return Err(InstallerError::new(
            "The uploaded backup did not pass integrity verification",
            "The restore was not triggered. Retry with a stable network connection.",
            format!("Expected SHA-256 {sha}; upload response: {upload_response}"),
        ));
    }
    log("[+] Upload integrity confirmed");
    log("[*] Triggering the configuration restore and reboot…");
    let restore_response = router.call(
        "zwrt_mc.device.manager",
        "device_restore_proc",
        json!({ "procType": "web" }),
        None,
    )?;
    if restore_response
        .pointer("/0/result/0")
        .and_then(Value::as_i64)
        != Some(0)
    {
        return Err(InstallerError::new(
            "The modem rejected the restore request",
            "The upload completed, but the modem did not begin restoring. Restart it before retrying.",
            restore_response.to_string(),
        ));
    }
    log("[+] Restore accepted. Waiting for the modem to reboot into ADB mode…");
    Ok(identity)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openssl_compatible_crypto_round_trip() {
        let plain = b"configuration payload";
        let encrypted = encrypt_backup(plain, "test-password");
        assert_eq!(decrypt_backup(&encrypted, "test-password").unwrap(), plain);
        assert!(decrypt_backup(&encrypted, "wrong-password").is_err());
    }

    #[test]
    fn finds_usb_operation_path() {
        let rc = "#!/bin/sh\nvalue=$(cat /sys/class/android_usb/android0/usb_op)\n";
        assert_eq!(
            usb_path(rc).as_deref(),
            Some("/sys/class/android_usb/android0/usb_op")
        );
    }
}
