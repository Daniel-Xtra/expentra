import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import type { PolicyFieldParamDefinition } from 'src/database/entities/policy-condition-field.entity';
import type { PolicyCondition } from '../../types/policy.types';
import type { IPolicyFieldResolver } from './policy-field-resolver.interface';
import {
  AmountFieldResolver,
  AttachmentCountFieldResolver,
  CategoryFieldResolver,
  DuplicateExpenseFieldResolver,
  MonthlyCategorySpendFieldResolver,
  SubmittedDayFieldResolver,
} from './policy-field-resolvers';

export type PolicyFieldDefinition = {
  key: string;
  label: string;
  description: string;
  valueType: IPolicyFieldResolver['valueType'];
  operators: string[];
  paramDefinitions: PolicyFieldParamDefinition[];
};

@Injectable()
export class PolicyFieldResolverRegistry implements OnModuleInit {
  private readonly resolvers = new Map<string, IPolicyFieldResolver>();

  constructor(
    amount: AmountFieldResolver,
    category: CategoryFieldResolver,
    attachmentCount: AttachmentCountFieldResolver,
    submittedDay: SubmittedDayFieldResolver,
    monthlyCategorySpend: MonthlyCategorySpendFieldResolver,
    duplicateExpense: DuplicateExpenseFieldResolver,
  ) {
    for (const resolver of [
      amount,
      category,
      attachmentCount,
      submittedDay,
      monthlyCategorySpend,
      duplicateExpense,
    ]) {
      this.resolvers.set(resolver.key, resolver);
    }
  }

  onModuleInit(): void {
    for (const key of this.resolvers.keys()) {
      // Registry is fully wired at construction; hook reserved for future validation.
    }
  }

  get(key: string): IPolicyFieldResolver | undefined {
    return this.resolvers.get(key);
  }

  getSupportedKeys(): string[] {
    return [...this.resolvers.keys()];
  }

  validateCondition(condition: PolicyCondition, index: number): void {
    const resolver = this.get(condition.field);
    if (!resolver) {
      throw new BadRequestException(
        `Condition ${index + 1} uses unsupported field "${condition.field}"`,
      );
    }

    if (!resolver.operators.includes(condition.operator)) {
      throw new BadRequestException(
        `Condition ${index + 1} operator "${condition.operator}" is invalid for ${condition.field}`,
      );
    }

    resolver.validateCondition(condition, index);
  }

  describeCondition(condition: PolicyCondition): string {
    return this.get(condition.field)?.describe(condition) ?? condition.field;
  }

  getFieldDefinitions(): PolicyFieldDefinition[] {
    return [
      {
        key: 'amount',
        label: 'Expense amount',
        description: 'The amount of this expense claim.',
        valueType: 'naira',
        operators: [...this.resolvers.get('amount')!.operators],
        paramDefinitions: [],
      },
      {
        key: 'category',
        label: 'Expense category',
        description: 'The category selected on the expense.',
        valueType: 'category',
        operators: [...this.resolvers.get('category')!.operators],
        paramDefinitions: [],
      },
      {
        key: 'attachment_count',
        label: 'Receipt count',
        description: 'How many receipts are attached to the expense.',
        valueType: 'number',
        operators: [...this.resolvers.get('attachment_count')!.operators],
        paramDefinitions: [],
      },
      {
        key: 'submitted_day_of_week',
        label: 'Submitted day',
        description: 'Day of week when the expense is submitted.',
        valueType: 'weekdays',
        operators: [...this.resolvers.get('submitted_day_of_week')!.operators],
        paramDefinitions: [],
      },
      {
        key: 'monthly_category_spend',
        label: 'Monthly category spend',
        description:
          'Total submitted spend in a category for the current month, including this claim. Only applies when the expense uses that category.',
        valueType: 'naira',
        operators: [...this.resolvers.get('monthly_category_spend')!.operators],
        paramDefinitions: [
          {
            key: 'category',
            label: 'Spend category',
            type: 'category',
            required: true,
          },
        ],
      },
      {
        key: 'has_duplicate_expense',
        label: 'Duplicate expense',
        description: 'Whether a similar expense exists within a recent window.',
        valueType: 'boolean',
        operators: [...this.resolvers.get('has_duplicate_expense')!.operators],
        paramDefinitions: [
          {
            key: 'windowDays',
            label: 'Lookback window (days)',
            type: 'number',
            required: true,
          },
        ],
      },
    ];
  }
}
