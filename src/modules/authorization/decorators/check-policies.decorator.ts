import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from '../ability/app-ability';

export const POLICIES_KEY = 'policies';

/** Route handlers use `ability.can(action, resource)`. Pass an expense entity for instance checks. */
export type PolicyHandler = (ability: AppAbility) => boolean;

export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(POLICIES_KEY, handlers);
