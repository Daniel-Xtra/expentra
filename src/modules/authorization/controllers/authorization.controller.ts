import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import { AllowAuthenticated } from 'src/core/decorators/allow-authenticated.decorator';
import { AuthUser } from 'src/core/decorators/auth-user.decorator';
import type { IAuthUser } from 'src/definition';
import { successRequestResponse } from 'src/core/utils/helper';
import {
  excelExportFromCsv,
  EXCEL_MIME_TYPE,
} from 'src/modules/export/utils/excel-export.util';
import { RequireAnyPermissionByName } from '../decorators/require-permission.decorator';
import { AuthorizationService } from '../services/authorization.service';

@Controller({ path: 'authorization', version: '1' })
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Get('me')
  @AllowAuthenticated()
  async myAuthorization(@AuthUser() authUser: IAuthUser) {
    const user = await this.authorizationService.findActiveUserWithRole(
      authUser.id,
    );
    const context = await this.authorizationService.buildContextForUser(user);

    return successRequestResponse('Authorization context loaded', context);
  }

  @Get('access-review')
  @RequireAnyPermissionByName('role.read', 'user.read', 'audit.read')
  @HttpCode(HttpStatus.OK)
  async accessReview() {
    const report = await this.authorizationService.buildAccessReview();
    return successRequestResponse('Access review report generated', report);
  }

  @Get('access-review/export')
  @RequireAnyPermissionByName('role.read', 'user.read', 'audit.read')
  @Header('Content-Type', EXCEL_MIME_TYPE)
  @Header('Content-Disposition', 'attachment; filename="access-review.xlsx"')
  async exportAccessReview(): Promise<StreamableFile> {
    const csv = await this.authorizationService.buildAccessReviewCsv();
    const file = await excelExportFromCsv(csv, 'access-review.xlsx');
    return new StreamableFile(file.buffer);
  }
}
