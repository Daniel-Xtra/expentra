import {
  hashRequestBody,
  buildIdempotencyStorageKey,
} from './idempotency-hash.util';

describe('idempotency-hash.util', () => {
  it('hashes equivalent object key order the same way', () => {
    const first = hashRequestBody({ b: 2, a: 1 });
    const second = hashRequestBody({ a: 1, b: 2 });
    expect(first).toBe(second);
  });

  it('builds storage keys from header and body', () => {
    const key = buildIdempotencyStorageKey('client-key-12345678', { id: 1 });
    expect(key.startsWith('client-key-12345678:')).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });
});
