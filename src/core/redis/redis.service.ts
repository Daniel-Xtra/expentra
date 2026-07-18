import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.logger.log('Initializing Redis connection...');

    const redisOptions: RedisOptions = {
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
      retryStrategy(times: number) {
        return Math.min(times * 50, 2000);
      },
    };

    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    const disableSsl =
      this.configService.get<boolean>('REDIS_DISABLE_SSL') ?? false;

    if (!disableSsl) {
      redisOptions.tls = { rejectUnauthorized: false };
    }

    this.client = new Redis(redisUrl, redisOptions);

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      this.logger.error(
        `Redis connection error: ${error.message}`,
        error.stack,
      );
    });
  }

  onModuleDestroy() {
    this.logger.log('Closing Redis connection...');
    this.client.disconnect();
  }

  get clientInstance(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async delByPattern(pattern: string, count = 200): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const result = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count,
      );

      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  async setCache(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<'OK'> {
    return this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async getCache<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse JSON for key "${key}": ${message}`);
      return null;
    }
  }
}
