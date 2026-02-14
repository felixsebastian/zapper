#!/usr/bin/env bash
set -euo pipefail

BASE_VM_NAME="${ZAP_E2E_BASE_VM_NAME:-zapper-e2e-base}"
BASE_VM_READY_FILE="/var/tmp/zapper-e2e-base-ready"
VM_PREFIX="${ZAP_E2E_VM_PREFIX:-zapper-e2e-run}"
VM_NAME="${VM_PREFIX}-$(date +%Y%m%d%H%M%S)-$$-$RANDOM"
VM_WORKDIR="${ZAP_E2E_VM_WORKDIR:-/tmp/zapper-e2e-src}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
KEEP_VM="${ZAP_E2E_KEEP_VM:-0}"
ALLOW_LOCAL_FALLBACK="${ZAP_E2E_ALLOW_LOCAL_FALLBACK:-0}"
LOCAL_CMD="${ZAP_E2E_LOCAL_CMD:-pnpm run test:e2e:local}"

warn() {
  printf '[e2e] WARNING: %s\n' "$*" >&2
}

err() {
  printf '[e2e] ERROR: %s\n' "$*" >&2
}

run_local() {
  cd "$ROOT_DIR"
  exec bash -lc "$LOCAL_CMD"
}

fail_or_fallback() {
  if [[ "$ALLOW_LOCAL_FALLBACK" == "1" ]]; then
    warn "$1"
    run_local
  fi
  err "$1"
  exit 1
}

cleanup_vm() {
  if [[ "$KEEP_VM" == "1" ]]; then
    warn "Keeping VM '${VM_NAME}' for debugging (ZAP_E2E_KEEP_VM=1)."
    return
  fi
  limactl delete --force "$VM_NAME" >/dev/null 2>&1 || true
}

if [[ "${ZAP_E2E_FORCE_LOCAL:-0}" == "1" ]]; then
  run_local
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail_or_fallback "VM E2E runner is configured for macOS only."
fi

if ! command -v limactl >/dev/null 2>&1; then
  fail_or_fallback "Lima is not installed. Run 'bash ./etc/e2e_setup.sh' first."
fi

vm_exists() {
  limactl list 2>/dev/null | awk 'NR>1 { print $1 }' | grep -Fxq "$BASE_VM_NAME"
}

vm_status() {
  limactl list 2>/dev/null | awk -v vm="$BASE_VM_NAME" 'NR>1 && $1==vm { print $2 }'
}

if ! vm_exists; then
  fail_or_fallback "Base VM '${BASE_VM_NAME}' is missing. Run 'bash ./etc/e2e_setup.sh' first."
fi

if [[ "$(vm_status)" != "Running" ]]; then
  limactl start "$BASE_VM_NAME" >/dev/null
fi

if ! limactl shell "$BASE_VM_NAME" -- test -f "$BASE_VM_READY_FILE"; then
  fail_or_fallback "Base VM '${BASE_VM_NAME}' is not provisioned. Run 'bash ./etc/e2e_setup.sh' first."
fi

if [[ "$(vm_status)" == "Running" ]]; then
  limactl stop "$BASE_VM_NAME" >/dev/null
fi

trap cleanup_vm EXIT INT TERM

printf '[e2e] Creating isolated VM %s from base %s\n' "$VM_NAME" "$BASE_VM_NAME"
limactl clone --tty=false --mount-none "$BASE_VM_NAME" "$VM_NAME" >/dev/null
limactl start "$VM_NAME" >/dev/null

printf '[e2e] Syncing project to VM %s\n' "$VM_NAME"
COPYFILE_DISABLE=1 tar -C "$ROOT_DIR" \
  --disable-copyfile \
  --no-mac-metadata \
  --no-xattrs \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude=".zap" \
  -cf - . | limactl shell "$VM_NAME" -- env VM_WORKDIR="$VM_WORKDIR" bash -lc '
set -euo pipefail

rm -rf "$VM_WORKDIR"
mkdir -p "$VM_WORKDIR"
tar -xf - -C "$VM_WORKDIR"
'

printf '[e2e] Running E2E tests in VM %s\n' "$VM_NAME"
limactl shell "$VM_NAME" -- env VM_WORKDIR="$VM_WORKDIR" bash -lc '
set -euo pipefail
cd "$VM_WORKDIR"
pnpm install --frozen-lockfile
exec bash -lc "'"$LOCAL_CMD"'"
'
