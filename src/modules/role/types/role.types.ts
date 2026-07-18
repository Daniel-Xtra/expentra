import { Role } from 'src/database/entities/role.entity';

export type CreateRoleInput = {
  name: string;
  description?: string;
  templateKey?: string;
};

export type RoleTemplateView = {
  key: string;
  name: string;
  description: string;
  permissionCount: number;
};

export type UpdateRoleInput = {
  name?: string;
  description?: string;
};

export type ListRolesQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PaginatedRolesResult = {
  data: Role[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type SetRolePermissionsInput = {
  permissionReferences: string[];
};
