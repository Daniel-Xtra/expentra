import { ForbiddenException, Injectable } from '@nestjs/common';
import { isSuperAdminUser } from 'src/database/constants/system-roles';
import { Permission } from 'src/database/entities/permission.entity';
import type { IAuthUser } from 'src/definition';
import { assertNoSeparationOfDutiesConflicts } from '../policies/separation-of-duties.rules';
import { PermissionEvaluatorService } from '../services/permission-evaluator.service';

@Injectable()
export class PermissionAssignmentPolicy {
  constructor(
    private readonly permissionEvaluator: PermissionEvaluatorService,
  ) {}

  assertCanAssignPermissions(
    actor: IAuthUser,
    permissions: Permission[],
  ): void {
    if (!isSuperAdminUser(actor)) {
      for (const permission of permissions) {
        if (
          !this.permissionEvaluator.hasPermission(
            actor,
            permission.action,
            permission.resource,
            permission.scope,
          )
        ) {
          throw new ForbiddenException(
            `You cannot assign permission "${permission.name}"`,
          );
        }
      }
    }

    assertNoSeparationOfDutiesConflicts(permissions);
  }
}