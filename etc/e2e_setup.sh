#!/usr/bin/env bash
set -euo pipefail

VM_NAME="${ZAP_E2E_VM_NAME:-zapper-e2e}"
NODE_MAJOR="${ZAP_E2E_NODE_MAJOR:-20}"
VM_READY_FILE="/var/tmp/zapper-e2e-ready"

log() {
  printf '[e2e-setup] %s\n' "$*"
}

fail() {
  printf '[e2e-setup] %s\n' "$*" >&2
  exit 1
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "This setup script currently supports macOS only."
fi

if ! command -v brew >/dev/null 2>&1; then
  fail "Homebrew is required. Install Homebrew first, then rerun this script."
fi

if ! command -v limactl >/dev/null 2>&1; then
  log "Installing Lima with Homebrew..."
  brew install lima
fi

vm_exists() {
  limactl list 2>/dev/null | awk 'NR>1 { print $1 }' | grep -Fxq "$VM_NAME"
}

vm_status() {
  limactl list 2>/dev/null | awk -v vm="$VM_NAME" 'NR>1 && $1==vm { print $2 }'
}

if ! vm_exists; then
  log "Creating Linux VM '${VM_NAME}'..."
  limactl create --name "$VM_NAME" --tty=false template://ubuntu
else
  log "VM '${VM_NAME}' already exists."
fi

if [[ "$(vm_status)" != "Running" ]]; then
  log "Starting VM '${VM_NAME}'..."
  limactl start "$VM_NAME"
fi

log "Provisioning Node.js, pnpm, PM2, and rsync inside '${VM_NAME}'..."
limactl shell "$VM_NAME" -- env NODE_MAJOR="$NODE_MAJOR" VM_READY_FILE="$VM_READY_FILE" bash -lc '
set -euo pipefail

sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg rsync build-essential git

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -Eq "^v${NODE_MAJOR}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi

corepack enable
corepack prepare pnpm@latest --activate
sudo npm install -g pm2

echo "ready" | sudo tee "$VM_READY_FILE" >/dev/null
'

log "VM setup complete."
log "Run E2E tests with: pnpm test:e2e"
