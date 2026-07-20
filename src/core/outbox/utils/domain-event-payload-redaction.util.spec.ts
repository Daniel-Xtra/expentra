import { redactProcessedDomainEventPayload } from './domain-event-payload-redaction.util';

describe('redactProcessedDomainEventPayload', () => {
  it('redacts password reset tokens after processing', () => {
    expect(
      redactProcessedDomainEventPayload('auth.password-reset', {
        userId: 1,
        email: 'user@example.com',
        resetToken: '123456',
      }),
    ).toEqual({
      userId: 1,
      email: 'user@example.com',
      resetToken: '[redacted]',
    });
  });

  it('redacts email verification tokens after processing', () => {
    expect(
      redactProcessedDomainEventPayload('auth.email-verification', {
        userId: 1,
        email: 'user@example.com',
        verifyToken: '654321',
      }),
    ).toEqual({
      userId: 1,
      email: 'user@example.com',
      verifyToken: '[redacted]',
    });
  });

  it('leaves non-sensitive events unchanged', () => {
    expect(
      redactProcessedDomainEventPayload('expense.submitted', {
        expenseId: 10,
      }),
    ).toBeUndefined();
  });
});
