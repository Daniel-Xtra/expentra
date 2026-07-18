import { Controller, Get, Header, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Public()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async metrics(@Res() response: Response): Promise<void> {
    const body = await this.metricsService.getMetricsText();
    if (response.headersSent) {
      return;
    }
    response
      .status(200)
      .type(this.metricsService.getContentType())
      .send(body);
  }
}
