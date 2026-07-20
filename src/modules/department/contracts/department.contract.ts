import type { EntityManager } from 'typeorm';
import type { IAuthUser } from 'src/definition';
import type { Department } from 'src/database/entities/department.entity';
import type {
  CreateDepartmentInput,
  ListDepartmentManagerHistoryQuery,
  ListDepartmentsQuery,
  ListDepartmentUsersQuery,
  PaginatedDepartmentManagerHistoryResult,
  PaginatedDepartmentsResult,
  PaginatedDepartmentUsersResult,
  UpdateDepartmentInput,
} from '../types/department.types';
import type {
  DepartmentDetailSummary,
} from '../types/department-response.types';

export const DEPARTMENT_SERVICE = Symbol('DEPARTMENT_SERVICE');

export interface IDepartmentService {
  create(input: CreateDepartmentInput): Promise<Department>;
  findAllDepartments(
    query: ListDepartmentsQuery,
  ): Promise<PaginatedDepartmentsResult>;
  buildDepartmentsExportCsv(query: ListDepartmentsQuery): Promise<string>;
  getDepartmentDetailSummary(
    reference: string,
  ): Promise<DepartmentDetailSummary>;
  findOne(reference: string): Promise<Department>;
  findManagedDepartments(managerId: number): Promise<Department[]>;
  findOneForManager(managerId: number, reference: string): Promise<Department>;
  findDepartmentUsers(
    reference: string,
    query: ListDepartmentUsersQuery,
  ): Promise<PaginatedDepartmentUsersResult>;
  findManagerHistory(
    reference: string,
    query: ListDepartmentManagerHistoryQuery,
  ): Promise<PaginatedDepartmentManagerHistoryResult>;
  update(
    reference: string,
    input: UpdateDepartmentInput,
    actorId?: number,
  ): Promise<Department>;
  releaseManagerIfUserLeftDepartment(
    departmentId: number,
    userId: number,
    actorId?: number,
    entityManager?: EntityManager,
  ): Promise<void>;
  countPendingApprovals(departmentId: number): Promise<number>;
  countPendingApprovalsForDepartments(
    departmentIds: number[],
  ): Promise<Map<number, number>>;
  assertManagerCanLeaveDepartment(
    departmentId: number,
    userId: number,
  ): Promise<void>;
  remove(reference: string): Promise<void>;
}
