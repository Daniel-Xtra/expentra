import type { IAuthUser } from 'src/definition';
import type {
  ApproveExpenseInput,
  RejectExpenseInput,
} from '../types/approval.types';
import type { BulkApprovalResult } from '../types/bulk-approval.types';
import type { ExpenseApproval } from 'src/database/entities/expense-approval.entity';

export const APPROVAL_SERVICE = Symbol('APPROVAL_SERVICE');

export interface IApprovalService {
  approve(
    authUser: IAuthUser,
    expenseId: number,
    input: ApproveExpenseInput,
  ): Promise<ExpenseApproval>;

  reject(
    authUser: IAuthUser,
    expenseId: number,
    input: RejectExpenseInput,
  ): Promise<ExpenseApproval>;

  approveByReference(
    authUser: IAuthUser,
    expenseReference: string,
    input: ApproveExpenseInput,
  ): Promise<ExpenseApproval>;

  rejectByReference(
    authUser: IAuthUser,
    expenseReference: string,
    input: RejectExpenseInput,
  ): Promise<ExpenseApproval>;

  bulkApproveByReference(
    authUser: IAuthUser,
    expenseReferences: string[],
    input?: ApproveExpenseInput,
  ): Promise<BulkApprovalResult>;

  bulkRejectByReference(
    authUser: IAuthUser,
    expenseReferences: string[],
    input: RejectExpenseInput,
  ): Promise<BulkApprovalResult>;
}
