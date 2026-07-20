import { Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEventHandlerRegistry } from 'src/core/outbox/services/domain-event-handler.registry';
import { ApprovalEscalationListener } from '../listeners/approval-escalation.listener';

@Injectable()
export class ApprovalDomainEventRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: DomainEventHandlerRegistry,
    private readonly approvalEscalationListener: ApprovalEscalationListener,
  ) {}

  onModuleInit(): void {
    this.registry.register('expense.submitted', (payload) => [
      {
        name: 'escalation',
        run: () =>
          this.approvalEscalationListener.onExpenseSubmitted(payload as never),
      },
    ]);
  }
}
