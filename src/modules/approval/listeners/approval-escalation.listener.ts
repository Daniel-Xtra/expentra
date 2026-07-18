import { Injectable } from '@nestjs/common';
import type { ExpenseSubmittedEvent } from 'src/modules/notification/types/notification-events.types';
import { ApprovalEscalationService } from '../services/approval-escalation.service';

@Injectable()
export class ApprovalEscalationListener {
  constructor(private readonly escalationService: ApprovalEscalationService) {}

  async onExpenseSubmitted(payload: ExpenseSubmittedEvent): Promise<void> {
    await this.escalationService.scheduleForExpense(payload.expenseId);
  }
}
