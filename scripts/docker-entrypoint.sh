#!/bin/sh
set -e

log() {
  printf '%s\n' "$1"
}

assert_docker_database_host() {
  if [ ! -f /.dockerenv ]; then
    return 0
  fi

  case "${POSTGRES_HOST}" in
    localhost | 127.0.0.1)
      log "ERROR: POSTGRES_HOST=${POSTGRES_HOST} does not work inside Docker."
      log "Set POSTGRES_HOST=postgres in .env (Compose service name)."
      log "Set REDIS_URL=redis://redis:6379 for the Redis service."
      exit 1
      ;;
  esac
}

run_migrations() {
  log 'Running database migrations...'
  if [ "${USE_COMPILED_DB:-false}" = 'true' ]; then
    node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
  else
    pnpm run migration:run
  fi
  log 'Migrations finished.'
}

run_seed() {
  log 'Running database seeders...'
  if [ "${USE_COMPILED_DB:-false}" = 'true' ]; then
    node dist/database/seeds/database.seeder.js
  else
    pnpm run seed:run
  fi
  log 'Seeders finished.'
}

assert_docker_database_host

if [ "${RUN_MIGRATIONS:-true}" = 'true' ]; then
  run_migrations
fi

if [ "${RUN_SEED:-false}" = 'true' ]; then
  run_seed
fi

log 'Starting application...'
exec "$@"
