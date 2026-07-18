import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import type { LivenessReport, ReadinessReport } from './health.types';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  getLiveness(): LivenessReport {
    return {
      status: 'ok',
      uptimeSeconds: this.uptimeSeconds(),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status =
      database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';

    const report: ReadinessReport = {
      status,
      uptimeSeconds: this.uptimeSeconds(),
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };

    if (status === 'degraded') {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }

  private async checkDatabase(): Promise<
    ReadinessReport['checks']['database']
  > {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkRedis(): Promise<ReadinessReport['checks']['redis']> {
    const start = Date.now();
    try {
      const pong = await this.redisService.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${pong}`);
      }
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private uptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}
