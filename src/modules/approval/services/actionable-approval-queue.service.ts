import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpenseStatus } from 'src/database/entities/expense.enums';
import type { IAuthUser } from 'src/definition';
import { AccessPolicyService } from 'src/modules/authorization';
import { ApprovalLevelCatalogService } from './approval-level-catalog.service';
import { ApprovalRoutingService } from './approval-routing.service';
import { DelegationService } from './delegation.service';

const PENDING_APPROVAL_STATUSES = [
  ExpenseStatus.SUBMITTED,
  ExpenseStatus.UNDER_REVIEW,
];

@Injectable()
export class ActionableApprovalQueueService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseApproval)
    private readonly expenseApprovalRepository: Repository<ExpenseApproval>,
    private readonly accessPolicy: AccessPolicyService,
    private readonly routing: ApprovalRoutingService,
    private readonly approvalLevelCatalog: ApprovalLevelCatalogService,
    private readonly delegationService: DelegationService,
  ) {}

  async getActionableExpenseIds(authUser: IAuthUser): Promise<number[]> {
    const candidates = await this.loadPendingCandidates(authUser);
    if (candidates.length === 0) {
      return [];
    }

    const expenseIds = candidates.map((expense) => expense.id);
    const [approvalLevels, approvals] = await Promise.all([
      this.approvalLevelCatalog.getActiveLevels(),
      this.expenseApprovalRepository.find({
        where: { expenseId: In(expenseIds) },
        relations: { approvalLevel: true },
      }),
    ]);

    const approvalsByExpenseId = new Map<number, ExpenseApproval[]>();
    for (const approval of approvals) {
      const bucket = approvalsByExpenseId.get(approval.expenseId) ?? [];
      bucket.push(approval);
      approvalsByExpenseId.set(approval.expenseId, bucket);
    }

    const actionable: number[] = [];
    for (const expense of candidates) {
      if (
        await this.isActionableForUser(
          authUser,
          expense,
          approvalLevels,
          approvalsByExpenseId.get(expense.id) ?? [],
        )
      ) {
        actionable.push(expense.id);
      }
    }

    return actionable;
  }

  private async loadPendingCandidates(authUser: IAuthUser): Promise<Expense[]> {
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.user', 'expenseOwner')
      .leftJoinAndSelect('expense.department', 'department')
      .where('expense.status IN (:...statuses)', {
        statuses: PENDING_APPROVAL_STATUSES,
      })
      .andWhere('expense.userId != :userId', { userId: authUser.id });

    const managerDepartmentScope =
      this.accessPolicy.isManagerApprover(authUser);

    if (
      managerDepartmentScope &&
      !this.accessPolicy.hasGlobalApprovalPermission(authUser)
    ) {
      const deptIds = authUser.managedDepartmentIds;
      if (deptIds.length === 0) {
        return [];
      }
      qb.andWhere(
        '(expense.departmentId IN (:...deptIds) OR expenseOwner.departmentId IN (:...deptIds))',
        { deptIds },
      );
    }

    return qb.getMany();
  }

  private async isActionableForUser(
    authUser: IAuthUser,
    expense: Expense,
    approvalLevels: Awaited<
      ReturnType<ApprovalLevelCatalogService['getActiveLevels']>
    >,
    approvals: ExpenseApproval[],
  ): Promise<boolean> {
    if (!this.accessPolicy.canDecideOnExpense(authUser, expense)) {
      return false;
    }

    const stage = this.routing.getActiveStage(
      expense,
      approvalLevels,
      approvals,
    );
    if (!stage) {
      return false;
    }

    if (this.routing.canActOnStage(authUser, stage, expense)) {
      return true;
    }

    return this.delegationService.canActAsDelegate(authUser, expense, stage);
  }
}
