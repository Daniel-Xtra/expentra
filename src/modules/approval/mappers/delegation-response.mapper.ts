import type { ApprovalDelegation } from 'src/database/entities/approval-delegation.entity';
import type { User } from 'src/database/entities/user.entity';
import type {
  DelegationPersonResponse,
  DelegationResponse,
} from '../types/delegation.types';

function toDelegationPerson(user: User): DelegationPersonResponse {
  return {
    reference: user.reference,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export function toDelegationResponse(
  delegation: ApprovalDelegation,
): DelegationResponse {
  return {
    reference: delegation.reference,
    delegatorReference: delegation.delegator.reference,
    delegateReference: delegation.delegate.reference,
    delegator: toDelegationPerson(delegation.delegator),
    delegate: toDelegationPerson(delegation.delegate),
    startsAt: delegation.startsAt,
    endsAt: delegation.endsAt,
    isActive: delegation.isActive,
    createdAt: delegation.createdAt,
  };
}
