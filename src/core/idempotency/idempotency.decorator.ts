import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_METADATA_KEY = 'idempotency:enabled';

export const Idempotent = () => SetMetadata(IDEMPOTENT_METADATA_KEY, true);
