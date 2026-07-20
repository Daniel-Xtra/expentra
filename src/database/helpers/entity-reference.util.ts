import { randomBytes } from 'crypto';
import type { EntityReferencePrefix } from '../constants/entity-reference-prefix';
import {
  ENTITY_REFERENCE_MAX_LENGTH,
  ENTITY_REFERENCE_PATTERN,
  ENTITY_REFERENCE_SUFFIX_ALPHABET,
  ENTITY_REFERENCE_SUFFIX_LENGTH,
} from '../constants/entity-reference-prefix';

function randomSuffix(length = ENTITY_REFERENCE_SUFFIX_LENGTH): string {
  const alphabet = ENTITY_REFERENCE_SUFFIX_ALPHABET;
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export function generateEntityReference(prefix: EntityReferencePrefix): string {
  const timestamp = Date.now().toString();
  return `${prefix.toUpperCase()}${timestamp}${randomSuffix()}`;
}

export function normalizeEntityReference(value: string): string {
  return value.trim().toUpperCase();
}

export function isEntityReference(value: string): boolean {
  const normalized = normalizeEntityReference(value);
  return (
    normalized.length === ENTITY_REFERENCE_MAX_LENGTH &&
    ENTITY_REFERENCE_PATTERN.test(normalized)
  );
}

export function assertEntityReference(
  value: string,
  label = 'reference',
): string {
  const normalized = normalizeEntityReference(value);
  if (!isEntityReference(normalized)) {
    throw new Error(`Invalid ${label}`);
  }
  return normalized;
}

export function assignEntityReference(
  entity: { reference?: string },
  prefix: EntityReferencePrefix,
): void {
  if (!entity.reference) {
    entity.reference = generateEntityReference(prefix);
  }
}

export function parseEntityReferencePrefix(
  reference: string,
): EntityReferencePrefix | null {
  const normalized = reference.trim();
  if (!isEntityReference(normalized)) {
    return null;
  }
  return normalized.slice(0, 3).toLowerCase() as EntityReferencePrefix;
}
