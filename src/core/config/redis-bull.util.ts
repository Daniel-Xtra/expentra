import type { RedisOptions } from 'ioredis';

export function redisOptionsFromUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  const port = url.port ? Number(url.port) : 6379;
  const db =
    url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined;

  return {
    host: url.hostname,
    port,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(db !== undefined && !Number.isNaN(db) ? { db } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
