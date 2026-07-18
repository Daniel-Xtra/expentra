export function formatCorrelationLogSuffix(correlationId?: string): string {
  return correlationId ? ` [${correlationId}]` : '';
}
