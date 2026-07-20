/** Normalizes expense amount from entity (number or pg bigint string). */
export function parseAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  return 0;
}
