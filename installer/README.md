# Open U60 Pro desktop installer

The desktop installer is a Tauri 2 application for Windows and macOS. It
provides a guided, terminal-free path from a locked ZTE MU5250 (U60 Pro) to
the complete Open U60 Pro stack: unlock, agent, secure SSH access, and the
dashboard.

End users download a native installer from GitHub Releases:

- Windows: `.msi`, NSIS setup `.exe`, or a portable `.zip` with bundled ADB (x64)
- macOS: `.dmg` and signature-preserving `.app.zip` for Apple Silicon or Intel

The application bundles the correct Android platform-tools and downloads
verified agent/dashboard release assets. Users do not install Python, Node.js,
Rust, or ADB and do not need to open a terminal. On Windows, a compatible USB
driver and the built-in OpenSSH Client may still need to be enabled; detection
explains either condition without asking the user to run commands.

## User experience

Detection creates an immutable installation plan for the current address and
selected USB modem. The application:

- refreshes the ADB executable and transport list on every detection;
- inspects ADB properties and the ZTE device API, ignoring unrelated phones;
- asks the user to select a modem if multiple compatible MU5250 units exist;
- invalidates the plan whenever the device address or selected modem changes;
- chooses **Install**, **Repair**, or **Update** from the detected service state;
- shows unlock credentials for locked firmware and a deployment dry run for every transport;
- verifies a requested ADB reboot through a new boot ID, device identity, authentication, SSH policy and dashboard response;
- validates matching agent passwords and an optional six-digit PIN;
- streams friendly progress and detailed logs from the Rust worker;
- reports dry runs separately from successful installations;
- presents connection details and a copy action on success; and
- gives concise error guidance with expandable technical details.

There is deliberately no general-purpose cancel button. Configuration restore
and rc.local maintenance have unsafe interruption points; operations instead
have bounded network/process timeouts and finish at a known boundary.

## Architecture

| Area | Implementation |
|---|---|
| Desktop UI | React + TypeScript + Vite in `installer/src/` |
| Native shell | Tauri 2 in `installer/src-tauri/` |
| Detection/deployment | Rust commands and typed Tauri events |
| Unlock backup handling | Rust HTTP, OpenSSL-compatible 3DES-CBC, gzip/tar patching |
| ADB | Platform-specific Google platform-tools bundled as application resources |
| SSH maintenance | The operating system OpenSSH client, invoked without a console window |
| Release assets | Latest `zte-agent`, `dashboard-dist.tar.gz`, and `sha256sums.txt` |

All form values are copied into one immutable request before the native worker
starts. The worker never reads UI state. The Rust layer also compares that
request with the saved detection ID, address, mode, and ADB serial before any
device change.

Temporary working files and decrypted/extracted backups are removed on success or
failure. Verified downloads are retained as reusable offline bundles; the log
prints the directory to enter under **Offline bundle and diagnostics**. Original
encrypted configuration backups are retained in the local application-data
`open-u60-pro/recovery` directory with a device fingerprint and checksum. **Keep temporary files** is an explicit diagnostic option; retained
unlock data can contain sensitive modem configuration and should be deleted
after troubleshooting.

## Run from source

Requirements for developers only:

- Node.js `^20.19.0 || >=22.12.0`
- current stable Rust
- the Tauri platform prerequisites for macOS or Windows
- `adb` on `PATH`, or platform-tools in `installer/assets/platform-tools/`

```sh
cd installer
npm install
npm run tauri dev
```

Compile and test without opening the app:

```sh
npm run check
npm run build
cargo test -p mu5250-installer
cargo clippy -p mu5250-installer --all-targets -- -D warnings
```

Build the native package for the current platform:

```sh
cd installer
npm run tauri build
```

## Safety and parity

The Rust deployment path retains the same constraints as
[`docs/SAFETY.md`](../docs/SAFETY.md): only sanctioned shell/ADB/SSH changes,
no boot hooks outside `/etc/rc.local`, no partition access, and a confirmation
immediately before backup upload/restore.

The four deployment fixes shared with the shell installer are present here:

1. Dropbear is checked through explicit remote `-f` and `-x` output, never the
   host-side ADB exit status.
2. Agent login verification runs with the modem's curl against its LAN address;
   no loopback ADB forward is used.
3. The dashboard uses a pinned, checksum-verified upstream OpenWrt uhttpd at
   `/data/bin/dashboard-uhttpd`. This avoids the ZTE binary's singleton ubus
   object; the independent listener and deployed SPA are both verified from
   the modem.
4. The installer consumes prebuilt dashboard assets, so Node.js requirements
   apply only to developers and CI.

## Deployment verification and recovery

To test the current source changes before publishing a release, run
`bash scripts/build-offline-bundle.sh` from the repository root, then select the
printed bundle directory in the installer. Downloading **latest** uses the
published agent/dashboard, which may predate the branch being tested.

The installer downloads and verifies every dependency before an unlock can
interrupt connectivity. It checks the model, firmware, root privileges and CPU
architecture through the selected transport, and compares the device fingerprint
again before writing. SSH detection therefore requires an authenticated modem
response, rather than an open port.

Agent binaries, startup scripts and dashboard archives are hash-checked before
activation. Dashboard archives reject unsafe paths, links, duplicate entries and
excessive expansion. Releases activate through `/data/www.current`; previous
files remain in a private deployment snapshot. Startup edits are syntax-checked
before replacing `rc.local`, preserving its stock flash-protection block.

A deployment dry run over ADB or SSH checks identity, artifacts, storage and
startup prerequisites without deployment writes. A locked-device dry run can
prepare the encrypted backup and verify downloads, but cannot yet check shell
access or device free space. It does not upload a backup or reboot the modem.

A failed installation attempts to restore its snapshot and restart the previous
services. If connectivity prevents recovery, the error gives the exact recovery
command and snapshot ID. Run it only on the same modem after reconnecting. A
pending snapshot blocks another install. Keep recovery files until the new
installation has been checked; deletion and automatic snapshot pruning are not
part of deployment.

Dropbear is started with password authentication disabled. Verification checks
both successful key access and the authentication methods advertised by the
server. Password/PIN verification uses curl on the modem over the management
channel. Clearing the PIN explicitly unsets it, and PIN-only changes restart
and recheck the agent.

The dashboard and agent API still use HTTP on the LAN. Key-only SSH does not
encrypt browser/API traffic; HTTPS remains a separate roadmap item.

## Release packaging and signing

`.github/workflows/installer.yml` builds on tags and attaches three native
variants to the existing release: Windows x64, macOS Apple Silicon, and macOS
Intel. Each macOS build is attached as both a DMG and a `ditto`-created app ZIP
whose extracted code signature is verified in CI. ADB and its Windows DLLs are
bundled into each application.

A manual workflow run with an empty **release_tag** is a build-only preflight.
Supplying an existing tag publishes or replaces that release's desktop assets;
this provides a retry path without moving an already-published Git tag.

macOS builds use ad-hoc signing when signing secrets are absent, which keeps
local/test downloads intact. Production releases should configure:

- `APPLE_CERTIFICATE` (base64 Developer ID Application `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` for notarization

Windows production releases should likewise be code-signed. Import the PFX in
CI and add its certificate thumbprint, SHA-256 digest, and timestamp service to
the Tauri Windows bundle configuration, or configure a supported custom/Azure
signing command. Do not commit certificates or passwords.

### Windows USB note

After a locked modem restores into ADB mode, Windows may require a driver for
the ZTE USB interface. The application detects `unauthorized` and `offline`
transports, but driver installation remains an operating-system action. Zadig
with WinUSB or Google's USB driver are the usual options.
