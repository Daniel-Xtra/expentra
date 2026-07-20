import { Injectable, NotFoundException } from '@nestjs/common';
import type { IAuthUser } from 'src/definition';
import {
  ExportJobType,
  type ExportRequest,
  type GeneratedExportFile,
} from '../types/export.types';

export type ExportJobHandler = {
  jobTypes: ExportJobType[];
  generate(
    request: ExportRequest,
    authUser: IAuthUser,
  ): Promise<GeneratedExportFile>;
};

@Injectable()
export class ExportJobHandlerRegistry {
  private readonly handlers = new Map<ExportJobType, ExportJobHandler>();

  register(handler: ExportJobHandler): void {
    for (const jobType of handler.jobTypes) {
      this.handlers.set(jobType, handler);
    }
  }

  async generate(
    request: ExportRequest,
    authUser: IAuthUser,
  ): Promise<GeneratedExportFile> {
    const handler = this.handlers.get(request.jobType);
    if (!handler) {
      throw new NotFoundException(
        `No export handler registered for job type: ${request.jobType}`,
      );
    }
    return handler.generate(request, authUser);
  }
}
