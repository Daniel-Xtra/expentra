import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/database/entities/user.entity';
import { Role } from 'src/database/entities/role.entity';
import { Department } from 'src/database/entities/department.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { RedisModule } from 'src/core/redis/redis.module';
import { BudgetModule } from '../budget/budget.module';
import { DepartmentModule } from '../department/department.module';
import { ExportModule } from '../export/export.module';
import { USER_SERVICE } from './contracts/user.contract';
import { UserController } from './controllers/user.controller';
import { UserDepartmentChangeService } from './services/user-department-change.service';
import { UserService } from './services/user.service';
import { UserExportJobRegistrar } from './registrars/user-export-job.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Department, Expense]),
    forwardRef(() => BudgetModule),
    DepartmentModule,
    RedisModule,
    forwardRef(() => ExportModule),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserDepartmentChangeService,
    UserExportJobRegistrar,
    { provide: USER_SERVICE, useExisting: UserService },
  ],
  exports: [UserService, USER_SERVICE],
})
export class UserModule {}
