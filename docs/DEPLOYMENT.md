# Deployment — unlock, install, update

Everything needed to go from a locked U60 Pro to the full stack (agent +
dashboard + SSH), and to keep it there. Read [SAFETY.md](SAFETY.md) first.

For the shell flow, install Python 3, openssl and adb. Building the agent from
source additionally needs the Rust cross-compilation toolchain described
below. Building the dashboard requires Node.js `^20.19.0 || >=22.12.0` and
npm; Node 18 is not supported by the locked Vite version. The native Tauri
installer downloads prebuilt assets and end users need neither Rust nor Node.js.

## Native Windows/macOS installer

For a terminal-free installation, download **Open U60 Pro Installer** from the
project's GitHub Releases. The Windows `.msi`/setup `.exe` and macOS `.dmg`
builds bundle ADB and guide the user through detection, unlock, installation,
repair, or update. The app filters unrelated ADB devices, prompts when multiple
MU5250 modems are present, and invalidates its plan when the modem address
changes. See [`../installer/README.md`](../installer/README.md) for the complete
behavior, source-build instructions, diagnostics, and signing notes.

## The whole flow at a glance

```sh
bash setup.sh                  # prepare dependencies, unlock if needed, agent + SSH + FOTA off
bash deploy-dashboard.sh       # build, stage, activate and verify the web UI
# Optional repair of SSH/server configuration:
bash scripts/zharden.sh
```

End state (persists across reboots):

| Service | Where | Notes |
|---|---|---|
| USB-C tethering | USB-C, ECM (stock composition) | survives reboots (no usb_op write) |
| Stock web UI | `http://192.168.0.1:80` / `:443` | untouched |
| Dashboard | `http://192.168.0.1:8080` | isolated `/data/bin/dashboard-uhttpd` → `/data/www.current` |
| Agent API | `http://192.168.0.1:9090` | password = your choice at setup |
| SSH | `ssh -p 2222 root@192.168.0.1` | key-only, `/data/bin/dropbear` |
| ADB | on demand | sanctioned unlock / `rc.local` path + reboot; never write `usb_op` live |

---

## 1. Unlock (locked firmware: HK B04+, CN B28+)

Newer MU5250 firmware removed the web-accessible USB-debug toggle
(`zwrt_bsp.usb.set`) — on B04 the method is deleted from the daemon itself,
so no web trick can re-enable ADB. (CN B27 and earlier still have it — if
your device is that old, `setup.sh` can enable ADB directly and you can skip
this section.)

What still works is the **config backup/restore path**: the backup is an
openssl-encrypted tar of the system config, and the restore process runs as
root and extracts whatever you give it. `scripts/zunlock.py` uses that to
plant one line in `etc/rc.local` that re-enables the USB debug composition
(adbd) at boot.

The script is fully self-contained (Python 3 stdlib + `openssl` CLI) and
contains **no secrets**: the backup-key suffix is an input, the device IMEI
is read from the device, and the USB-debug sysfs path is discovered from the
device's own stock `rc.local` inside the backup.

### Requirements

- The router's **admin password** (you set it — it's your web UI login)
- The **backup-key suffix** for this device family (see below)
- A computer on the device's network (WiFi or USB), Python 3, openssl
- `adb` installed for afterwards (`brew install android-platform-tools`)

### The backup-key suffix

The backup encryption password is `<device IMEI><suffix>` — the IMEI is
per-device (the script reads it itself), the suffix is a fixed string shared
across this ZTE platform generation. It is deliberately **not** published
here, at the request of the researchers who shared it (publishing it gets it
killed in the next firmware). To obtain it:

- ask the community
- extract it yourself from a rooted SDX75-era ZTE MBB unit: the web server
  binary (`zte_web`) builds the backup password in memory; the suffix is
  visible in its strings near the backup/restore code paths

Pass it via `--suffix`, the `ZTE_BACKUP_SUFFIX` env var, or the interactive
(hidden) prompt. It never touches this repo.

### Usage

```sh
python3 scripts/zunlock.py --dry-run     # everything except the upload (safe)
python3 scripts/zunlock.py               # full run, asks before restoring
```

`setup.sh` runs both stages automatically when it detects a locked device
(no SSH, no ADB) — it prompts for the suffix, does the dry run first, then
the real unlock with `zunlock.py`'s own consent gate.

What happens on a full run:

1. logs into the web UI, requests a fresh config backup, downloads it
2. decrypts it (`openssl enc -d -des-ede3-cbc -md sha256`)
3. inserts the USB-debug line into `etc/rc.local` (right after the shebang,
   path discovered from the stock file), preserving file modes/ownership
4. rebuilds the package exactly as the device does (inner tgz → md5 sidecar →
   outer tgz → re-encrypt) — passes the device's own restore-time md5 check
5. uploads it (`/cgi-bin/cgi-upload`, verifies the server's sha256 matches),
   triggers `device_restore_proc` — the device restores and reboots
6. ~60–90 s later: `adb devices` shows the unit (verify it matches your connected modem),
   root shell via `adb shell`

Your settings are preserved — the patched package is built from a backup
taken seconds earlier.

### Unlock safety notes

- The restore reboots the device and briefly interrupts connectivity (~90 s).
- The script verifies the upload hash before triggering anything; a mismatch
  aborts before any state change.
- Never write the USB composition node manually outside boot time (live
  writes can kill the gadget until reboot), and never experiment with A/B
  slot switching (`abctl --set_active`) — mixed-slot boots can brick the unit.

---

## 2. Agent install — `setup.sh`

```sh
bash setup.sh
```

- Prompts for the router admin password and the agent API password.
- **Choose "build from source"** (the default, fully auditable). The
  pre-built download comes from this repo's GitHub releases and matches
  the dashboard — use it when installing the Rust toolchain isn't
  practical.
- All packages and the built/downloaded agent are prepared before unlock. A
  downloaded agent must match its release checksum. If the device is locked,
  setup then runs the backup dry run and confirmed restore; otherwise it
  verifies the selected ADB or SSH device directly.
- Pushes the agent to `/data/zte-agent`, creates the startup script with
  your password, adds the rc.local line, starts and verifies it.
- Over both ADB and SSH, verification runs the firmware's
  `/usr/bin/curl` on the device against `192.168.0.1:9090`. An ADB TCP forward
  is not used because the agent intentionally does not listen on loopback.

### Dry runs, offline preparation and rollback

`deploy.sh`, `deploy-dashboard.sh` and `scripts/zharden.sh` accept `--dry-run`,
`--gateway ADDRESS` and `--adb-serial SERIAL`. Agent/dashboard builds happen
locally before the read-only device checks. For interactive setup, use
`ZTE_DRY_RUN=1 bash setup.sh`. A locked-device dry run stops after backup
preparation; storage and shell checks require an unlocked transport.

The terminal wrappers use `scripts/deploy-components.py`. Credentials enter as
data and are validated before writes; `ZTE_AGENT_PIN` may contain six digits or
be empty to clear an existing PIN. Verification covers both password login and
requested PIN state. An optional native-installer offline bundle can be passed
to setup using `ZTE_BUNDLE_PATH=/path/to/bundle`; hardening accepts `--bundle`.

Each deployment checks space for the new files and rollback copies, and creates
a private snapshot under `/data/local/tmp/open-u60-transactions/<id>`. Failure
attempts to restore the snapshot. The console prints the exact recovery command
for use on the same modem if automatic recovery loses its connection. Successful
snapshots remain available; save needed recovery data before removing old ones.
A pending transaction blocks another deployment. Original encrypted unlock
backups remain in `~/.local/share/open-u60-pro/recovery` for the terminal flow.

Setup now includes SSH hardening and the dashboard server. Installing the web
files remains a separate `deploy-dashboard.sh` step. Reboot manually when ready
to return from the temporary ADB composition to normal tethering; the native
installer can perform and verify this final reboot itself.

## 3. Hardening — `scripts/zharden.sh`

```sh
bash scripts/zharden.sh
```

Idempotent — safe to re-run anytime. Installs dropbear to `/data/bin`
(opkg is unusable on this firmware), generates host keys, wires SSH into
rc.local, **removes the usb_op payload line** (so every boot returns to
stock ECM tethering), installs an isolated dashboard server on :8080, and
disables FOTA auto-update. Remote ADB operations are checked with an explicit
status sentinel. The server is the pinned upstream OpenWrt uhttpd binary at
`/data/bin/dashboard-uhttpd`; its package checksum is verified before
installation. This avoids the ZTE-patched binary's singleton `zwrt_uhttpd`
ubus object, which can make a second UCI instance exit even though the init
script returned success. The script removes any legacy `uhttpd.dashboard`
section, restarts the stock UI, then verifies the independent listener using a
known health file.

## 4. Dashboard — `deploy-dashboard.sh`

```sh
bash deploy-dashboard.sh
```

Checks the installed Node.js version, runs `npm ci`, builds `web-app` (Vite),
and creates a validated archive. The shared deployment tool stages and hashes
that archive, extracts it into a new `/data/open-u60-dashboards/<id>` directory,
normalizes static-file read permissions, and switches `/data/www.current` only after extraction succeeds. It also copies `index.html` → `mobile.html`, restarts only the
isolated dashboard server, and verifies the served SPA before reporting
success. `setup.sh` installs that server; `scripts/zharden.sh` can repair it.

If the script reports an unsupported Node.js version, install Node 20.19.x or
22.12+ (Node 22 LTS is recommended), confirm with `node --version`, and rerun.
If dashboard verification fails, inspect the service with:

```sh
ssh -p 2222 root@192.168.0.1 'sh /data/local/tmp/start_dashboard.sh; cat /tmp/dashboard-uhttpd.log; /usr/bin/curl -v http://127.0.0.1:8080/'
```

## Updating later

```sh
./deploy.sh              # agent (SSH; set ZTE_AGENT_PASSWORD / ZTE_AGENT_PIN)
./deploy-dashboard.sh    # dashboard
```

---

## Design rule: shell/ssh/adb only — no boot hooks outside rc.local

`zharden.sh` deliberately installs **no** boot-time hooks outside
`/etc/rc.local` and does not modify system services. An earlier approach
hooked boot through a `config include` section in the firewall service
(chosen because the UCI config dir survives FOTA) — that approach is
**deprecated and removed**: a hook inside a boot-critical service is a brick
risk. If it stalls or its target moves, the device can hang before any
recovery interface (ssh/adb/failsafe) is up, and recovery then requires
hardware access. See [SAFETY.md](SAFETY.md) for the incident history.

Trade-off accepted: `/etc/rc.local` is **not** preserved by FOTA, so a
firmware update wipes the service lines (the device itself still boots
cleanly to stock). Recovery after an update is simply re-running the
sequence above (~15 minutes). That is the right price for never risking the
boot path.

Notes:

- ADB is a bootstrap channel, not a good permanent interface on this
  firmware (its composition drops USB networking, and it only applies at
  boot) — SSH is the durable management channel.
- The rootfs is read-only except `/etc` and `/data`; `/data` survives FOTA,
  so binaries and web assets persist — only the rc.local lines need
  re-adding after an update.

## Post-FOTA recovery playbook

1. Verify the update landed and the device boots stock: ping, web UI up.
2. Re-run the sequence: `zunlock.py` (if ADB is gone) → `setup.sh` →
   `zharden.sh` → `deploy-dashboard.sh`.
3. Confirm FOTA auto-update is off again:
   `ssh -p 2222 root@192.168.0.1 'uci get zwrt_zte_dm.dm_update.dm_update_mode'` → `0`.
4. If the backup-key suffix ever stops working (ZTE rotated it): extract the
   new suffix from `strings /usr/sbin/zte_web` on any rooted unit.

## Credits

Backup-crypto details and the original payload hint: the
`amenekowo/mu5250_tweaking` community (with thanks — they asked that the key
material itself not be republished, and this tool honors that). B04
daemon/ACL analysis: community contributors on the issue tracker.
