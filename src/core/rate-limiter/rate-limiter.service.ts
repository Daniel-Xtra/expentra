import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import * as fs from 'fs';
import * as path from 'path';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

@Injectable()
export class RateLimiterService implements OnModuleInit {
  private readonly logger = new Logger(RateLimiterService.name);
  private slidingWindowScript: string;

  constructor(private readonly redisService: RedisService) {}

  private readLuaScript(fileName: string): string {
    const distPath = path.join(__dirname, 'lua', fileName);
    if (fs.existsSync(distPath)) {
      return fs.readFileSync(distPath, 'utf8');
    }
    const srcPath = path.join(
      process.cwd(),
      'src',
      'core',
      'rate-limiter',
      'lua',
      fileName,
    );
    if (fs.existsSync(srcPath)) {
      return fs.readFileSync(srcPath, 'utf8');
    }
    throw new Error(
      `Lua script "${fileName}" not found under ${distPath} or ${srcPath}.`,
    );
  }

  onModuleInit() {
    this.slidingWindowScript = this.readLuaScript('sliding-window.lua');
    this.logger.log('Rate limiter Lua script loaded');
  }

  async checkRateLimit(
    resource: string,
    identifier: string,
    limit: number,
    ttlInMs: number,
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${resource}:${identifier}`;
    const now = Date.now();

    try {
      const result = (await this.redisService.clientInstance.eval(
        this.slidingWindowScript,
        1,
        key,
        now.toString(),
        ttlInMs.toString(),
        limit.toString(),
      )) as [number, number, number];

      const [allowed, remaining, resetTime] = result;

      return {
        allowed: allowed === 1,
        remaining,
        resetTime,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rate limit check failed for ${key}: ${msg}`);
      return { allowed: true, remaining: limit, resetTime: 0 };
    }
  }
}
