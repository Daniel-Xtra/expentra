import type { DepartmentManagerHistory } from 'src/database/entities/department-manager-history.entity';
import type { User } from 'src/database/entities/user.entity';
import type {
  DepartmentManagerHistoryResponse,
  DepartmentManagerHistoryUserRef,
} from '../types/department-manager-history-response.types';

function toUserRef(user?: User | null): DepartmentManagerHistoryUserRef | null {
  if (!user) {
    return null;
  }

  return {
    reference: user.reference,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export function toDepartmentManagerHistoryResponse(
  entry: DepartmentManagerHistory,
): DepartmentManagerHistoryResponse {
  return {
    reference: entry.reference,
    manager: toUserRef(entry.manager),
    assignedBy: toUserRef(entry.assignedBy),
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt ? entry.endedAt.toISOString() : null,
    isCurrent: entry.endedAt == null,
  };
}
