#!/bin/bash
set -euo pipefail
umask 077
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
node "$ROOT_DIR/web-app/tools/check-node-version.mjs"
cd "$ROOT_DIR/web-app"
npm ci
npm run build
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
tar czf "$WORK/dashboard-dist.tar.gz" -C "$ROOT_DIR/web-app/dist" .
python3 "$ROOT_DIR/scripts/deploy-components.py" --dashboard "$WORK/dashboard-dist.tar.gz" "$@"
