import { Injectable } from '@nestjs/common';
import { CorrelationContextService } from './correlation-context.service';
import type { WithJobCorrelation } from './job-correlation.types';

@Injectable()
export class JobCorrelationService {
  constructor(private readonly correlationContext: CorrelationContextService) {}

  attach<T extends Record<string, unknown>>(payload: T): WithJobCorrelation<T> {
    const correlationId = this.correlationContext.get();
    if (!correlationId) {
      return payload;
    }

    return { ...payload, correlationId };
  }
}
