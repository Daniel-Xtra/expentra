import { SetMetadata } from '@nestjs/common';

export const ALLOW_AUTHENTICATED_KEY = 'allowAuthenticated';

/**
 * Allows any authenticated user without an explicit @CheckPolicies() handler.
 * Use for self-scoped routes (e.g. /users/me) or manager-scoped routes
 * that enforce access in the service layer.
 */
export const AllowAuthenticated = () =>
  SetMetadata(ALLOW_AUTHENTICATED_KEY, true);
