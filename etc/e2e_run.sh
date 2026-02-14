#!/usr/bin/env bash
set -euo pipefail

VM_NAME="${ZAP_E2E_VM_NAME:-zapper-e2e}"
VM_READY_FILE="/var/tmp/zapper-e2e-ready"
VM_WORKDIR="${ZAP_E2E_VM_WORKDIR:-/tmp/zapper-e2e-src}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

warn() {
  printf '[e2e] WARNING: %s\n' "$*" >&2
}

run_local() {
  cd "$ROOT_DIR"
  exec pnpm run test:e2e:local
}

if [[ "${ZAP_E2E_FORCE_LOCAL:-0}" == "1" ]]; then
  run_local
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  warn "VM E2E runner is configured for macOS. Running locally instead."
  run_local
fi

if ! command -v limactl >/dev/null 2>&1; then
  warn "Lima is not installed. Run 'bash ./etc/e2e_setup.sh' to enable VM E2E runs."
  run_local
fi

vm_exists() {
  limactl list 2>/dev/null | awk 'NR>1 { print $1 }' | grep -Fxq "$VM_NAME"
}

vm_status() {
  limactl list 2>/dev/null | awk -v vm="$VM_NAME" 'NR>1 && $1==vm { print $2 }'
}

if ! vm_exists; then
  warn "VM '${VM_NAME}' is missing. Run 'bash ./etc/e2e_setup.sh'. Running locally for now."
  run_local
fi

if [[ "$(vm_status)" != "Running" ]]; then
  limactl start "$VM_NAME" >/dev/null
fi

if ! limactl shell "$VM_NAME" -- test -f "$VM_READY_FILE"; then
  warn "VM '${VM_NAME}' is not provisioned. Run 'bash ./etc/e2e_setup.sh'. Running locally for now."
  run_local
fi

printf '[e2e] Running E2E tests inside Lima VM %s\n' "$VM_NAME"

limactl shell "$VM_NAME" -- \
  env HOST_PROJECT_ROOT="$ROOT_DIR" VM_WORKDIR="$VM_WORKDIR" bash -lc '
set -euo pipefail

rm -rf "$VM_WORKDIR"
mkdir -p "$VM_WORKDIR"
rsync -a --delete --exclude ".git" --exclude "node_modules" --exclude ".zap" "$HOST_PROJECT_ROOT/" "$VM_WORKDIR/"

cd "$VM_WORKDIR"
corepack enable
pnpm install --frozen-lockfile
pnpm run test:e2e:local
'
