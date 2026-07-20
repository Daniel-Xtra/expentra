import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from 'src/database/entities/permission.entity';
import { Role } from 'src/database/entities/role.entity';
import { User } from 'src/database/entities/user.entity';
import { ROLE_SERVICE } from './contracts/role.contract';
import { RoleController } from './controllers/role.controller';
import { RoleService } from './services/role.service';
import { ParentPermission } from 'src/database/entities/parent-permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, ParentPermission, User]),
  ],
  controllers: [RoleController],
  providers: [RoleService, { provide: ROLE_SERVICE, useExisting: RoleService }],
  exports: [RoleService, ROLE_SERVICE],
})
export class RoleModule {}
