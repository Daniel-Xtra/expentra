export const OUTBOX_RELAY_QUEUE = 'outbox-relay';
export const DOMAIN_EVENT_QUEUE = 'domain-events';

export const DOMAIN_EVENT_MAX_ATTEMPTS = 5;

/** Reclaim rows dispatched but not processed within this window. */
export const OUTBOX_STUCK_DISPATCHED_MINUTES = 5;
