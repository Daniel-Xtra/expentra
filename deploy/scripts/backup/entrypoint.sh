#!/bin/sh
set -eu

INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
# Strip CR in case the value came from a Windows-edited env file.
INTERVAL_SECONDS="$(printf '%s' "${INTERVAL_SECONDS}" | tr -d '\r')"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [ ! -s "${SCRIPT_DIR}/backup.sh" ]; then
  echo "[backup-runner] ERROR: ${SCRIPT_DIR}/backup.sh is missing or empty" >&2
  exit 1
fi

echo "[backup-runner] Starting loop (interval=${INTERVAL_SECONDS}s)"

# Run once at container start, then on schedule. Never exit the loop on backup failure.
while true; do
  if ! /bin/sh "${SCRIPT_DIR}/backup.sh"; then
    echo "[backup-runner] Backup failed at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
  fi
  # sleep failure must not kill the runner
  sleep "${INTERVAL_SECONDS}" || sleep 60 || true
done
