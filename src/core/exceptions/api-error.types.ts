export const ApiErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  POLICY_REQUIRED: 'POLICY_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCodeValue =
  (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export type ApiFieldError = {
  field: string;
  message: string;
};

export type ApiErrorBody = {
  code: ApiErrorCodeValue;
  message: string;
  errors?: ApiFieldError[];
  details?: unknown;
};
