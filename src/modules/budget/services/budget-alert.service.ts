import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEventPublisher } from 'src/core/outbox/services/domain-event.publisher';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BudgetAlertDispatch } from 'src/database/entities/budget-alert-dispatch.entity';
import { Department } from 'src/database/entities/department.entity';
import { DepartmentBudget } from 'src/database/entities/department-budget.entity';
import { BudgetAlertRecipientQueryService } from './budget-alert-recipient-query.service';

@Injectable()
export class BudgetAlertService {
  private readonly logger = new Logger(BudgetAlertService.name);

  constructor(
    @InjectRepository(BudgetAlertDispatch)
    private readonly dispatchRepository: Repository<BudgetAlertDispatch>,
    @InjectRepository(DepartmentBudget)
    private readonly budgetRepository: Repository<DepartmentBudget>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly recipientQuery: BudgetAlertRecipientQueryService,
    private readonly configService: ConfigService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async checkAndEmitThresholdAlerts(
    departmentId: number,
    year: number,
  ): Promise<void> {
    const budget = await this.budgetRepository.findOne({
      where: { departmentId, year, isActive: true },
    });
    if (!budget || budget.amountLimit <= 0) {
      return;
    }

    const utilizationPercent = budget.utilizationPercent;
    const thresholds = this.getThresholdPercents();

    const department = await this.departmentRepository.findOne({
      where: { id: departmentId },
    });
    if (!department) {
      return;
    }

    const [superAdmins, approvalLevelRoleUsers] = await Promise.all([
      this.recipientQuery.findSuperAdminRecipients(),
      this.recipientQuery.findApprovalLevelRoleRecipients(),
    ]);

    const notifyUsers = [...superAdmins, ...approvalLevelRoleUsers].filter(
      (user, index, all) =>
        all.findIndex((item) => item.id === user.id) === index,
    );

    for (const threshold of thresholds) {
      if (utilizationPercent < threshold) {
        continue;
      }

      const alreadySent = await this.dispatchRepository.findOne({
        where: {
          departmentBudgetId: budget.id,
          thresholdPercent: threshold,
        },
      });
      if (alreadySent) {
        continue;
      }

      await this.dispatchRepository.save(
        this.dispatchRepository.create({
          departmentBudgetId: budget.id,
          thresholdPercent: threshold,
        }),
      );

      const projectedUtilizationPercent = utilizationPercent;

      for (const user of notifyUsers) {
        void this.domainEventPublisher.publish('budget.threshold_crossed', {
          userId: user.id,
          departmentReference: department.reference,
          departmentName: department.name,
          thresholdPercent: threshold,
          utilizationPercent: projectedUtilizationPercent,
          year,
        });
      }

      this.logger.log(
        `Budget threshold ${threshold}% crossed for department ${department.reference} (${year})`,
      );
    }
  }

  getForecast(
    amountLimit: number,
    committedAmount: number,
    year: number,
  ): {
    year: number;
    amountLimit: number;
    committedAmount: number;
    utilizationPercent: number;
    monthlyBurnRate: number;
    projectedYearEndCommitted: number;
    projectedOverrun: boolean;
  } {
    const now = new Date();
    const monthIndex = now.getUTCMonth() + 1;
    const monthlyBurnRate =
      monthIndex > 0
        ? Math.round(committedAmount / monthIndex)
        : committedAmount;
    const projectedYearEndCommitted = monthlyBurnRate * 12;
    const utilizationPercent =
      amountLimit > 0
        ? Math.round((committedAmount / amountLimit) * 10000) / 100
        : 0;

    return {
      year,
      amountLimit,
      committedAmount,
      utilizationPercent,
      monthlyBurnRate,
      projectedYearEndCommitted,
      projectedOverrun: projectedYearEndCommitted > amountLimit,
    };
  }

  private getThresholdPercents(): number[] {
    const raw = this.configService.get<string>(
      'BUDGET_ALERT_THRESHOLDS',
      '75,90,100',
    );
    return raw
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= 100)
      .sort((left, right) => left - right);
  }
}
