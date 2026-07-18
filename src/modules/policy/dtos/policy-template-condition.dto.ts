import { Expose, Transform, Type } from 'class-transformer';
import { IsDefined, IsObject, IsOptional, IsString } from 'class-validator';

export function normalizeTemplateConditionsInput(
  value: unknown,
): PolicyTemplateConditionDto[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTemplateConditionItem(item));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (
      typeof record.field === 'string' &&
      typeof record.operator === 'string'
    ) {
      return [normalizeTemplateConditionItem(record)];
    }

    return Object.values(record).map((item) =>
      normalizeTemplateConditionItem(item),
    );
  }

  return [];
}

function normalizeTemplateConditionItem(
  value: unknown,
): PolicyTemplateConditionDto {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return value as PolicyTemplateConditionDto;
  }

  const raw = value as Record<string, unknown>;
  const condition = new PolicyTemplateConditionDto();
  condition.field =
    typeof raw.field === 'string' ? raw.field : String(raw.field ?? '');
  condition.operator =
    typeof raw.operator === 'string'
      ? raw.operator
      : String(raw.operator ?? '');
  condition.value = raw.value;

  if (
    raw.params !== undefined &&
    raw.params !== null &&
    typeof raw.params === 'object' &&
    !Array.isArray(raw.params)
  ) {
    condition.params = raw.params as Record<string, unknown>;
  }

  return condition;
}

export class PolicyTemplateConditionDto {
  @Expose()
  @IsString()
  field: string;

  @Expose()
  @IsString()
  operator: string;

  @Expose()
  @IsDefined()
  value: unknown;

  @Expose()
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export const TransformTemplateConditions = () =>
  Transform(({ value }) => normalizeTemplateConditionsInput(value), {
    toClassOnly: true,
  });

export const PolicyTemplateConditionsProperty = () =>
  Type(() => PolicyTemplateConditionDto);
