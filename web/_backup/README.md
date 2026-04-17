# u60-pro-tools — Web Bootstrap

Single-page tool that authenticates with a stock ZTE U60 Pro router and enables ADB debug mode, so you can deploy `zte-agent` without needing ADB or SSH pre-configured.

## How It Works

1. User connects to the router's WiFi
2. Page authenticates via ubus JSON-RPC (`http://192.168.0.1/ubus/`)
3. Switches USB to debug mode (`zwrt_bsp.usb` → `set` → `{ mode: "debug" }`)
4. Shows copy-paste commands to deploy `zte-agent` via ADB

ZTE firmware reflects the `Origin` header in `Access-Control-Allow-Origin`, so this works from any hosted domain.

## Local Development

```sh
cd web
npx serve .
# Open http://localhost:3000
```

## Deploy to Vercel

```sh
cd web
vercel --prod
```

Or connect the `web/` directory as root in Vercel project settings.
