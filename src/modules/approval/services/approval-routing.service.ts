import { ConflictException, Injectable } from '@nestjs/common';
import { ApprovalApproverType } from 'src/database/entities/approval-approver-type.enum';
import {
  ApprovalDecision,
  ExpenseStatus,
} from 'src/database/entities/expense.enums';
import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import type { Expense } from 'src/database/entities/expense.entity';
import type { ExpenseApproval } from 'src/database/entities/expense-approval.entity';
import type { IAuthUser } from 'src/definition';
import { AccessPolicyService } from 'src/modules/authorization';

export type ApprovalChainStepStatus =
  | 'waiting'
  | 'pending'
  | 'approved'
  | 'rejected';

export type ApprovalChainActor = {
  reference: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type ApprovalChainStep = {
  level: number;
  name: string;
  approverType: ApprovalApproverType;
  status: ApprovalChainStepStatus;
  decidedAt?: Date;
  decidedBy?: ApprovalChainActor;
};

@Injectable()
export class ApprovalRoutingService {
  constructor(private readonly accessPolicy: AccessPolicyService) {}

  private toChainActor(
    approver: ExpenseApproval['approver'] | undefined,
  ): ApprovalChainActor | undefined {
    if (!approver) {
      return undefined;
    }

    return {
      reference: approver.reference,
      email: approver.email,
      firstName: approver.firstName,
      lastName: approver.lastName,
    };
  }

  getStageName(level: ApprovalLevel): string {
    return level.name;
  }

  getRoleName(level: ApprovalLevel): string {
    return level.name;
  }

  shouldSkipDepartmentManagerStage(expense: Expense): boolean {
    const departmentManagerId = expense.department?.managerId ?? null;
    if (departmentManagerId == null) {
      return false;
    }

    return expense.userId === departmentManagerId;
  }

  levelAppliesToExpense(level: ApprovalLevel, expenseAmount: number): boolean {
    if (expenseAmount < level.minimumAmount) {
      return false;
    }

    if (level.maximumAmount != null && expenseAmount > level.maximumAmount) {
      return false;
    }

    return true;
  }

  getRequiredLevels(
    expense: Expense,
    approvalLevels: ApprovalLevel[],
  ): ApprovalLevel[] {
    return approvalLevels
      .filter((level) => level.isActive)
      .filter((level) => this.levelAppliesToExpense(level, expense.amount))
      .filter(
        (level) =>
          level.approverType !== ApprovalApproverType.DEPARTMENT_MANAGER ||
          !this.shouldSkipDepartmentManagerStage(expense),
      )
      .sort((left, right) => left.level - right.level);
  }

  resolveInitialSubmitStatus(
    expense: Expense,
    approvalLevels: ApprovalLevel[],
  ): ExpenseStatus {
    const required = this.getRequiredLevels(expense, approvalLevels);
    if (required.length === 0) {
      return ExpenseStatus.APPROVED;
    }

    const firstStage = required[0];
    if (firstStage.approverType === ApprovalApproverType.FINANCE_MANAGER) {
      return ExpenseStatus.UNDER_REVIEW;
    }

    return ExpenseStatus.SUBMITTED;
  }

  requiresApprovalChain(
    expense: Expense,
    approvalLevels: ApprovalLevel[],
  ): boolean {
    return this.getRequiredLevels(expense, approvalLevels).length > 0;
  }

  getActiveStage(
    expense: Expense,
    approvalLevels: ApprovalLevel[],
    approvals: ExpenseApproval[],
  ): ApprovalLevel | null {
    if (
      expense.status !== ExpenseStatus.SUBMITTED &&
      expense.status !== ExpenseStatus.UNDER_REVIEW
    ) {
      return null;
    }

    const required = this.getRequiredLevels(expense, approvalLevels);
    for (const level of required) {
      const decision = approvals.find(
        (approval) => approval.approvalLevelId === level.id,
      );
      if (!decision) {
        return level;
      }
      if (decision.decision !== ApprovalDecision.APPROVED) {
        return null;
      }
    }

    return null;
  }

  buildApprovalChain(
    expense: Expense,
    approvalLevels: ApprovalLevel[],
    approvals: ExpenseApproval[],
  ): ApprovalChainStep[] {
    const required = this.getRequiredLevels(expense, approvalLevels);
    const activeStage = this.getActiveStage(expense, approvalLevels, approvals);

    return required.map((level) => {
      const decision = approvals.find(
        (approval) => approval.approvalLevelId === level.id,
      );

      if (decision?.decision === ApprovalDecision.APPROVED) {
        return {
          level: level.level,
          name: level.name,
          approverType: level.approverType,
          status: 'approved' as const,
          decidedAt: decision.decidedAt,
          decidedBy: this.toChainActor(decision.approver),
        };
      }

      if (decision?.decision === ApprovalDecision.REJECTED) {
        return {
          level: level.level,
          name: level.name,
          approverType: level.approverType,
          status: 'rejected' as const,
          decidedAt: decision.decidedAt,
          decidedBy: this.toChainActor(decision.approver),
        };
      }

      if (activeStage?.id === level.id) {
        return {
          level: level.level,
          name: level.name,
          approverType: level.approverType,
          status: 'pending' as const,
        };
      }

      return {
        level: level.level,
        name: level.name,
        approverType: level.approverType,
        status: 'waiting' as const,
      };
    });
  }

  assertReadyForStageApproval(
    stage: ApprovalLevel,
    expense: Expense,
    approvalLevels: ApprovalLevel[],
    approvals: ExpenseApproval[],
  ): void {
    const activeStage = this.getActiveStage(expense, approvalLevels, approvals);
    if (!activeStage || activeStage.id !== stage.id) {
      throw new ConflictException(
        'Complete earlier approval stages before acting on this one',
      );
    }

    this.assertPriorLevelsComplete(stage, approvals, approvalLevels, expense);
    this.assertExpenseStatusForStage(stage, expense, approvalLevels);
  }

  canActOnStage(
    authUser: IAuthUser,
    stage: ApprovalLevel,
    expense: Expense,
  ): boolean {
    return this.accessPolicy.canActOnApprovalStage(authUser, expense, stage);
  }

  resolveStatusAfterLevelApproval(
    stage: ApprovalLevel,
    expense: Expense,
    approvalLevels: ApprovalLevel[],
  ): ExpenseStatus {
    const required = this.getRequiredLevels(expense, approvalLevels);
    const stageIndex = required.findIndex((level) => level.id === stage.id);
    if (stageIndex < 0 || stageIndex >= required.length - 1) {
      return ExpenseStatus.APPROVED;
    }
    return ExpenseStatus.UNDER_REVIEW;
  }

  assertPriorLevelsComplete(
    stage: ApprovalLevel,
    approvals: ExpenseApproval[],
    approvalLevels: ApprovalLevel[],
    expense: Expense,
  ): void {
    const required = this.getRequiredLevels(expense, approvalLevels);
    const stageIndex = required.findIndex((level) => level.id === stage.id);
    if (stageIndex < 0) {
      throw new ConflictException(
        'Approval stage is not part of this workflow',
      );
    }

    for (let index = 0; index < stageIndex; index += 1) {
      const priorLevel = required[index];
      const approved = approvals.some(
        (approval) =>
          approval.approvalLevelId === priorLevel.id &&
          approval.decision === ApprovalDecision.APPROVED,
      );
      if (!approved) {
        throw new ConflictException(
          `Approval at level ${this.getStageName(priorLevel)} is required before ${this.getStageName(stage)}`,
        );
      }
    }
  }

  private assertExpenseStatusForStage(
    stage: ApprovalLevel,
    expense: Expense,
    approvalLevels: ApprovalLevel[],
  ): void {
    const required = this.getRequiredLevels(expense, approvalLevels);
    const stageIndex = required.findIndex((level) => level.id === stage.id);
    if (stageIndex < 0) {
      return;
    }

    if (stageIndex > 0 && expense.status !== ExpenseStatus.UNDER_REVIEW) {
      throw new ConflictException(
        'Earlier approval stages must be completed before this stage',
      );
    }

    if (stageIndex === 0) {
      if (
        stage.approverType === ApprovalApproverType.DEPARTMENT_MANAGER &&
        expense.status !== ExpenseStatus.SUBMITTED
      ) {
        throw new ConflictException(
          'This expense is not awaiting department manager approval',
        );
      }

      if (
        stage.approverType === ApprovalApproverType.FINANCE_MANAGER &&
        expense.status !== ExpenseStatus.UNDER_REVIEW
      ) {
        throw new ConflictException(
          'This expense is not awaiting finance approval',
        );
      }
    }
  }
}
