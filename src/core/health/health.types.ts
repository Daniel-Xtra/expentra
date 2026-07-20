export type HealthCheckStatus = 'up' | 'down';

export type HealthCheckResult = {
  status: HealthCheckStatus;
  latencyMs: number;
  error?: string;
};

export type OutboxHealthCheck = {
  status: HealthCheckStatus;
  pendingCount: number;
  oldestPendingAgeSeconds: number | null;
};

export type QueueHealthCheck = {
  status: HealthCheckStatus;
  latencyMs: number;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  error?: string;
};

export type ReadinessReport = {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    outbox: OutboxHealthCheck;
    queues: Record<string, QueueHealthCheck>;
  };
};

export type LivenessReport = {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
};
