#!/bin/sh

set -eu

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

error() {
    printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >&2
}

# -----------------------------------------------------------------------------
# Environment Validation
# -----------------------------------------------------------------------------

require_env() {
    var_name="$1"

    eval "value=\${$var_name:-}"

    if [ -z "$value" ]; then
        error "Missing required environment variable: $var_name"
        exit 1
    fi
}

validate_environment() {
    log "Validating environment variables..."

    require_env POSTGRES_HOST
    require_env POSTGRES_PORT
    require_env POSTGRES_DB
    require_env POSTGRES_USER
    require_env POSTGRES_PASSWORD

    require_env REDIS_URL

    # Nest connects via REDIS_URL; host/port are only for readiness waits.
    if [ -z "${REDIS_HOST:-}" ] || [ -z "${REDIS_PORT:-}" ]; then
        # redis://[:password@]host:port[/db]
        _redis_no_scheme="${REDIS_URL#*://}"
        _redis_no_auth="${_redis_no_scheme##*@}"
        _redis_hostport="${_redis_no_auth%%/*}"
        if [ -z "${REDIS_HOST:-}" ]; then
            REDIS_HOST="${_redis_hostport%%:*}"
        fi
        if [ -z "${REDIS_PORT:-}" ]; then
            _redis_port_part="${_redis_hostport##*:}"
            if [ "${_redis_port_part}" != "${_redis_hostport}" ]; then
                REDIS_PORT="${_redis_port_part}"
            else
                REDIS_PORT="6379"
            fi
        fi
        export REDIS_HOST REDIS_PORT
        log "Derived REDIS_HOST=${REDIS_HOST} REDIS_PORT=${REDIS_PORT} from REDIS_URL"
    fi

    require_env REDIS_HOST
    require_env REDIS_PORT

    require_env JWT_SECRET

    log "Environment validation completed."
}

# -----------------------------------------------------------------------------
# Docker Safety Check
# -----------------------------------------------------------------------------

assert_docker_database_host() {
    if [ ! -f /.dockerenv ]; then
        return
    fi

    case "${POSTGRES_HOST}" in
        localhost|127.0.0.1)
            error "POSTGRES_HOST cannot be localhost inside Docker."
            error "Use POSTGRES_HOST=postgres"
            exit 1
            ;;
    esac
}

# -----------------------------------------------------------------------------
# Wait for PostgreSQL (TCP — no postgresql-client in the image)
# -----------------------------------------------------------------------------

wait_for_postgres() {

    timeout="${DATABASE_WAIT_TIMEOUT:-60}"

    log "Waiting for PostgreSQL..."

    while ! node -e "
      const net = require('net');
      const s = net.connect(
        { host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT) },
        () => { s.end(); process.exit(0); },
      );
      s.on('error', () => process.exit(1));
      setTimeout(() => process.exit(1), 2000);
    " >/dev/null 2>&1
    do
        timeout=$((timeout - 2))

        if [ "$timeout" -le 0 ]; then
            error "Timed out waiting for PostgreSQL."
            exit 1
        fi

        sleep 2
    done

    log "PostgreSQL is ready."
}

# -----------------------------------------------------------------------------
# Wait for Redis (TCP — no redis-tools in the image)
# -----------------------------------------------------------------------------

wait_for_redis() {

    timeout="${REDIS_WAIT_TIMEOUT:-60}"

    log "Waiting for Redis..."

    while ! node -e "
      const net = require('net');
      const s = net.connect(
        { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) },
        () => { s.end(); process.exit(0); },
      );
      s.on('error', () => process.exit(1));
      setTimeout(() => process.exit(1), 2000);
    " >/dev/null 2>&1
    do
        timeout=$((timeout - 2))

        if [ "$timeout" -le 0 ]; then
            error "Timed out waiting for Redis."
            exit 1
        fi

        sleep 2
    done

    log "Redis is ready."
}

# -----------------------------------------------------------------------------
# Database Migrations
# -----------------------------------------------------------------------------

run_migrations() {

    if [ "${RUN_MIGRATIONS:-true}" != "true" ]; then
        log "Skipping database migrations."
        return
    fi

    log "Running database migrations..."

    node ./node_modules/typeorm/cli.js \
        migration:run \
        -d dist/database/data-source.js

    log "Database migrations completed."
}

# -----------------------------------------------------------------------------
# Database Seed
# -----------------------------------------------------------------------------

run_seed() {

    if [ "${RUN_SEED:-false}" != "true" ]; then
        log "Skipping database seed."
        return
    fi

    log "Running database seed..."

    node ./dist/database/seed.js

    log "Database seed completed."
}

# -----------------------------------------------------------------------------
# Application Startup
# -----------------------------------------------------------------------------

start_application() {

    log "Starting application..."

    exec "$@"
}

# -----------------------------------------------------------------------------
# Startup Sequence
# -----------------------------------------------------------------------------

validate_environment

assert_docker_database_host

wait_for_postgres

wait_for_redis

run_migrations

run_seed

start_application "$@"