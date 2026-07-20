import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxService } from 'src/core/outbox/services/outbox.service';
import { RedisService } from '../redis/redis.service';
import type { LivenessReport, ReadinessReport } from './health.types';
import { QueueHealthService } from './queue-health.service';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly outboxService: OutboxService,
    private readonly queueHealthService: QueueHealthService,
  ) {}

  getLiveness(): LivenessReport {
    return {
      status: 'ok',
      uptimeSeconds: this.uptimeSeconds(),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessReport> {
    const [database, redis, outbox, queues] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOutbox(),
      this.queueHealthService.checkQueues(),
    ]);

    const queuesUp = Object.values(queues).every(
      (queue) => queue.status === 'up',
    );
    const status =
      database.status === 'up' &&
      redis.status === 'up' &&
      outbox.status === 'up' &&
      queuesUp
        ? 'ok'
        : 'degraded';

    const report: ReadinessReport = {
      status,
      uptimeSeconds: this.uptimeSeconds(),
      timestamp: new Date().toISOString(),
      checks: { database, redis, outbox, queues },
    };

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

  private async checkOutbox(): Promise<ReadinessReport['checks']['outbox']> {
    try {
      const [pendingCount, oldestPendingAgeSeconds] = await Promise.all([
        this.outboxService.countPending(),
        this.outboxService.oldestPendingAgeSeconds(),
      ]);

      const lagThresholdSeconds = 15 * 60;
      const status =
        oldestPendingAgeSeconds !== null &&
        oldestPendingAgeSeconds > lagThresholdSeconds
          ? 'down'
          : 'up';

      return {
        status,
        pendingCount,
        oldestPendingAgeSeconds,
      };
    } catch (error) {
      return {
        status: 'down',
        pendingCount: -1,
        oldestPendingAgeSeconds: null,
      };
    }
  }

  private uptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}
