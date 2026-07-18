import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number;
  ttl: number; // in seconds
  resource?: string; // Optional custom resource name for grouping
}

export const RATE_LIMIT_METADATA_KEY = 'rate_limit_options';

/**
 * Decorator to apply rate limiting to a specific endpoint.
 * @param options RateLimitOptions
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);
