import type { ExpenseComment } from 'src/database/entities/expense-comment.entity';
import type { ExpenseActivityItem } from '../services/expense-comment.service';
import type { ExpensePolicyExceptionItem } from '../services/expense-comment.service';
import { formatExpenseActivityLabel } from '../utils/expense-activity-label.util';

export function toExpenseCommentResponse(comment: ExpenseComment) {
  return {
    reference: comment.reference,
    body: comment.body,
    author: comment.user
      ? {
          reference: comment.user.reference,
          email: comment.user.email,
          firstName: comment.user.firstName,
          lastName: comment.user.lastName,
        }
      : null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

export function toExpensePolicyExceptionResponse(
  item: ExpensePolicyExceptionItem,
) {
  return {
    reference: item.reference,
    policyReference: item.policyReference,
    policyName: item.policyName,
    justification: item.justification,
    createdAt: item.createdAt,
    author: item.author,
  };
}

export function toExpenseActivityResponse(item: ExpenseActivityItem) {
  const label = formatExpenseActivityLabel(item);

  return {
    type: item.type,
    label,
    summary: item.summary,
    occurredAt: item.occurredAt,
    actor: item.actor ?? null,
    metadata: item.metadata ?? null,
  };
}
