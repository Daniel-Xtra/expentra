const SENSITIVE_NOTIFICATION_KEYS = new Set([
  'verifyToken',
  'otpCode',
  'resetToken',
  'token',
  'password',
  'accessToken',
  'refreshToken',
  'contentBase64',
  'attachments',
]);

export function sanitizeNotificationPayload(
  data?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SENSITIVE_NOTIFICATION_KEYS.has(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
