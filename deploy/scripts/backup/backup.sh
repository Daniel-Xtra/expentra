#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="${POSTGRES_DB:-expentra}_${TIMESTAMP}.sql.gz"
TARGET="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting Postgres dump → ${TARGET}"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  --host="${POSTGRES_HOST:-postgres}" \
  --port="${POSTGRES_PORT:-5432}" \
  --username="${POSTGRES_USER:-postgres}" \
  --dbname="${POSTGRES_DB:-expentra}" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -c > "${TARGET}"

echo "[backup] Completed ${TARGET} ($(wc -c < "${TARGET}") bytes)"

find "${BACKUP_DIR}" -type f -name '*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete
echo "[backup] Retention applied (${RETENTION_DAYS} days)"
