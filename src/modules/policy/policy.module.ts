import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from 'src/database/entities/expense.entity';
import { ExpensePolicy } from 'src/database/entities/expense-policy.entity';
import { PolicyConditionField } from 'src/database/entities/policy-condition-field.entity';
import { PolicyRuleTemplate } from 'src/database/entities/policy-rule-template.entity';
import { EXPENSE_POLICY_SERVICE } from './contracts/policy.contract';
import { PolicyCatalogController } from './controllers/policy-catalog.controller';
import { PolicyController } from './controllers/policy.controller';
import { ConditionEvaluator } from './engine/condition-evaluator';
import {
  AmountFieldResolver,
  AttachmentCountFieldResolver,
  CategoryFieldResolver,
  DuplicateExpenseFieldResolver,
  MonthlyCategorySpendFieldResolver,
  SubmittedDayFieldResolver,
} from './engine/field-resolvers/policy-field-resolvers';
import { PolicyFieldResolverRegistry } from './engine/field-resolvers/policy-field-resolver.registry';
import { PolicyConfigValidator } from './engine/policy-config.validator';
import { PolicyEvaluationCacheFactory } from './engine/policy-evaluation.cache';
import { PolicyEngineService } from './engine/policy-engine.service';
import { ExpensePolicyService } from './services/expense-policy.service';
import { PolicyCatalogService } from './services/policy-catalog.service';

const FIELD_RESOLVERS = [
  AmountFieldResolver,
  CategoryFieldResolver,
  AttachmentCountFieldResolver,
  SubmittedDayFieldResolver,
  MonthlyCategorySpendFieldResolver,
  DuplicateExpenseFieldResolver,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpensePolicy,
      Expense,
      PolicyConditionField,
      PolicyRuleTemplate,
    ]),
  ],
  // Catalog controller must register before PolicyController so GET /policies/catalog
  // is not captured by GET /policies/:reference.
  controllers: [PolicyCatalogController, PolicyController],
  providers: [
    ...FIELD_RESOLVERS,
    PolicyFieldResolverRegistry,
    PolicyConfigValidator,
    ConditionEvaluator,
    PolicyEvaluationCacheFactory,
    PolicyEngineService,
    PolicyCatalogService,
    ExpensePolicyService,
    { provide: EXPENSE_POLICY_SERVICE, useExisting: ExpensePolicyService },
  ],
  exports: [ExpensePolicyService, EXPENSE_POLICY_SERVICE, PolicyCatalogService],
})
export class PolicyModule {}
