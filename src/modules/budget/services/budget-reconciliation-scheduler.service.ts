import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BUDGET_RECONCILIATION_QUEUE } from '../constants/budget-reconciliation.constants';

@Injectable()
export class BudgetReconciliationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(
    BudgetReconciliationSchedulerService.name,
  );

  constructor(
    @InjectQueue(BUDGET_RECONCILIATION_QUEUE)
    private readonly reconciliationQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reconciliationQueue.add(
      'reconcile',
      {},
      {
        repeat: { pattern: '0 2 * * *' },
        jobId: 'budget-reconciliation-nightly',
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
    this.logger.log('Budget reconciliation scheduled (daily at 02:00 UTC)');
  }
}
