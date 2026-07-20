import type { Role } from 'src/database/entities/role.entity';
import type { Permission } from 'src/database/entities/permission.entity';
import type { IAuthUser } from 'src/definition';
import type {
  CreateRoleInput,
  ListRolesQuery,
  PaginatedRolesResult,
  RoleTemplateView,
  SetRolePermissionsInput,
  UpdateRoleInput,
} from '../types/role.types';

export const ROLE_SERVICE = Symbol('ROLE_SERVICE');

export interface IRoleService {
  findTemplates(): Promise<RoleTemplateView[]>;
  create(actor: IAuthUser, input: CreateRoleInput): Promise<Role>;
  findAllRoles(query: ListRolesQuery): Promise<PaginatedRolesResult>;
  findAllPermissions(): Promise<Permission[]>;
  findOne(reference: string): Promise<Role>;
  update(reference: string, input: UpdateRoleInput): Promise<Role>;
  setPermissions(
    actor: IAuthUser,
    reference: string,
    input: SetRolePermissionsInput,
  ): Promise<Role>;
  applyTemplate(
    actor: IAuthUser,
    reference: string,
    templateKey: string,
  ): Promise<Role>;
  remove(reference: string): Promise<void>;
}
