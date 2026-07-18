import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { CorrelationContextService } from '../correlation/correlation-context.service';

export const CORRELATION_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_KEY = 'correlationId';

export type RequestWithCorrelationId = Request & {
  [CORRELATION_ID_KEY]?: string;
};

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly correlationContext: CorrelationContextService) {}

  use(req: RequestWithCorrelationId, res: Response, next: NextFunction): void {
    const incoming = req.headers[CORRELATION_ID_HEADER];
    const correlationId =
      typeof incoming === 'string' && incoming.trim()
        ? incoming.trim()
        : randomUUID();

    req[CORRELATION_ID_KEY] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    this.correlationContext.run(correlationId, () => next());
  }
}
