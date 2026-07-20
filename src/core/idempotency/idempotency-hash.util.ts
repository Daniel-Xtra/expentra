import * as crypto from 'crypto';

function stableStringify(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  const record = value as Record<string, unknown>;
  const sorted = Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = record[key];
      return acc;
    }, {});

  return JSON.stringify(sorted);
}

export function hashRequestBody(body: unknown): string {
  return crypto
    .createHash('sha256')
    .update(stableStringify(body))
    .digest('hex');
}

export function buildIdempotencyStorageKey(
  idempotencyKey: string,
  body: unknown,
): string {
  return `${idempotencyKey}:${hashRequestBody(body)}`;
}
