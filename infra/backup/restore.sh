#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DUMP_FILE="${1:-}"

if [ -z "${DUMP_FILE}" ]; then
  DUMP_FILE="$(ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -n 1 || true)"
fi

if [ -z "${DUMP_FILE}" ] || [ ! -f "${DUMP_FILE}" ]; then
  echo "[restore] No dump file found. Usage: restore.sh /backups/<file>.sql.gz" >&2
  exit 1
fi

echo "[restore] Restoring ${DUMP_FILE} into ${POSTGRES_DB:-expentra}"
echo "[restore] WARNING: this replaces current database contents."

gunzip -c "${DUMP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  --host="${POSTGRES_HOST:-postgres}" \
  --port="${POSTGRES_PORT:-5432}" \
  --username="${POSTGRES_USER:-postgres}" \
  --dbname="${POSTGRES_DB:-expentra}" \
  --set ON_ERROR_STOP=on

echo "[restore] Restore completed successfully"
