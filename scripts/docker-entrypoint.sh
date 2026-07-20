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
# Wait for PostgreSQL
# -----------------------------------------------------------------------------

wait_for_postgres() {

    timeout="${DATABASE_WAIT_TIMEOUT:-60}"

    log "Waiting for PostgreSQL..."

    while ! pg_isready \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        >/dev/null 2>&1
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
# Wait for Redis
# -----------------------------------------------------------------------------

wait_for_redis() {

    timeout="${REDIS_WAIT_TIMEOUT:-60}"

    log "Waiting for Redis..."

    while ! redis-cli \
        -h "$REDIS_HOST" \
        -p "$REDIS_PORT" \
        ping >/dev/null 2>&1
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