export function normalizeRoleName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export const ROLE_NAME_VALIDATION_MESSAGE =
  'name must start with a letter and contain only lowercase letters, numbers, and underscores';
