import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { Department } from 'src/database/entities/department.entity';
import type { IDepartmentService } from '../contracts/department.contract';
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
import { DepartmentManagerService } from './department-manager.service';
import { DepartmentMutationService } from './department-mutation.service';
import { DepartmentQueryService } from './department-query.service';

@Injectable()
export class DepartmentService implements IDepartmentService {
  constructor(
    private readonly queryService: DepartmentQueryService,
    private readonly mutationService: DepartmentMutationService,
    private readonly departmentManagerService: DepartmentManagerService,
  ) {}

  create(input: CreateDepartmentInput): Promise<Department> {
    return this.mutationService.create(input);
  }

  findAllDepartments(
    query: ListDepartmentsQuery,
  ): Promise<PaginatedDepartmentsResult> {
    return this.queryService.findAllDepartments(query);
  }

  buildDepartmentsExportCsv(query: ListDepartmentsQuery): Promise<string> {
    return this.queryService.buildDepartmentsExportCsv(query);
  }

  getDepartmentDetailSummary(
    reference: string,
  ): Promise<DepartmentDetailSummary> {
    return this.queryService.getDepartmentDetailSummary(reference);
  }

  findOne(reference: string): Promise<Department> {
    return this.queryService.findOne(reference);
  }

  findManagedDepartments(managerId: number): Promise<Department[]> {
    return this.queryService.findManagedDepartments(managerId);
  }

  findOneForManager(managerId: number, reference: string): Promise<Department> {
    return this.queryService.findOneForManager(managerId, reference);
  }

  findDepartmentUsers(
    reference: string,
    query: ListDepartmentUsersQuery,
  ): Promise<PaginatedDepartmentUsersResult> {
    return this.queryService.findDepartmentUsers(reference, query);
  }

  findManagerHistory(
    reference: string,
    query: ListDepartmentManagerHistoryQuery,
  ): Promise<PaginatedDepartmentManagerHistoryResult> {
    return this.queryService.findManagerHistory(reference, query);
  }

  update(
    reference: string,
    input: UpdateDepartmentInput,
    actorId?: number,
  ): Promise<Department> {
    return this.mutationService.update(reference, input, actorId);
  }

  releaseManagerIfUserLeftDepartment(
    departmentId: number,
    userId: number,
    actorId?: number,
    entityManager?: EntityManager,
  ): Promise<void> {
    return this.departmentManagerService.releaseManagerIfUserLeftDepartment(
      departmentId,
      userId,
      actorId,
      entityManager,
    );
  }

  countPendingApprovals(departmentId: number): Promise<number> {
    return this.queryService.countPendingApprovals(departmentId);
  }

  countPendingApprovalsForDepartments(
    departmentIds: number[],
  ): Promise<Map<number, number>> {
    return this.queryService.countPendingApprovalsForDepartments(departmentIds);
  }

  assertManagerCanLeaveDepartment(
    departmentId: number,
    userId: number,
  ): Promise<void> {
    return this.departmentManagerService.assertManagerCanLeaveDepartment(
      departmentId,
      userId,
    );
  }

  remove(reference: string): Promise<void> {
    return this.mutationService.remove(reference);
  }
}
