import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { Response } from 'express';
import { errorRequestResponse } from '../utils/helper';
import { Public } from '../decorators/public.decorator';
import { HealthService } from './health.service';

@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  liveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.healthService.getReadiness();

    if (report.status === 'degraded') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return errorRequestResponse(
        'Readiness check failed',
        HttpStatus.SERVICE_UNAVAILABLE,
        {
          code: 'SERVICE_UNAVAILABLE',
          data: report,
        },
      );
    }

    return report;
  }
}
