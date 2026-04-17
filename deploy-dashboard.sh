#!/bin/bash
set -e

# Default settings based on deploy.sh
DEVICE="192.168.0.1"
SSH_PORT=2222
TARGET_DIR=${1:-"/data/www"}

# Build the dashboard first
echo "Building the dashboard..."
cd web-app
npm run build
cd ..

# Ensure build succeeded
if [ ! -d "web-app/dist" ]; then
    echo "Error: web-app/dist directory not found. Build failed?"
    exit 1
fi

echo "Deploying dashboard to root@$DEVICE:$TARGET_DIR via SCP (Port $SSH_PORT)..."

# Use SCP to transfer the compiled dist/ directory to the device
scp -P $SSH_PORT -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$HOME/.ssh/known_hosts.d/zte -r web-app/dist/* root@$DEVICE:$TARGET_DIR

echo "Dashboard deploy successful!"
