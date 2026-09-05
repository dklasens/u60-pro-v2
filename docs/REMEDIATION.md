# Safety and reliability remediation

Scope: the ten findings and three optimisations accepted after the September
2026 read-only review. Completion requires implementation and regression
evidence, followed by the separately staged device dry run and live deployment.

## Implemented changes

Checked items mean implementation is present with local regression evidence;
they do not assert physical-device validation or completion of the staged rollout.

- [x] F1: Transfer credentials as data; validate and atomically replace scripts.
- [x] F2: Verify MU5250 identity, firmware, architecture and transport before writes.
- [x] F3: Enforce and verify key-only SSH.
- [x] F4: Stage/hash/activate/rollback agent, dashboard and rc.local updates.
- [x] F5: Coordinate LAN address changes, listener rebinding, reconnect and rollback.
- [x] F6: Reconcile charge policy after dropped events; surface control/storage failures.
- [x] F7: Abort USB switch on readiness timeout; serialise and restore failed switches.
- [x] F8: Bound subprocess input, execution and output, including cleanup.
- [x] F9: Apply, clear and verify PIN-only changes.
- [x] F10: Validate Wi-Fi fields before writes; serialise and rollback failed mutations.
- [x] O1: One polling scheduler; ignore obsolete responses after mutation/unmount.
- [x] O2: Share radio samples with loggers; buffer writes and stream bounded CSV logs.
- [x] O3: Report source freshness and collection errors in the API and dashboard.

## Deployment and validation

- [x] Download/verify all dependencies before any unlock or device mutation.
- [x] Offline bundle, storage preflight, recovery backup and version manifest.
- [x] Matching checksum verification for terminal and native paths.
- [x] Emulator dry run with neither application component installed.
- [x] Physical locked-device identity and backup dry run, without unlock or deployment.
- [x] Physical device-shell storage/startup preflight after separately authorized unlock.
- [x] CI gates for tests, types/lint, contract, secrets and failure injection.
- [x] Post-reboot verification and recovery guidance.
- [x] Controlled device dry run, then live deployment with recorded results.

Encrypted dashboard/API transport remains a security roadmap item from the
review; it must not be confused with key-only SSH. No boot hooks outside
rc.local, partition access, firmware daemon disabling, or live usb_op writes
are introduced by this work.

## Evidence

Validated locally on macOS, 5 September 2026:

| Check | Result |
|---|---|
| `cargo test -p zte-agent -p process-runner -p mu5250-installer --locked --offline` | 50 agent, 4 process-runner and 14 installer tests passed |
| `cargo fmt --all --check`; Clippy for all three packages, all targets, `-D warnings` | Passed |
| `python3 -m unittest discover -s tests -v` | 17 tests passed after the physical ADB fixes: process deadlines/output, credential quoting, dry-run no writes, identity mismatch, snapshot interruption/rollback, listener ownership and legacy ADB handling |
| `npm run build && npm run lint && npm test` in `web-app` | Build/lint and 6 behavior tests passed |
| `npm run build` in `installer` | Passed |
| `npm audit` / compatible fixes | Dashboard and installer report zero known npm advisories after fixes; this is not a Rust/system-package vulnerability audit |
| API contract, device-secret scan, shell syntax, `git diff --check` | Passed |
| `bash scripts/build-offline-bundle.sh dist/review-bundle` | Current aarch64 agent, dashboard and pinned packages built with checksums; no release published |

The Unix runner tests cover blocked stdin, inherited output pipes, output caps,
and EOF delivery. Windows job/process tests are configured in CI but have not
run on this Mac. Release workflows require the reusable checks before publishing;
remote CI had not yet been executed at this local-validation checkpoint. The
v2.3 release runs the same checks on GitHub-hosted Linux, macOS and Windows runners.

### Firmware emulator evidence

Tests used a private disposable QEMU snapshot with localhost-only forwarding and
outbound networking restricted. No physical modem was contacted. The existing
firmware userland identifies as MU5250 / `BD_XCBZHKMU5250V1.0.0B03`; its missing
physical IMEI is supplied only by the deployment test transport as a synthetic
fixture. Production identity validation correctly rejected the incomplete
emulator identity before that fixture was introduced.

Emulator scripts, images and environments are retained locally and excluded from
the v2.3 Git tree and release. Script names below record earlier local evidence;
they are not published release tools.

`scripts/test-emulator-fixes.py` passed the emulator guard, daemon/PID allowlist,
LAN/DHCP apply and nonce confirmation with restoration, network/band validation,
Wi-Fi EHT validation and restoration, missing-sensor semantics, APN lifecycle,
SMS lifecycle and read-only AT checks. Freshness metadata and both CSV streams
passed in a separate guarded run. LAN tests changed DHCP settings on the same
address; physical address migration and browser reconnection remain untested.

An agent-only Wi-Fi reload shim avoids calling nonexistent Qualcomm hardware.
A one-shot injected reload failure returned HTTP 503 and the actual firmware
UCI value matched its pre-change value afterward. This tests configuration
rollback, not physical radio reload. Stock hardware watchdogs caused guest
reboots during earlier runs; disconnected runs were not counted as passes.

The guarded `scripts/test-emulator-deployment.py` exercises an empty-app dry run,
first agent/dashboard installation, literal shell metacharacters in the password,
PIN login and clearing, and restoration after injected verification failure.
The final bundle passed this lifecycle test, including positive key access and
a negative authentication probe confirming that only public-key SSH is offered.
The first run found dashboard HTTP 403 caused by private archive permissions;
both installers now normalize static-file read permissions before activation.

### Physical dry-run evidence

Physical read-only preflight at the user-specified `192.168.0.1` on 5 September
2026: stock HTTP returned 200; application ports 8080/9090 and SSH port 2222
were unavailable. Unauthenticated device identity access was denied. The local
review bundle passed all five manifest checksums and dashboard archive validation
(360,103 expanded bytes). No login guesses, backup generation, upload, unlock,
ADB command, deployment or reboot was performed in this preflight. Service
unavailability alone does not prove application files are absent. Authenticated
identity/backup validation still needs the router credentials and backup-key
suffix; shell storage/startup checks cannot be performed through the available
web access. This initial check was a partial preflight.

The subsequent authenticated backup dry run passed on the same date. The modem
identified as `ZTE MU5250`, firmware `BD_XCBZHKMU5250V1.0.0B04`, and its identity
matched before and after backup preparation. The original encrypted backup was
100,048 bytes. Decryption succeeded with user-supplied credentials; credentials
and device identifiers were not written to this repository or the report.

The locally prepared package preserved every archive path, ownership, mode and
entry type. Only `etc/rc.local` content differed. Both original and proposed
scripts passed local `sh -n`; the inner archive MD5 and encryption/decryption
round trip passed. Temporary decrypted and patched files were removed. The
original encrypted recovery backup remains in the user's private local recovery
directory, with directory mode 0700 and backup mode 0600.

An enforced request allowlist permitted only login-info, login, device-info,
backup-generation and backup-download operations. All upload and restore calls
were blocked by the test wrapper. No ADB commands, shell access, configuration
restore, deployment or reboot occurred. Backup generation creates the modem's
normal temporary export; no running settings were applied. Physical storage,
startup and post-deployment hardware checks remain outside this locked-device
dry run. The user's latest authorization is **dry run only**, with no ADB or
deployment until separately instructed.
Afterward the stock web UI still returned HTTP 200, and ports 8080, 9090 and
2222 still refused connections.

### Remaining validation and limits

- Run the native installer on Windows and complete the configured Windows CI.
- Physical dry run, unlock, staged deployment, controlled reboot, stock sync,
  screen/touch, WAN, key-only SSH and direct LAN dashboard/API checks passed.
- Physical Wi-Fi mutation/rollback, LAN address changes, PIN removal from an
  already enabled state, USB mode switching/tethering and charger-control failure
  paths remain outside this deployment test. Charger status was read successfully
  and the charge-limit policy was verified disabled. Injected and emulator tests
  do not establish every physical control's behavior.
- The native installer's own post-reboot workflow still needs a physical UI run;
  this installation used a staged terminal driver with additional stock-health
  gates and one controlled reboot.
- Wi-Fi rollback handles observed operation failures; it is not a power-loss
  transaction journal. Recovery snapshots and old dashboard releases are retained
  without automatic pruning. An interruption before a transaction writes its
  ownership/identity records may require inspecting and removing an empty lock
  manually; do not discard a pending recovery snapshot.
- Browser/API traffic remains HTTP on the LAN. Subprocess deadlines do not add
  HTTP slow-client/socket timeouts. These are separate remaining hardening items.

Local and emulator evidence does not establish physical radio/USB behavior or
compatibility with every firmware. See the v2.3 release notes and Actions runs for
the subsequent release packaging evidence.

### Authorized unlock and post-unlock checks — 5 September 2026

The user subsequently authorized **unlock, followed by post-unlock checks**.
The agent and dashboard were not installed. A fresh backup was pinned to the
same device identity as the successful dry run. Only the proposed `rc.local`
content differed, local syntax and archive checks passed, and the uploaded
encrypted package's SHA-256 matched before one restore/reboot request was made.
The original encrypted recovery backup was retained privately on the host.

The modem returned with a verified root aarch64 ADB shell on the same MU5250 / HK
B04 identity. Read-only checks established:

- Stock daemon barrier: `sync success` and `register success`, repeated after
  checks. The daemon configuration matched the pre-unlock backup exactly.
- Applied `rc.local` matched the locally validated package hash and passed the
  modem's own `sh -n`. No extra firewall recovery boot hook was present.
- Stock UI process and essential modem processes were running. The user
  confirmed that the normal screen and touch controls worked. A standalone
  `mtdev2tuio` process was not found; this did not correspond to a user-observed
  touch failure on this firmware.
- Stock HTTP returned 200; WAN IPv4 was up, cellular status reported
  `ipv4_ipv6_connected`, and an ICMP probe bound to the WAN interface succeeded.
- The boot ID remained stable through the checks (final uptime over 288 seconds).
- Free space was 1,869,664 KiB on `/data`, 813,376 KiB on `/tmp`, and 90,816 KiB
  on `/etc`. The actual terminal deployment dry-run path passed for the current
  offline bundle over ADB, with upload methods explicitly blocked.
- Agent/dashboard files and boot scripts were absent. No saved USB, charge,
  Wi-Fi, TTL, LAN-recovery or DoH application policies were present.
- Battery was 100%, charging, and reported 28.0°C. USB included the expected
  ADB/debug functions after unlock; no live USB composition writes were made.

Network/DHCP/Wi-Fi files had byte differences after reboot. A semantic comparison
against the encrypted pre-unlock backup found no DHCP option differences; the
network difference was `lan_bind6.ip6addr`, and wireless differences were
`sta_num` client counters. These are consistent with runtime regeneration and
reconnection. `uhttpd` and daemon-barrier configuration hashes matched exactly;
there were no pending UCI changes. Observed overlay whiteouts concerned `mwan3`
and `samba4`, neither present in the live boot barrier; no whiteouts were changed.

FOTA auto-update currently reads `1` (enabled). It was not changed during the
read-only checks and needs to be disabled and verified during a later authorized
hardening/deployment stage.

These results clear the unlock/post-unlock checkpoint, not a guarantee against
all deployment failures. For this first physical installation, the recommended
sequence is to test application runtime before adding its persistent boot entry,
check stock health after each component, retain verified management access, and
perform a controlled reboot only after runtime and startup-script checks pass.
Final acceptance must include stock sync, screen/touch, WAN and management
recovery as well as agent/dashboard health. No deployment is authorized by the
user's request for additional safety assurance alone.

### Authorized staged deployment — 5 September 2026, completed

The user subsequently explicitly authorized agent and dashboard deployment.
Runtime tests exposed two legacy ADB compatibility problems before persistence:
streamed stdin did not terminate, and the shell could deliver SIGHUP before a
background child entered `nohup`. Terminal transfers now use private temporary
files through `adb push`, with remote SHA-256 verification before activation;
command input uses a verified regular file. Agent and dashboard launchers ignore
SIGHUP before forking. The native installer already used `adb push`; its agent
launcher received the same signal fix. A byte-exact physical transfer probe and
background-launch comparison verified both fixes. Regression tests cover private
input transfer/cleanup and inherited hangup protection.

The agent then passed password login, PIN-disabled verification, and successful
live radio sampling; the dashboard returned its application HTML. Stock daemon
sync, UI process, HTTP and WAN-bound connectivity passed with each runtime active.
The boot ID and `rc.local` remained unchanged. Key-only Dropbear started and
listened on port 2222, but host SSH timed out: the Mac routed the modem address
through its other network, and direct stock HTTP was also unreachable.

Snapshot restoration completed after each failed runtime gate, leaving stock
boot configuration unchanged. After the user connected the Mac to modem Wi-Fi,
direct stock HTTP and LAN reachability passed and deployment resumed. The staged
driver now checks host LAN reachability before any deployment writes.

Both application runtimes passed again. SSH identity and public-key-only
authentication were verified before FOTA was set to disabled and read back.
Exactly one startup entry per component was added to `rc.local`; the stock
flash-protection block was preserved and shell syntax validated. One controlled
reboot then passed stock sync/registration, UI process, stock HTTP, WAN-bound
connectivity, application login, dashboard service and key-only SSH checks.
The user confirmed normal screen and touch operation after this reboot.

Final acceptance, at more than eight minutes of uptime, confirmed a stable boot
ID, unchanged daemon-barrier configuration, exact installed agent checksum, and
byte-for-byte matching dashboard HTML plus its three JS/CSS assets over the LAN.
Direct host password login and CORS passed; unauthenticated API requests returned
401; PIN and charge-limit policy were disabled. Signal, WAN, WAN6, thermal and
data-usage sources all returned fresh successful samples without errors. Battery
was 100% and charging. The browser rendered the dashboard login page; authenticated
data checks were performed through the direct HTTP API.

The deployment transaction was marked committed and its active lock cleared only
after acceptance. Recovery snapshots remain retained. The generated dashboard
password, pinned SSH host key, identity and detailed deployment report are saved
in the user's private local deployment directory; secrets are not recorded here.
The final code checks for the legacy ADB fixes passed 13 Python remediation tests,
14 native installer tests, Rust formatting and diff whitespace checks.
