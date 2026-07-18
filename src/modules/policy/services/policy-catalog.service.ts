import { BadRequestException, Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { PolicyConditionField } from 'src/database/entities/policy-condition-field.entity';
import type { PolicyFieldParamDefinition } from 'src/database/entities/policy-condition-field.entity';
import { PolicyRuleTemplate } from 'src/database/entities/policy-rule-template.entity';

import { findEntityByReference } from 'src/core/utils/entity-reference.repository';

import {
  POLICY_EXPENSE_CATEGORIES,
  POLICY_OPERATOR_LABELS,
  POLICY_WEEKDAYS,
} from '../engine/policy.constants';

import { PolicyFieldResolverRegistry } from '../engine/field-resolvers/policy-field-resolver.registry';

import type {
  CreatePolicyConditionFieldInput,
  CreatePolicyRuleTemplateInput,
  PolicyCatalogFieldResponse,
  PolicyCatalogResponse,
  PolicyTemplateCondition,
  UpdatePolicyConditionFieldInput,
  UpdatePolicyRuleTemplateInput,
} from '../types/policy-catalog.types';

@Injectable()
export class PolicyCatalogService {
  constructor(
    @InjectRepository(PolicyConditionField)
    private readonly fieldRepository: Repository<PolicyConditionField>,

    @InjectRepository(PolicyRuleTemplate)
    private readonly templateRepository: Repository<PolicyRuleTemplate>,

    private readonly fieldRegistry: PolicyFieldResolverRegistry,
  ) {}

  async getCatalog(): Promise<PolicyCatalogResponse> {
    const [dbFields, templates] = await Promise.all([
      this.fieldRepository.find({
        where: { isActive: true },

        order: { sortOrder: 'ASC', label: 'ASC' },
      }),

      this.templateRepository.find({
        where: { isActive: true },

        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
    ]);

    const fieldDefinitions = this.getFieldDefinitionsFromEngine();

    return {
      fields: dbFields

        .filter((field) => this.fieldRegistry.get(field.key))

        .map((field) => this.toFieldResponse(field)),

      templates: templates.map((template) => ({
        reference: template.reference,

        name: template.name,

        description: template.description,

        match: template.match,

        conditions: template.conditions,

        isActive: template.isActive,

        sortOrder: template.sortOrder,
      })),

      fieldDefinitions,

      operators: Object.entries(POLICY_OPERATOR_LABELS).map(
        ([value, label]) => ({
          value,

          label,
        }),
      ),

      categories: POLICY_EXPENSE_CATEGORIES,

      weekdays: [...POLICY_WEEKDAYS],

      supportedFieldKeys: this.fieldRegistry.getSupportedKeys(),
    };
  }

  async listAllFields(): Promise<PolicyConditionField[]> {
    return this.fieldRepository.find({
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async createField(
    input: CreatePolicyConditionFieldInput,
  ): Promise<PolicyConditionField> {
    const key = input.key.trim();

    const definition = this.fieldRegistry
      .getFieldDefinitions()
      .find((field) => field.key === key);

    if (!definition) {
      throw new BadRequestException(
        `Field key "${key}" is not supported by the policy engine`,
      );
    }

    const existing = await this.fieldRepository.findOne({ where: { key } });

    if (existing) {
      throw new BadRequestException(
        `A condition field with key "${key}" already exists`,
      );
    }

    const operators = this.resolveOperators(
      definition.operators,
      input.operators,
    );

    const field = this.fieldRepository.create({
      key,

      label: input.label.trim(),

      description: input.description.trim(),

      valueType: definition.valueType,

      operators,

      paramDefinitions: this.resolveParamDefinitions(
        definition.paramDefinitions,

        input.paramDefinitions,
      ),

      isActive: input.isActive ?? true,

      sortOrder: input.sortOrder ?? 0,
    });

    return this.fieldRepository.save(field);
  }

  async updateField(
    reference: string,

    input: UpdatePolicyConditionFieldInput,
  ): Promise<PolicyConditionField> {
    const field = await findEntityByReference(
      this.fieldRepository,

      reference,

      'Policy condition field not found',
    );

    const definition = this.fieldRegistry
      .getFieldDefinitions()
      .find((item) => item.key === field.key);

    if (!definition) {
      throw new BadRequestException(
        'This field is not supported by the policy engine',
      );
    }

    if (input.label !== undefined) {
      field.label = input.label.trim();
    }

    if (input.description !== undefined) {
      field.description = input.description.trim();
    }

    if (input.operators !== undefined) {
      field.operators = this.resolveOperators(
        definition.operators,
        input.operators,
      );
    }

    if (input.isActive !== undefined) {
      field.isActive = input.isActive;
    }

    if (input.sortOrder !== undefined) {
      field.sortOrder = input.sortOrder;
    }

    if (input.paramDefinitions !== undefined) {
      field.paramDefinitions = this.resolveParamDefinitions(
        definition.paramDefinitions,

        input.paramDefinitions,
      );
    }

    return this.fieldRepository.save(field);
  }

  async removeField(reference: string): Promise<void> {
    const field = await findEntityByReference(
      this.fieldRepository,

      reference,

      'Policy condition field not found',
    );

    await this.fieldRepository.remove(field);
  }

  async listAllTemplates(): Promise<PolicyRuleTemplate[]> {
    return this.templateRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async createTemplate(
    input: CreatePolicyRuleTemplateInput,
  ): Promise<PolicyRuleTemplate> {
    this.assertTemplateInput(input);

    const template = this.templateRepository.create({
      name: input.name.trim(),

      description: input.description.trim(),

      match: input.match,

      conditions: input.conditions,

      isActive: input.isActive ?? true,

      sortOrder: input.sortOrder ?? 0,
    });

    return this.templateRepository.save(template);
  }

  async updateTemplate(
    reference: string,

    input: UpdatePolicyRuleTemplateInput,
  ): Promise<PolicyRuleTemplate> {
    const template = await findEntityByReference(
      this.templateRepository,

      reference,

      'Policy rule template not found',
    );

    if (input.name !== undefined) {
      template.name = input.name.trim();
    }

    if (input.description !== undefined) {
      template.description = input.description.trim();
    }

    if (input.match !== undefined) {
      template.match = input.match;
    }

    if (input.conditions !== undefined) {
      template.conditions = input.conditions;
    }

    if (input.isActive !== undefined) {
      template.isActive = input.isActive;
    }

    if (input.sortOrder !== undefined) {
      template.sortOrder = input.sortOrder;
    }

    if (input.match !== undefined || input.conditions !== undefined) {
      this.assertTemplateInput({
        name: template.name,

        description: template.description,

        match: template.match,

        conditions: template.conditions,
      });
    }

    return this.templateRepository.save(template);
  }

  async removeTemplate(reference: string): Promise<void> {
    const template = await findEntityByReference(
      this.templateRepository,

      reference,

      'Policy rule template not found',
    );

    await this.templateRepository.remove(template);
  }

  private getFieldDefinitionsFromEngine(): PolicyCatalogFieldResponse[] {
    return this.fieldRegistry.getFieldDefinitions().map((definition) => ({
      reference: definition.key,

      key: definition.key,

      label: definition.label,

      description: definition.description,

      valueType: definition.valueType,

      operators: definition.operators,

      paramDefinitions: definition.paramDefinitions,

      isActive: true,

      sortOrder: 0,
    }));
  }

  private toFieldResponse(
    field: PolicyConditionField,
  ): PolicyCatalogFieldResponse {
    const definition = this.fieldRegistry
      .getFieldDefinitions()
      .find((item) => item.key === field.key);

    const paramDefinitions =
      field.paramDefinitions && field.paramDefinitions.length > 0
        ? field.paramDefinitions
        : (definition?.paramDefinitions ?? []);

    return {
      reference: field.reference,

      key: field.key,

      label: field.label,

      description: field.description,

      valueType: field.valueType,

      operators: field.operators,

      paramDefinitions,

      isActive: field.isActive,

      sortOrder: field.sortOrder,
    };
  }

  private resolveOperators(
    allowedOperators: string[],

    requested?: string[],
  ): string[] {
    if (!requested || requested.length === 0) {
      return [...allowedOperators];
    }

    const invalid = requested.filter(
      (operator) => !allowedOperators.includes(operator),
    );

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid operators for this field: ${invalid.join(', ')}`,
      );
    }

    return requested;
  }

  private resolveParamDefinitions(
    engineParams: PolicyFieldParamDefinition[],

    requested?: PolicyFieldParamDefinition[],
  ): PolicyFieldParamDefinition[] {
    if (engineParams.length === 0) {
      if (requested && requested.length > 0) {
        throw new BadRequestException(
          'This field does not support parameter configuration',
        );
      }

      return [];
    }

    if (!requested || requested.length === 0) {
      return engineParams.map((param) => ({ ...param }));
    }

    const resolved = engineParams.map((engineParam) => {
      const match = requested.find((param) => param.key === engineParam.key);

      if (!match) {
        throw new BadRequestException(
          `Missing parameter definition for "${engineParam.key}"`,
        );
      }

      if (match.type !== engineParam.type) {
        throw new BadRequestException(
          `Parameter "${engineParam.key}" must use type "${engineParam.type}"`,
        );
      }

      return {
        key: engineParam.key,

        type: engineParam.type,

        label: match.label.trim(),

        required: match.required ?? engineParam.required ?? false,
      };
    });

    const extra = requested.filter(
      (param) =>
        !engineParams.some((engineParam) => engineParam.key === param.key),
    );

    if (extra.length > 0) {
      throw new BadRequestException(
        `Unsupported parameter keys: ${extra.map((param) => param.key).join(', ')}`,
      );
    }

    return resolved;
  }

  private assertTemplateInput(input: {
    name: string;

    description: string;

    match: 'all' | 'any';

    conditions: PolicyTemplateCondition[];
  }): void {
    if (!input.name.trim()) {
      throw new BadRequestException('Template name is required');
    }

    if (!input.description.trim()) {
      throw new BadRequestException('Template description is required');
    }

    if (input.match !== 'all' && input.match !== 'any') {
      throw new BadRequestException('Template match must be "all" or "any"');
    }

    if (!Array.isArray(input.conditions) || input.conditions.length === 0) {
      throw new BadRequestException('Template requires at least one condition');
    }

    for (const [index, condition] of input.conditions.entries()) {
      const field = condition.field;

      if (typeof field !== 'string' || !this.fieldRegistry.get(field)) {
        throw new BadRequestException(
          `Template condition ${index + 1} has an invalid field`,
        );
      }
    }
  }
}
