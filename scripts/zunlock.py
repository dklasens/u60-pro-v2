#!/usr/bin/env python3
"""zunlock.py — restore ADB/root on a ZTE MU5250 (U60 Pro) running locked
firmware (HK B04 and similar), via the config backup/restore path.

Self-contained (Python 3 stdlib + adb optional). Backup crypto uses the
`cryptography` package when available (pure Python, no openssl binary
needed — this is how the installer app runs on Windows) and falls back to
the openssl CLI otherwise. No secrets are
embedded: the backup-key suffix is provided by the user at runtime, and the
USB-debug sysfs path is discovered from the device's own backup.

What it does:
  1. logs into the web UI (router admin password, prompted)
  2. downloads a fresh config backup (device_backup_proc + GET)
  3. decrypts it (openssl des-ede3-cbc / sha256, password = <IMEI><suffix>;
     the IMEI is read from the device, you supply only the suffix)
  4. inserts a boot-time USB-debug line into etc/rc.local inside the backup
     (payload path auto-discovered from the stock rc.local itself)
  5. repacks (inner tgz + md5 + outer tgz), re-encrypts
  6. with confirmation: uploads via /cgi-bin/cgi-upload (sha256-verified)
     and triggers device_restore_proc — the device restores and reboots,
     then comes back with adbd enabled

Usage:
  python3 zunlock.py [--gw 192.168.0.1] [--suffix SUFFIX] [--yes] [--dry-run]
                     [--keep-work DIR]

Inputs (prompted if not given):
  ROUTER_PW env / --pw        router admin password
  --suffix / ZTE_BACKUP_SUFFIX  backup-key suffix for this device family
                                (obtain from the community or a rooted unit;
                                 see docs/DEPLOYMENT.md)

--dry-run performs everything except the upload/restore (safe).
"""

import argparse
from pathlib import Path
import shutil
import uuid
from device_identity import device_identity
import getpass
import hashlib
import http.cookiejar
import io
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

INNER = "tmp/back_parameter_r1.tgz"
MD5 = "tmp/back_parameter_r.md5"
RC_LOCAL = "etc/rc.local"


# ---------- web session ----------

class Router:
    def __init__(self, gw, password):
        self.base = f"http://{gw}"
        self.pw = password
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cj))
        self.session = None

    def call(self, obj, method, params, session=None):
        url = f"{self.base}/ubus/?t={int(time.time())}"
        body = json.dumps([{"jsonrpc": "2.0", "id": 1, "method": "call",
                            "params": [session or self.session, obj, method,
                                       params]}]).encode()
        req = urllib.request.Request(url, data=body, headers={
            "Content-Type": "application/json",
            "Origin": self.base, "Referer": self.base + "/"})
        return json.loads(self.opener.open(req, timeout=30).read())

    @staticmethod
    def _sha(x):
        return hashlib.sha256(x.encode()).hexdigest().upper()

    def login(self):
        salt = self.call("zwrt_web", "web_login_info", {},
                         session="0" * 32)[0]["result"][1]["zte_web_sault"]
        resp = self.call("zwrt_web", "web_login",
                         {"password": self._sha(self._sha(self.pw) + salt)},
                         session="0" * 32)
        self.session = resp[0]["result"][1]["ubus_rpc_session"]

    def get(self, path):
        req = urllib.request.Request(self.base + path,
                                     headers={"Referer": self.base + "/"})
        return self.opener.open(req, timeout=60).read()

    def upload(self, data):
        boundary = "----zunlock" + hashlib.md5(os.urandom(8)).hexdigest()
        body = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="filename"'
            f"\r\n\r\n/tmp/back_parameter\r\n".encode()
            + f'--{boundary}\r\nContent-Disposition: form-data; '
              f'name="filedata"; filename="back_parameter"\r\n'
              f"Content-Type: application/octet-stream\r\n\r\n".encode()
            + data + b"\r\n"
            + f"--{boundary}--\r\n".encode())
        req = urllib.request.Request(
            self.base + "/cgi-bin/cgi-upload", data=body, headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Referer": self.base + "/", "Origin": self.base})
        return json.loads(self.opener.open(req, timeout=120).read())


# ---------- backup package ----------

class UnlockError(Exception):
    """Fatal unlock failure (bad suffix, unexpected backup layout, ...)."""


def _evp_bytes_to_key(password, salt, key_len=24, iv_len=8):
    """openssl EVP_BytesToKey with SHA-256 (matches `openssl enc -md sha256`)."""
    out, block = b"", b""
    while len(out) < key_len + iv_len:
        block = hashlib.sha256(block + password + salt).digest()
        out += block
    return out[:key_len], out[key_len:key_len + iv_len]


def _py_crypt(data, password, encrypt):
    """openssl-compatible `enc -des-ede3-cbc -md sha256` (Salted__ container).

    Raises ValueError on decrypt with wrong password / corrupt input.
    """
    from cryptography.hazmat.primitives.ciphers import Cipher, modes
    try:  # cryptography >= 43 location (avoids the deprecation warning)
        from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES
    except ImportError:
        from cryptography.hazmat.primitives.ciphers.algorithms import TripleDES
    if encrypt:
        salt = os.urandom(8)
        key, iv = _evp_bytes_to_key(password.encode(), salt)
        pad = 8 - len(data) % 8
        padded = data + bytes([pad]) * pad
        op = Cipher(TripleDES(key), modes.CBC(iv)).encryptor()
        return b"Salted__" + salt + op.update(padded) + op.finalize()
    if data[:8] != b"Salted__" or len(data) < 24 or (len(data) - 16) % 8:
        raise ValueError("not an openssl enc file")
    key, iv = _evp_bytes_to_key(password.encode(), data[8:16])
    op = Cipher(TripleDES(key), modes.CBC(iv)).decryptor()
    padded = op.update(data[16:]) + op.finalize()
    pad = padded[-1]
    if not 1 <= pad <= 8 or padded[-pad:] != bytes([pad]) * pad:
        raise ValueError("bad padding (wrong password)")
    return padded[:-pad]


def openssl(direction, src, dst, password):
    """Encrypt/decrypt with the `cryptography` package, else openssl CLI.

    Raises subprocess.CalledProcessError on failure either way (callers
    already handle that as "wrong suffix").
    """
    try:
        data = open(src, "rb").read()
        out = _py_crypt(data, password, encrypt=(direction == "e"))
    except ImportError:
        subprocess.run(["openssl", "enc", "-des-ede3-cbc", f"-{direction}",
                        "-md", "sha256", "-pass", "stdin",
                        "-in", src, "-out", dst], input=(password + "\n").encode(), timeout=60, check=True)
        return
    except ValueError as e:
        raise subprocess.CalledProcessError(1, ["openssl", direction]) from e
    with open(dst, "wb") as f:
        f.write(out)


def read_outer(path):
    with tarfile.open(path, "r:gz") as t:
        inner = t.extractfile(INNER).read()
    with tarfile.open(fileobj=io.BytesIO(inner), mode="r:gz") as t:
        members = [(m, t.extractfile(m).read() if m.isfile() else None)
                   for m in t.getmembers()]
    return inner, members


def patch_outer(src, dst, log=print):
    _, members = read_outer(src)
    out, rc = [], None
    for m, data in members:
        if m.name == RC_LOCAL and m.isfile():
            rc = (m, data)
            continue
        out.append((m, data))
    if rc is None:
        raise UnlockError(f"{RC_LOCAL} not found in backup (unexpected)")
    m, data = rc
    text = data.decode("utf-8", "replace")

    # discover the usb-debug node from the device's own rc.local
    hits = re.findall(r"/sys/[^\s`\"']*usb_op[^\s`\"']*", text)
    if not hits:
        raise UnlockError("no usb_op node found in stock rc.local — "
                          "this firmware may differ; inspect the backup manually")
    payload = f"echo 1 > {hits[0]}"
    if payload in text:
        raise UnlockError("rc.local already contains the payload — nothing to do")

    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.strip() == "#!/bin/sh":
            lines.insert(i + 1, payload)
            break
    else:
        lines.insert(0, payload)
    new = ("\n".join(lines) + "\n").encode()
    m.size = len(new)
    out.append((m, new))
    log(f"[+] payload after shebang: {payload}")

    ibuf = io.BytesIO()
    with tarfile.open(fileobj=ibuf, mode="w:gz") as t:
        for mi, d in out:
            t.addfile(mi, io.BytesIO(d) if d is not None else None)
    inner = ibuf.getvalue()
    digest = hashlib.md5(inner).hexdigest()

    def meta(name, size):
        mi = tarfile.TarInfo(name)
        mi.mode, mi.uid, mi.gid, mi.uname, mi.gname = 0o644, 0, 0, "root", "root"
        mi.size = size
        return mi

    with tarfile.open(dst, "w:gz") as t:
        t.addfile(meta(INNER, len(inner)), io.BytesIO(inner))
        md5f = (digest + "\n").encode()
        t.addfile(meta(MD5, len(md5f)), io.BytesIO(md5f))


# ---------- main ----------

def run_unlock(gw, pw, suffix, *, dry_run=False, yes=False, work=None,
               log=print, confirm=None):
    """Full unlock flow, callable from the installer app.

    log(msg) receives progress lines; confirm() -> bool gates the
    upload/restore (defaults to an interactive y/N prompt). Raises
    UnlockError on any fatal problem. Returns the work directory.
    """
    work = work or tempfile.mkdtemp(prefix="zunlock-")
    os.makedirs(work, mode=0o700, exist_ok=True)
    os.chmod(work, 0o700)
    log(f"[*] work dir: {work}")

    r = Router(gw, pw)
    log("[*] logging in...")
    try:
        r.login()
    except Exception as e:
        raise UnlockError(f"router login failed (wrong admin password? "
                          f"device unreachable?): {e}") from e
    info = r.call("zwrt_web", "device_info", {})[0]["result"][1]
    identity = device_identity(info)
    identity_file = Path(work) / 'identity.json'
    if identity_file.exists() and json.loads(identity_file.read_text()) != identity:
        raise UnlockError('The modem identity changed since preparation')
    identity_file.write_text(json.dumps(identity))
    imei = info["imei"]
    log(f"[+] device IMEI: {imei[:6]}*********")

    log("[*] requesting fresh config backup...")
    res = r.call("zwrt_mc.device.manager", "device_backup_proc",
                 {"procType": "web"})
    if res[0]["result"][0] != 0:
        raise UnlockError(f"backup_proc failed: {res}")
    time.sleep(2)
    enc_orig = os.path.join(work, "back_parameter.orig")
    with open(enc_orig, "wb") as f:
        f.write(r.get("/backup/back_parameter"))
    log(f"[+] backup downloaded: {os.path.getsize(enc_orig)} bytes")

    recovery_root = Path.home() / '.local/share/open-u60-pro/recovery'
    recovery_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    recovery = recovery_root / str(uuid.uuid4())
    recovery.mkdir(mode=0o700)
    with open(recovery / 'back_parameter.orig', 'xb') as saved, open(enc_orig, 'rb') as original:
        os.chmod(saved.name, 0o600)
        shutil.copyfileobj(original, saved)
        saved.flush(); os.fsync(saved.fileno())
    (recovery / 'identity.json').write_text(json.dumps(identity))
    log(f'[+] Original encrypted recovery backup retained: {recovery}')
    password = imei + suffix
    outer = os.path.join(work, "outer.tgz")
    log("[*] decrypting (des-ede3-cbc/sha256)...")
    try:
        openssl("d", enc_orig, outer, password)
    except subprocess.CalledProcessError:
        raise UnlockError("decryption failed — wrong suffix for this "
                          "device/firmware") from None

    patched = os.path.join(work, "outer.patched.tgz")
    patch_outer(outer, patched, log=log)
    enc_new = os.path.join(work, "back_parameter.patched")
    openssl("e", patched, enc_new, password)
    data = open(enc_new, "rb").read()
    sha = hashlib.sha256(data).hexdigest()
    log(f"[+] patched package ready: {len(data)} bytes, sha256 {sha[:16]}...")

    if dry_run:
        log(f"[*] dry-run: stopping before upload. Artifacts in {work}")
        return work

    if not yes:
        log("")
        log("*** About to upload the patched backup and trigger restore.")
        log("*** The device will apply settings and REBOOT (~90s offline).")
        proceed = confirm() if confirm else \
            input("Proceed? [y/N] ").strip().lower() == "y"
        if not proceed:
            raise UnlockError("aborted by user; artifacts kept in " + work)

    if device_identity(r.call("zwrt_web", "device_info", {})[0]["result"][1]) != identity:
        raise UnlockError('The modem identity changed before restore')
    log("[*] uploading...")
    resp = r.upload(data)
    log(f"[+] upload response: {resp}")
    if resp.get("sha256sum") != sha:
        raise UnlockError("sha256 mismatch after upload — aborting before restore")

    log("[*] triggering restore + reboot...")
    res = r.call("zwrt_mc.device.manager", "device_restore_proc",
                 {"procType": "web"})
    if res[0]["result"][0] != 0:
        raise UnlockError(f"restore trigger failed: {res}")

    log("")
    log("[+] Restore triggered. The device is rebooting.")
    log("    In ~60-90s adbd is up and the deploy steps can continue.")
    return work


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gw", default="192.168.0.1")
    ap.add_argument("--pw", help="router admin password (or ROUTER_PW env)")
    ap.add_argument("--suffix", help="backup-key suffix (or ZTE_BACKUP_SUFFIX env)")
    ap.add_argument("--yes", action="store_true", help="skip upload confirmation")
    ap.add_argument("--dry-run", action="store_true",
                    help="do everything except upload/restore")
    ap.add_argument("--keep-work", help="work directory to keep artifacts")
    args = ap.parse_args()

    pw = args.pw or os.environ.get("ROUTER_PW") or \
        getpass.getpass("Router admin password: ")
    suffix = args.suffix or os.environ.get("ZTE_BACKUP_SUFFIX") or \
        getpass.getpass("Backup-key suffix: ")

    try:
        run_unlock(args.gw, pw, suffix, dry_run=args.dry_run, yes=args.yes,
                   work=args.keep_work)
    except UnlockError as e:
        sys.exit(str(e))
    if not args.dry_run:
        print("    Run:  adb devices")
        print("    You should see your connected modem in the device list.")
        print("    Then deploy your agent / dropbear as usual — see "
              "docs/DEPLOYMENT.md.")


if __name__ == "__main__":
    main()
