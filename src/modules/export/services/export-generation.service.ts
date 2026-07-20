import { Inject, Injectable } from '@nestjs/common';
import { toAuthUser } from 'src/modules/authorization';
import type { IAuthUser } from 'src/definition';
import {
  USER_SERVICE,
  type IUserService,
} from 'src/modules/user/contracts/user.contract';
import type { ExportRequest, GeneratedExportFile } from '../types/export.types';
import { ExportJobHandlerRegistry } from './export-job-handler.registry';

@Injectable()
export class ExportGenerationService {
  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    private readonly handlerRegistry: ExportJobHandlerRegistry,
  ) {}

  async generateForUser(
    userId: number,
    request: ExportRequest,
  ): Promise<GeneratedExportFile> {
    const authUser = await this.loadAuthUser(userId);
    return this.handlerRegistry.generate(request, authUser);
  }

  private async loadAuthUser(userId: number): Promise<IAuthUser> {
    const user = await this.userService.findOne(userId);
    const managedDepartmentIds =
      await this.userService.findManagedDepartmentIds(user.id);
    return toAuthUser(user, { managedDepartmentIds });
  }
}
