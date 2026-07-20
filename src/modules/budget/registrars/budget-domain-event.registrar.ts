import { Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEventHandlerRegistry } from 'src/core/outbox/services/domain-event-handler.registry';
import { EXPENSE_BUDGET_COMMITTED_EVENT } from 'src/modules/expense/events/expense-budget.events';
import { ExpenseBudgetImpactListener } from '../listeners/expense-budget-impact.listener';

@Injectable()
export class BudgetDomainEventRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: DomainEventHandlerRegistry,
    private readonly expenseBudgetImpactListener: ExpenseBudgetImpactListener,
  ) {}

  onModuleInit(): void {
    this.registry.register(EXPENSE_BUDGET_COMMITTED_EVENT, (payload) => [
      {
        name: 'budget-impact',
        run: () =>
          this.expenseBudgetImpactListener.onExpenseBudgetCommitted(
            payload as never,
          ),
      },
    ]);
  }
}
