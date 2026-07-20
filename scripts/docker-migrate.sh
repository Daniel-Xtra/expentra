#!/bin/sh
# One-shot database migration runner for deploy (Compose `migrate` service).
set -eu

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

error() {
    printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >&2
}

require_env() {
    eval "value=\${$1:-}"
    if [ -z "$value" ]; then
        error "Missing required environment variable: $1"
        exit 1
    fi
}

require_env POSTGRES_HOST
require_env POSTGRES_PORT
require_env POSTGRES_DB
require_env POSTGRES_USER
require_env POSTGRES_PASSWORD

case "${POSTGRES_HOST}" in
    localhost|127.0.0.1)
        error "POSTGRES_HOST cannot be localhost inside Docker. Use POSTGRES_HOST=postgres"
        exit 1
        ;;
esac

timeout="${DATABASE_WAIT_TIMEOUT:-60}"
log "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
while ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" >/dev/null 2>&1; do
    timeout=$((timeout - 2))
    if [ "$timeout" -le 0 ]; then
        error "Timed out waiting for PostgreSQL."
        exit 1
    fi
    sleep 2
done
log "PostgreSQL is ready."

log "Running database migrations..."
node ./node_modules/typeorm/cli.js \
    migration:run \
    -d dist/database/data-source.js
log "Database migrations completed."
