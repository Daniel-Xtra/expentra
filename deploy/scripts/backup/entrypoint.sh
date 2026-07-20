#!/bin/sh
set -eu

INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

echo "[backup-runner] Starting loop (interval=${INTERVAL_SECONDS}s)"

# Run once at container start, then on schedule.
while true; do
  /bin/sh "${SCRIPT_DIR}/backup.sh" || echo "[backup-runner] Backup failed at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  sleep "${INTERVAL_SECONDS}"
done
