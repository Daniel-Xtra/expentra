import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAuthUser } from 'src/definition';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthContextCacheService {
  private readonly PREFIX = 'auth:ctx:';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private cacheKey(reference: string): string {
    return `${this.PREFIX}${reference}`;
  }

  private ttlSeconds(): number {
    return this.configService.get<number>('AUTH_CONTEXT_CACHE_TTL_SECONDS', 60);
  }

  async get(reference: string): Promise<IAuthUser | null> {
    if (this.ttlSeconds() <= 0) {
      return null;
    }
    return this.redisService.getCache<IAuthUser>(this.cacheKey(reference));
  }

  async set(reference: string, authUser: IAuthUser): Promise<void> {
    const ttl = this.ttlSeconds();
    if (ttl <= 0) {
      return;
    }
    await this.redisService.setCache(this.cacheKey(reference), authUser, ttl);
  }

  async invalidate(reference: string): Promise<void> {
    await this.redisService.del(this.cacheKey(reference));
  }

  async invalidateMany(references: string[]): Promise<void> {
    const unique = [...new Set(references.filter(Boolean))];
    if (unique.length === 0) {
      return;
    }
    await Promise.all(unique.map((reference) => this.invalidate(reference)));
  }
}
