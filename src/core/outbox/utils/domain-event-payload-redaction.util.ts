const REDACTED_VALUE = '[redacted]';

const SENSITIVE_EVENT_FIELDS: Record<string, readonly string[]> = {
  'auth.email-verification': ['verifyToken'],
  'auth.password-reset': ['resetToken'],
};

export function redactProcessedDomainEventPayload(
  eventType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const fields = SENSITIVE_EVENT_FIELDS[eventType];
  if (!fields?.length) {
    return undefined;
  }

  const redacted = { ...payload };
  let changed = false;

  for (const field of fields) {
    if (field in redacted) {
      redacted[field] = REDACTED_VALUE;
      changed = true;
    }
  }

  return changed ? redacted : undefined;
}
