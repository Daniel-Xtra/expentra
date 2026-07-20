import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/core/redis/redis.service';
import {
  IDEMPOTENCY_LOCK_TTL_SECONDS,
  IDEMPOTENCY_TTL_SECONDS,
} from './idempotency.constants';

export type IdempotencyRecord = {
  statusCode: number;
  body: unknown;
};

@Injectable()
export class IdempotencyService {
  constructor(private readonly redisService: RedisService) {}

  private buildKey(userId: number, routeKey: string, idempotencyKey: string): string {
    return `idempotency:${userId}:${routeKey}:${idempotencyKey}`;
  }

  private buildLockKey(userId: number, routeKey: string, idempotencyKey: string): string {
    return `idempotency:lock:${userId}:${routeKey}:${idempotencyKey}`;
  }

  async get(
    userId: number,
    routeKey: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null> {
    return this.redisService.getCache<IdempotencyRecord>(
      this.buildKey(userId, routeKey, idempotencyKey),
    );
  }

  async save(
    userId: number,
    routeKey: string,
    idempotencyKey: string,
    record: IdempotencyRecord,
  ): Promise<void> {
    await this.redisService.setCache(
      this.buildKey(userId, routeKey, idempotencyKey),
      record,
      IDEMPOTENCY_TTL_SECONDS,
    );
  }

  async acquireLock(
    userId: number,
    routeKey: string,
    idempotencyKey: string,
  ): Promise<boolean> {
    return this.redisService.setIfNotExists(
      this.buildLockKey(userId, routeKey, idempotencyKey),
      '1',
      IDEMPOTENCY_LOCK_TTL_SECONDS,
    );
  }

  async releaseLock(
    userId: number,
    routeKey: string,
    idempotencyKey: string,
  ): Promise<void> {
    await this.redisService.del(
      this.buildLockKey(userId, routeKey, idempotencyKey),
    );
  }

  async waitForRecord(
    userId: number,
    routeKey: string,
    idempotencyKey: string,
    attempts = 30,
    delayMs = 100,
  ): Promise<IdempotencyRecord | null> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const record = await this.get(userId, routeKey, idempotencyKey);
      if (record) {
        return record;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return null;
  }
}
