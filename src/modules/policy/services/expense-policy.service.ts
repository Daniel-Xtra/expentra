import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { findEntityByReference } from 'src/core/utils/entity-reference.repository';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { ExpensePolicyRuleType } from 'src/database/entities/expense-policy.enums';
import type { IExpensePolicyService } from '../contracts/policy.contract';
import { PolicyConfigValidator } from '../engine/policy-config.validator';
import { PolicyEngineService } from '../engine/policy-engine.service';
import type {
  CreateExpensePolicyInput,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  UpdateExpensePolicyInput,
} from '../types/policy.types';

@Injectable()
export class ExpensePolicyService implements IExpensePolicyService {
  constructor(
    @InjectRepository(ExpensePolicy)
    private readonly policyRepository: Repository<ExpensePolicy>,
    private readonly policyEngine: PolicyEngineService,
    private readonly configValidator: PolicyConfigValidator,
  ) {}

  async create(input: CreateExpensePolicyInput): Promise<ExpensePolicy> {
    const ruleType = input.ruleType ?? ExpensePolicyRuleType.CONDITIONAL;
    const config = this.configValidator.normalizeRuleConfig(
      ruleType,
      input.config,
    );

    const policy = this.policyRepository.create({
      name: input.name.trim(),
      ruleType: ExpensePolicyRuleType.CONDITIONAL,
      severity: input.severity,
      config: config as unknown as Record<string, unknown>,
      isActive: input.isActive ?? true,
    });

    return this.policyRepository.save(policy).then((saved) => {
      this.policyEngine.invalidateActivePoliciesCache();
      return saved;
    });
  }

  async findAll(): Promise<ExpensePolicy[]> {
    return this.policyRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(reference: string): Promise<ExpensePolicy> {
    return findEntityByReference(
      this.policyRepository,
      reference,
      'Expense policy not found',
    );
  }

  async update(
    reference: string,
    input: UpdateExpensePolicyInput,
  ): Promise<ExpensePolicy> {
    const policy = await this.findOne(reference);

    if (input.name !== undefined) {
      policy.name = input.name.trim();
    }
    if (input.severity !== undefined) {
      policy.severity = input.severity;
    }
    if (input.config !== undefined) {
      const config = this.configValidator.normalizeRuleConfig(
        policy.ruleType,
        input.config,
      );
      policy.ruleType = ExpensePolicyRuleType.CONDITIONAL;
      policy.config = config;
    }
    if (input.isActive !== undefined) {
      policy.isActive = input.isActive;
    }

    return this.policyRepository.save(policy).then((saved) => {
      this.policyEngine.invalidateActivePoliciesCache();
      return saved;
    });
  }

  async remove(reference: string): Promise<void> {
    const policy = await this.findOne(reference);
    await this.policyRepository.remove(policy);
    this.policyEngine.invalidateActivePoliciesCache();
  }

  evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    return this.policyEngine.evaluate(context);
  }

  assertCompliant(
    context: PolicyEvaluationContext,
  ): Promise<PolicyEvaluationResult> {
    return this.policyEngine.assertCompliant(context);
  }
}
