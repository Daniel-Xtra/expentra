import { timingSafeEqual } from 'crypto';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RedisOptions } from 'ioredis';
import { Queue } from 'bullmq';
import {
  DOMAIN_EVENT_QUEUE,
  OUTBOX_RELAY_QUEUE,
} from 'src/core/outbox/constants/outbox-queue.constants';
import { BUDGET_RECONCILIATION_QUEUE } from 'src/modules/budget/constants/budget-reconciliation.constants';
import { EXPORT_QUEUE } from 'src/modules/export/constants/export-queue.constants';
import { EMAIL_NOTIFICATION_QUEUE } from 'src/modules/notification/constants/notification-queue';
import { APPROVAL_ESCALATION_QUEUE } from 'src/modules/approval/constants/approval-queue';

const QUEUE_DASHBOARD_PATH = '/admin/queues';

const QUEUE_NAMES = [
  OUTBOX_RELAY_QUEUE,
  DOMAIN_EVENT_QUEUE,
  EXPORT_QUEUE,
  EMAIL_NOTIFICATION_QUEUE,
  APPROVAL_ESCALATION_QUEUE,
  BUDGET_RECONCILIATION_QUEUE,
] as const;

function redisOptionsFromUrl(redisUrl: string): RedisOptions {
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

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function unauthorized(response: Response): void {
  response.setHeader(
    'WWW-Authenticate',
    'Basic realm="Expentra Queue Dashboard"',
  );
  response.status(401).send('Authentication required');
}

function createBasicAuthMiddleware(
  username: string,
  password: string,
): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Basic ')) {
      unauthorized(response);
      return;
    }

    const decoded = Buffer.from(header.slice('Basic '.length), 'base64')
      .toString('utf8')
      .split(':');
    const providedUsername = decoded.shift() ?? '';
    const providedPassword = decoded.join(':');

    if (
      !safeCompare(providedUsername, username) ||
      !safeCompare(providedPassword, password)
    ) {
      unauthorized(response);
      return;
    }

    next();
  };
}

function resolveDashboardCredentials(config: ConfigService): {
  username: string;
  password: string;
} {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const username = config.get<string>('QUEUE_DASHBOARD_USERNAME')?.trim();
  const password = config.get<string>('QUEUE_DASHBOARD_PASSWORD');

  if (username && password) {
    return { username, password };
  }

  if (isProduction) {
    throw new Error(
      'QUEUE_DASHBOARD_USERNAME and QUEUE_DASHBOARD_PASSWORD are required when QUEUE_DASHBOARD_ENABLED=true in production',
    );
  }

  return { username: username || 'admin', password: password || 'admin' };
}

export function setupQueueDashboard(
  app: INestApplication,
  config: ConfigService,
): void {
  if (!config.get<boolean>('QUEUE_DASHBOARD_ENABLED', false)) {
    return;
  }

  const logger = new Logger('QueueDashboard');
  const connection = redisOptionsFromUrl(
    config.getOrThrow<string>('REDIS_URL'),
  );
  const credentials = resolveDashboardCredentials(config);
  const serverAdapter = new ExpressAdapter();

  serverAdapter.setBasePath(QUEUE_DASHBOARD_PATH);

  createBullBoard({
    queues: QUEUE_NAMES.map(
      (name) => new BullMQAdapter(new Queue(name, { connection })),
    ),
    serverAdapter,
  });

  app.use(
    QUEUE_DASHBOARD_PATH,
    createBasicAuthMiddleware(credentials.username, credentials.password),
    serverAdapter.getRouter(),
  );

  logger.log(`Bull Board queue dashboard mounted at ${QUEUE_DASHBOARD_PATH}`);
}
