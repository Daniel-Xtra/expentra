import { Global, Module } from '@nestjs/common';
import { CorrelationContextService } from './correlation-context.service';
import { JobCorrelationService } from './job-correlation.service';

@Global()
@Module({
  providers: [CorrelationContextService, JobCorrelationService],
  exports: [CorrelationContextService, JobCorrelationService],
})
export class CorrelationModule {}
