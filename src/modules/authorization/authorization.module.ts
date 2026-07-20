import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from 'src/database/entities/department.entity';
import { User } from 'src/database/entities/user.entity';
import { AbilityFactory } from './ability/ability.factory';
import { AuthorizationController } from './controllers/authorization.controller';
import { AccessGuard } from './guards/access.guard';
import { ApprovalAccessPolicy } from './policies/approval-access.policy';
import { ExpenseAccessPolicy } from './policies/expense-access.policy';
import { AccessPolicyService } from './services/access-policy.service';
import { AuthorizationService } from './services/authorization.service';
import { PermissionAssignmentPolicy } from './services/permission-assignment.policy';
import { PermissionEvaluatorService } from './services/permission-evaluator.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, Department])],
  controllers: [AuthorizationController],
  providers: [
    PermissionEvaluatorService,
    PermissionAssignmentPolicy,
    ApprovalAccessPolicy,
    ExpenseAccessPolicy,
    AccessPolicyService,
    AbilityFactory,
    AuthorizationService,
    AccessGuard,
  ],
  exports: [
    PermissionEvaluatorService,
    PermissionAssignmentPolicy,
    AccessPolicyService,
    AbilityFactory,
    AuthorizationService,
    AccessGuard,
  ],
})
export class AuthorizationModule {}
