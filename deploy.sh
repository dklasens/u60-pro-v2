#!/bin/bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$ROOT_DIR"
echo 'Building agent…'
cargo build --locked --release --target aarch64-unknown-linux-musl -p zte-agent
exec python3 "$ROOT_DIR/scripts/deploy-components.py" --agent "$ROOT_DIR/target/aarch64-unknown-linux-musl/release/zte-agent" "$@"
