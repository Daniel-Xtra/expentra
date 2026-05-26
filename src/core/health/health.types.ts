export type HealthCheckStatus = 'up' | 'down';

export type HealthCheckResult = {
  status: HealthCheckStatus;
  latencyMs: number;
  error?: string;
};

export type ReadinessReport = {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
  };
};

export type LivenessReport = {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
};
