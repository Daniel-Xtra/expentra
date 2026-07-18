/** Serializes an optional date for generated export rows. */
export function toExportIsoDate(value: unknown): string | null {
  if (!(value instanceof Date)) {
    return null;
  }
  return value.toISOString();
}
