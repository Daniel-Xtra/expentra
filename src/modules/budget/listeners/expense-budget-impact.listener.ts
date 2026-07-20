import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EXPENSE_BUDGET_COMMITTED_EVENT,
  type ExpenseBudgetCommittedEvent,
} from 'src/modules/expense/events/expense-budget.events';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from '../contracts/budget.contract';
import { BudgetAlertService } from '../services/budget-alert.service';

@Injectable()
export class ExpenseBudgetImpactListener {
  private readonly logger = new Logger(ExpenseBudgetImpactListener.name);

  constructor(
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
    private readonly budgetAlertService: BudgetAlertService,
  ) {}

  async onExpenseBudgetCommitted(
    payload: ExpenseBudgetCommittedEvent,
  ): Promise<void> {
    const year = payload.budgetEvaluation.summary?.year;
    if (!year) {
      return;
    }

    try {
      this.budgetService.emitOverspendIfNeeded(payload.budgetEvaluation, {
        expenseId: payload.expenseId,
        userId: payload.actorUserId,
        departmentId: payload.departmentId,
      });
      await this.budgetAlertService.checkAndEmitThresholdAlerts(
        payload.departmentId,
        year,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed budget impact handling for expense ${payload.expenseId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
