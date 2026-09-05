# MU5250-OpenUI

A custom control plane for the ZTE U60 Pro (MU5250) 5G modem: a Rust agent
running on the device exposes a JSON API (`http://192.168.0.1:9090`), and a
React dashboard served from the device (`http://192.168.0.1:8080`) turns it
into a full-featured modem management UI — plus tooling to unlock, provision
and update both.

Credit: based on [jesther-ai/open-u60-pro](https://github.com/jesther-ai/open-u60-pro).

<img width="2730" height="1708" alt="Dashboard-Home" src="https://github.com/user-attachments/assets/ed8594a8-af21-4b97-a898-531c7bb6c03a" />
<img width="2734" height="1708" alt="Signal" src="https://github.com/user-attachments/assets/793c3797-b8d7-4933-bf28-b7c3a4650f72" />
<img width="2730" height="1706" alt="BandLock" src="https://github.com/user-attachments/assets/0f911d00-9604-44a8-b0fb-b20cd9fa10c5" />



## Architecture

```
Browser ── HTTP/JSON ──► React dashboard (:8080, isolated uhttpd, /data/www)
                              │
                              │ bearer-token JSON API
                              ▼
                         zte-agent (:9090, Rust, tiny_http thread pool)
                              │
              ┌───────────────┼────────────────────────┐
              ▼               ▼                        ▼
        ubus / uci        AT ports              sysfs / procfs
     (wifi, router,     (signal, SMS,        (thermals, battery,
      clients, WAN)      cell/band lock)      charge control)
```

- **Agent (`agent/`)** — Rust HTTP backend, no async runtime, minimal deps
  (`serde`, `tiny_http`, `sha2`, `libc`). Talks to ubus/uci, AT ports, sysfs
  and device services. TTL caches decouple client poll rate from expensive
  fork+exec subprocess reads; a single `ubus listen` event bus drives the
  charge-limit enforcer. Auth via bearer tokens with sliding 1 h expiry,
  rate-limited login, LAN-only bind. Destructive actions require
  `X-Confirm: true`; the AT console is allowlisted to read-only commands.
- **Dashboard (`web-app/`)** — React 19 + Vite + Tailwind SPA served by the
  device itself. Lazy-loaded groups, light/dark theme, bottom tabs on phones
  / sidebar on desktop. Visibility-aware, non-overlapping pollers with an
  in-memory SWR cache; Home runs on one batched `/api/dashboard` request
  every 3 s instead of nine separate polls.
- **Contract** — the agent exposes exactly what the dashboard uses and
  nothing else; `scripts/check-api-contract.py` fails CI if the route table,
  the client bindings or the mock agent drift apart.

## Dashboard features

| Group | What you get |
|---|---|
| **Home** | live signal, modem mode, throughput, battery, connection, device info and data usage from a single batched poll |
| **Signal** | per-carrier LTE/NR detail (PCI, ARFCN, RSRP/RSRQ/SINR), network mode, band lock, one-tap cell lock from live cells |
| **Network** | clients by Wi-Fi/USB-C/Ethernet with link details, per-band Wi-Fi configuration, LAN/DHCP and DNS |
| **Modem** | manual APN profiles, data usage + reset day, TTL clamping, SMS (inbox/sent, compose, delete) |
| **System** | thermals, battery health, charge control (stop/resume + limit enforcer), signal/connection loggers, AT console, on-demand process list, device/SIM info, USB mode + powerbank, power actions |

Details: [docs/DASHBOARD.md](docs/DASHBOARD.md) (pages, source layout, local
demo without hardware) and [docs/AGENT.md](docs/AGENT.md) (endpoint
reference, 57 paths).

## Validation

Release builds run Rust, dashboard and native-installer checks in GitHub Actions,
including failure-injection tests for deployment and recovery. The v2.3 changes
also passed a staged physical deployment with stock service, WAN, SSH and reboot
checks. See [docs/REMEDIATION.md](docs/REMEDIATION.md) for evidence and remaining
hardware/platform limits. Firmware emulators and local test environments are not
included in this repository or release.

## Quick start

### Desktop installer (recommended)

Windows and macOS users can install, repair, or update the complete stack with
the native **Open U60 Pro Installer** from GitHub Releases. It has a guided
interface, bundles ADB, selects only compatible ZTE MU5250 devices, and requires
no terminal or language runtimes. See [`installer/README.md`](installer/README.md).

### Terminal flow

Locked firmware (HK B04+, CN B28+) — the full sequence:

The source dashboard build requires Node.js `^20.19.0 || >=22.12.0` and npm;
`deploy-dashboard.sh` installs the locked dependencies with `npm ci`. The
native desktop installer uses prebuilt assets and does not require Node.js.

```sh
python3 scripts/zunlock.py     # 1. unlock → adbd (config backup/restore route)
bash setup.sh                  # 2. build + install the agent (build-from-source)
bash scripts/zharden.sh        # 3. SSH, rc.local cleanup, dashboard :8080, FOTA off
bash deploy-dashboard.sh       # 4. build + push the web UI
```

Full instructions, requirements (backup-key suffix), updates and post-FOTA
recovery: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Repository structure

```
agent/          Rust agent (runs on the modem, port 9090)
web-app/        React dashboard (served from the modem, port 8080)
scripts/        unlock + hardening + recon tooling
  research/     quarantined exploit tools — see its README before touching
docs/           documentation (below)
setup.sh        first-time provisioning (unlock + agent install)
deploy.sh       agent updates over SSH
deploy-dashboard.sh   dashboard build + push
zte-script-ng.js      community-vetted reference of safe ubus calls
```

## Documentation

| Doc | Contents |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | unlock, install, harden, update, post-FOTA recovery |
| [docs/AGENT.md](docs/AGENT.md) | agent architecture, endpoint reference, safety constraints |
| [docs/DASHBOARD.md](docs/DASHBOARD.md) | dashboard pages, source layout, dev + local demo |
| [docs/SAFETY.md](docs/SAFETY.md) | **read first** — brick-prevention rules, daemon sync barrier, recovery commands, safety audit |
| [docs/reference/](docs/reference/) | device reference material (rpcd ACL dump, USB mode findings) |

## Safety in one paragraph

This device was bricked once by going beyond the sanctioned path. The rules
that keep it alive: **shell/ssh/adb only** — no boot hooks outside
`/etc/rc.local`, no system-service modifications, never disable a
`zte_topsw_daemon.conf` daemon via init.d, stay out of partitions, and treat
`scripts/research/` as quarantined. Everything else — including what the
deploy path does and deliberately does not touch — is in
[docs/SAFETY.md](docs/SAFETY.md).

## License

[MIT](LICENSE). Derived in part from
[jesther-ai/open-u60-pro](https://github.com/jesther-ai/open-u60-pro)
(MIT, Copyright (c) 2025-present Jesther Silvestre).

Exception: `zte-script-ng.js` is a community reference script licensed
separately under **AGPLv3+** — see its header.

## Source of truth

If this README and the code ever disagree:

- `agent/src/server.rs` — HTTP routing table
- `agent/src/auth.rs` — auth and token behavior
- `web-app/src/App.tsx` — navigation groups mounted in the UI
- `web-app/src/data/api.ts` — client-side API bindings and payload shapes
