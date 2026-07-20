import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { QueueHealthService } from '../health/queue-health.service';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  readonly registry = new Registry();

  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDurationSeconds: Histogram<string>;
  private readonly queueJobs: Gauge<string>;
  private readonly appInfo: Gauge<string>;

  private queuePollTimer?: NodeJS.Timeout;

  constructor(private readonly queueHealthService: QueueHealthService) {
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'expentra_http_requests_total',
      help: 'Total HTTP requests handled by the API',
      labelNames: ['method', 'route', 'status_code'] as const,
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'expentra_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'] as const,
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.queueJobs = new Gauge({
      name: 'expentra_queue_jobs',
      help: 'BullMQ job counts by queue and state',
      labelNames: ['queue', 'state'] as const,
      registers: [this.registry],
    });

    this.appInfo = new Gauge({
      name: 'expentra_app_info',
      help: 'Static app info label set',
      labelNames: ['service'] as const,
      registers: [this.registry],
    });
    this.appInfo.set({ service: 'expentra-api' }, 1);
  }

  onModuleInit(): void {
    void this.refreshQueueMetrics();
    this.queuePollTimer = setInterval(() => {
      void this.refreshQueueMetrics();
    }, 15_000);
    this.queuePollTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.queuePollTimer) {
      clearInterval(this.queuePollTimer);
    }
  }

  observeHttpRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }): void {
    const labels = {
      method: input.method,
      route: input.route,
      status_code: String(input.statusCode),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, input.durationSeconds);
  }

  async getMetricsText(): Promise<string> {
    await this.refreshQueueMetrics();
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  private async refreshQueueMetrics(): Promise<void> {
    try {
      const queues = await this.queueHealthService.checkQueues();
      for (const [queue, check] of Object.entries(queues)) {
        this.queueJobs.set({ queue, state: 'waiting' }, check.waiting);
        this.queueJobs.set({ queue, state: 'active' }, check.active);
        this.queueJobs.set({ queue, state: 'delayed' }, check.delayed);
        this.queueJobs.set({ queue, state: 'failed' }, check.failed);
      }
    } catch {
      // Keep serving HTTP metrics even if queue scrape fails.
    }
  }
}
