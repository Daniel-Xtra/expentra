import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { BUDGET_RECONCILIATION_QUEUE } from '../constants/budget-reconciliation.constants';
import {
  BUDGET_SERVICE,
  type IBudgetService,
} from '../contracts/budget.contract';

@Processor(BUDGET_RECONCILIATION_QUEUE)
export class BudgetReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(BudgetReconciliationProcessor.name);

  constructor(
    @Inject(BUDGET_SERVICE) private readonly budgetService: IBudgetService,
  ) {
    super();
  }

  async process(): Promise<void> {
    this.logger.log(
      'Starting scheduled budget committed-amount reconciliation',
    );
    await this.budgetService.reconcileAllCommittedAmounts();
    this.logger.log('Budget committed-amount reconciliation completed');
  }

  @OnWorkerEvent('failed')
  onFailed(
    _job: Parameters<WorkerHost['process']>[0] | undefined,
    error: Error,
  ): void {
    this.logger.error(
      `Budget reconciliation job failed after max attempts: ${error.message}`,
    );
  }
}
