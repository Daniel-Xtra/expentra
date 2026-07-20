import type { PolicyFieldParamDefinition } from 'src/database/entities/policy-condition-field.entity';
import type { PolicyFieldValueType } from 'src/database/entities/policy-condition-field.entity';
import type {
  PolicyRuleTemplateCondition,
  PolicyRuleTemplateMatch,
} from 'src/database/entities/policy-rule-template.entity';

export type PolicyCatalogFieldResponse = {
  reference: string;
  key: string;
  label: string;
  description: string;
  valueType: PolicyFieldValueType;
  operators: string[];
  paramDefinitions: PolicyFieldParamDefinition[];
  isActive: boolean;
  sortOrder: number;
};

export type PolicyTemplateCondition = PolicyRuleTemplateCondition;

export type PolicyCatalogTemplateResponse = {
  reference: string;
  name: string;
  description: string;
  match: PolicyRuleTemplateMatch;
  conditions: PolicyTemplateCondition[];
  isActive: boolean;
  sortOrder: number;
};

export type PolicyCatalogResponse = {
  fields: PolicyCatalogFieldResponse[];
  templates: PolicyCatalogTemplateResponse[];
  fieldDefinitions: PolicyCatalogFieldResponse[];
  operators: Array<{ value: string; label: string }>;
  categories: string[];
  weekdays: Array<{ value: number; label: string }>;
  supportedFieldKeys: string[];
};

export type UpdatePolicyConditionFieldInput = {
  label?: string;
  description?: string;
  operators?: string[];
  paramDefinitions?: PolicyFieldParamDefinition[];
  isActive?: boolean;
  sortOrder?: number;
};

export type CreatePolicyConditionFieldInput = {
  key: string;
  label: string;
  description: string;
  operators?: string[];
  paramDefinitions?: PolicyFieldParamDefinition[];
  isActive?: boolean;
  sortOrder?: number;
};

export type CreatePolicyRuleTemplateInput = {
  name: string;
  description: string;
  match: 'all' | 'any';
  conditions: PolicyTemplateCondition[];
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdatePolicyRuleTemplateInput =
  Partial<CreatePolicyRuleTemplateInput>;
