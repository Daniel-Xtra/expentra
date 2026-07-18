import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { ExpensePolicySeverity } from 'src/database/entities/expense-policy.enums';
import type {
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  PolicyViolation,
} from '../types/policy.types';
import { ConditionEvaluator } from './condition-evaluator';
import { PolicyConfigValidator } from './policy-config.validator';
import {
  PolicyEvaluationCache,
  PolicyEvaluationCacheFactory,
} from './policy-evaluation.cache';

@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);
  private activePoliciesCache: ExpensePolicy[] | null = null;
  private activePoliciesCachedAt = 0;
  private readonly activePoliciesCacheTtlMs = 30_000;

  constructor(
    @InjectRepository(ExpensePolicy)
    private readonly policyRepository: Repository<ExpensePolicy>,
    private readonly configValidator: PolicyConfigValidator,
    private readonly conditionEvaluator: ConditionEvaluator,
    private readonly cacheFactory: PolicyEvaluationCacheFactory,
  ) {}

  async evaluate(
    context: PolicyEvaluationContext,
  ): Promise<PolicyEvaluationResult> {
    const policies = await this.loadActivePolicies();

    const cache = this.cacheFactory.create(context);
    const violations: PolicyViolation[] = [];

    for (const policy of policies) {
      const violation = await this.evaluatePolicy(policy, context, cache);
      if (violation) {
        violations.push(violation);
      }
    }

    return this.partitionViolations(violations);
  }

  async assertCompliant(
    context: PolicyEvaluationContext,
  ): Promise<PolicyEvaluationResult> {
    const result = await this.evaluate(context);

    for (const violation of result.blockingViolations) {
      throw new BadRequestException(violation.message);
    }

    for (const violation of result.warningViolations) {
      const justification =
        context.policyJustifications?.[violation.policyReference]?.trim();
      if (!justification) {
        throw new BadRequestException(
          `${violation.message} Provide a justification to proceed.`,
        );
      }
    }

    return result;
  }

  validatePolicyConfig(
    policy: Pick<ExpensePolicy, 'ruleType' | 'config'>,
  ): void {
    this.configValidator.normalizeRuleConfig(policy.ruleType, policy.config);
    this.invalidateActivePoliciesCache();
  }

  invalidateActivePoliciesCache(): void {
    this.activePoliciesCache = null;
    this.activePoliciesCachedAt = 0;
  }

  private async loadActivePolicies(): Promise<ExpensePolicy[]> {
    const now = Date.now();
    if (
      this.activePoliciesCache &&
      now - this.activePoliciesCachedAt < this.activePoliciesCacheTtlMs
    ) {
      return this.activePoliciesCache;
    }

    const policies = await this.policyRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    this.activePoliciesCache = policies;
    this.activePoliciesCachedAt = now;
    return policies;
  }

  private async evaluatePolicy(
    policy: ExpensePolicy,
    context: PolicyEvaluationContext,
    cache: PolicyEvaluationCache,
  ): Promise<PolicyViolation | null> {
    try {
      const normalized = this.configValidator.normalizeRuleConfig(
        policy.ruleType,
        policy.config,
      );

      const violated = await this.conditionEvaluator.isViolated(
        normalized,
        context,
        cache,
        {
          treatUnknownFieldsAsViolated:
            policy.severity === ExpensePolicySeverity.BLOCK,
        },
      );

      if (!violated) {
        return null;
      }

      return this.toViolation(
        policy,
        this.resolveMessage(policy.config, normalized),
      );
    } catch (error) {
      this.logger.error(
        `Skipping misconfigured policy ${policy.reference}: ${(error as Error).message}`,
      );
      if (policy.severity === ExpensePolicySeverity.BLOCK) {
        return this.toViolation(
          policy,
          'Policy configuration is invalid. Contact an administrator.',
        );
      }
      return null;
    }
  }

  private resolveMessage(
    rawConfig: Record<string, unknown>,
    normalized: Parameters<ConditionEvaluator['buildDefaultMessage']>[0],
  ): string {
    const custom =
      typeof rawConfig.message === 'string' ? rawConfig.message.trim() : '';

    return custom || this.conditionEvaluator.buildDefaultMessage(normalized);
  }

  private toViolation(policy: ExpensePolicy, message: string): PolicyViolation {
    return {
      policyReference: policy.reference,
      policyName: policy.name,
      ruleType: policy.ruleType,
      severity: policy.severity,
      message,
    };
  }

  private partitionViolations(
    violations: PolicyViolation[],
  ): PolicyEvaluationResult {
    const blockingViolations = violations.filter(
      (violation) => violation.severity === ExpensePolicySeverity.BLOCK,
    );
    const warningViolations = violations.filter(
      (violation) => violation.severity === ExpensePolicySeverity.WARN,
    );

    return { violations, blockingViolations, warningViolations };
  }
}
