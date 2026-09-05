#!/bin/bash
# Post-unlock hardening uses the same identity, staging and rollback path as deployment.
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
if [ "${1:-}" = --gw ]; then shift; set -- --gateway "$@"; fi
exec python3 "$ROOT_DIR/scripts/deploy-components.py" --harden --auto-adb "$@"
