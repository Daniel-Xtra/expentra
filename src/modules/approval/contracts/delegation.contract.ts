import type { ApprovalDelegation } from 'src/database/entities/approval-delegation.entity';
import type { ApprovalLevel } from 'src/database/entities/approval-level.entity';
import type { Expense } from 'src/database/entities/expense.entity';
import type { IAuthUser } from 'src/definition';
import type { CreateDelegationInput, ListDelegationsQuery, PaginatedDelegationsResult } from '../types/delegation.types';

export const DELEGATION_SERVICE = Symbol('DELEGATION_SERVICE');

export interface IDelegationService {
  create(
    delegator: IAuthUser,
    input: CreateDelegationInput,
  ): Promise<ApprovalDelegation>;
  findMine(delegatorId: number, query?: ListDelegationsQuery): Promise<PaginatedDelegationsResult>;
  findDelegatedToMe(delegateId: number, query?: ListDelegationsQuery): Promise<PaginatedDelegationsResult>;
  revoke(delegatorId: number, reference: string): Promise<void>;
  canActAsDelegate(
    authUser: IAuthUser,
    expense: Expense,
    stage: ApprovalLevel,
  ): Promise<boolean>;
}
