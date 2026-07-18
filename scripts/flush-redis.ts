/**
 * Flushes Redis used by Expentra (BullMQ queues, auth refresh tokens, caches).
 * Intended for local `migration:fresh` / `migration:fresh:seed` resets.
 *
 * Restart the API afterward so outbox relay repeatable jobs are re-registered.
 */
import { config as loadEnv } from 'dotenv';
import Redis, { type RedisOptions } from 'ioredis';

loadEnv();

function envFlag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

/**
 * Match Bull / local Docker: plain `redis://` never uses TLS.
 * `rediss://` always does. Otherwise honor REDIS_DISABLE_SSL.
 */
function shouldUseTls(redisUrl: string): boolean {
  try {
    const protocol = new URL(redisUrl).protocol;
    if (protocol === 'redis:') {
      return false;
    }
    if (protocol === 'rediss:') {
      return true;
    }
  } catch {
    // fall through to env
  }
  return !envFlag('REDIS_DISABLE_SSL', false);
}

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }

  const redisOptions: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    connectTimeout: 10_000,
    retryStrategy(times: number) {
      if (times > 8) {
        return null;
      }
      return Math.min(times * 150, 2000);
    },
  };

  if (shouldUseTls(redisUrl)) {
    redisOptions.tls = {
      rejectUnauthorized: envFlag('REDIS_TLS_REJECT_UNAUTHORIZED', true),
    };
  }

  const client = new Redis(redisUrl, redisOptions);

  try {
    await client.connect();
    await client.ping();
    await client.flushdb();
    console.log('Redis FLUSHDB completed (BullMQ jobs and app caches cleared).');
    console.log(
      'Restart the API so outbox relay schedules are re-created.',
    );
  } finally {
    client.disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Redis flush failed: ${message}`);
  console.error(
    'Ensure Redis is reachable at REDIS_URL (inside Docker: redis://redis:6379).',
  );
  process.exit(1);
});
