# Dashboard

React 19 + Vite + Tailwind SPA served from the device itself (isolated
upstream OpenWrt uhttpd on port 8080, release files selected by `/data/www.current` (legacy `/data/www` fallback)), talking to the
agent on port 9090. It is kept separate from ZTE's patched stock-UI uhttpd,
whose singleton ubus object makes a second UCI instance unreliable.

## Layout

Five navigation groups — bottom tab bar on phones, sidebar on desktop,
light/dark theme (auto + manual), each group lazy-loaded:

| Group | Contents |
|---|---|
| **Home** | signal, modem mode, throughput, battery, connection, device, data usage — backed by the single batched `/api/dashboard` poll |
| **Signal** | per-carrier LTE/NR detail (PCI, ARFCN, RSRP/RSRQ/SINR) + network mode, band lock, one-tap cell lock from live cells |
| **Network** | clients by Wi-Fi/USB-C/Ethernet with link details, per-band Wi-Fi configuration, LAN/DHCP and DNS |
| **Modem** | APN profiles (with carrier presets), data usage + reset day, TTL clamping, SMS (inbox/sent, compose, delete) |
| **System** | thermals, battery health, charge control, signal/connection loggers, AT console, on-demand process list, device/SIM info, USB mode + powerbank, power actions |

The agent exposes exactly what these screens use and nothing else — the
unsurfaced extras (DoH proxy, speed test, scheduler, SMS forwarding, SIM PIN
flows, calls/USSD/STK) were removed rather than left dangling. See
[AGENT.md](AGENT.md) for the route table, and
`scripts/check-api-contract.py`, which fails if the two drift apart.

## Source layout

```
web-app/src/
  App.tsx            auth gate + group switching (lazy-loaded)
  app/               shell (sidebar/bottom tabs), login, theme, home poll context
  data/
    client.ts        token handling, envelope unwrapping, timeouts
    api.ts           endpoint bindings + firmware response mappers
    poll.ts          visibility-aware, non-overlapping poller with SWR cache
  ui/                design-system primitives (cards, controls, toast, confirm)
  icons.tsx          inline SVG icon set (no icon dependency)
  features/
    home/            Overview — single batched /api/dashboard poll
    signal/          Overview + Mode & Locking
    network/         Clients + Wi-Fi + Router
    modem/           APN + Data + TTL + SMS
    system/          Metrics + Tools + Settings
```

## Conventions that keep the device happy

- Home is one batched request (`/api/dashboard`) every 3 s — not nine calls.
- Pollers never overlap (next poll scheduled after the previous completes)
  and pause while the browser tab is hidden.
- Expensive endpoints (`/api/network/clients`, `/api/system/top`) poll
  slowly (15 s) or load on demand.
- Last-good data is cached in memory, so switching tabs renders instantly
  and refreshes in the background.

## Develop

Requires Node.js `^20.19.0 || >=22.12.0` and npm. Node 18 is unsupported by
the locked Vite toolchain.

```sh
cd web-app
npm ci
npm run dev       # local dev server (expects agent at <hostname>:9090)
npm run build     # tsc + vite build -> dist/
npm run lint
```

Deploy to the device with `./deploy-dashboard.sh` from the repo root. The
script checks Node/npm, runs `npm ci`, builds and uploads the SPA, restarts the
isolated dashboard server, and verifies the page from the device before
reporting success. Run `scripts/zharden.sh` first if that server is not yet
installed.

### Local demo without the device

```sh
cd web-app
bash tools/demo.sh        # dashboard on :8080 + mock agent on :9090
bash tools/demo.sh stop
```

The mock agent (`tools/mock_agent.py`, stdlib-only) serves realistic U60 Pro
data — Telstra ENDC with LTE anchor + n78 NR, live-jittering throughput,
battery, clients, thermals — so every screen can be reviewed without
hardware. Sign in with any password.
