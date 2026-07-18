import {
  HttpException,
  HttpStatus,
  type ValidationError,
} from '@nestjs/common';
import {
  ApiErrorCode,
  type ApiErrorBody,
  type ApiErrorCodeValue,
  type ApiFieldError,
} from './api-error.types';

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ApiErrorCodeValue,
    message: string,
    options?: { errors?: ApiFieldError[]; details?: unknown },
  ) {
    const body: ApiErrorBody = {
      code,
      message,
      ...(options?.errors?.length ? { errors: options.errors } : {}),
      ...(options?.details !== undefined ? { details: options.details } : {}),
    };
    super(body, status);
  }
}

export function mapValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ApiFieldError[] {
  const fieldErrors: ApiFieldError[] = [];

  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        fieldErrors.push({ field, message });
      }
    }

    if (error.children?.length) {
      fieldErrors.push(...mapValidationErrors(error.children, field));
    }
  }

  return fieldErrors;
}

export function validationException(errors: ValidationError[]): ApiException {
  const fieldErrors = mapValidationErrors(errors);
  const message =
    fieldErrors[0]?.message ?? 'One or more fields failed validation';

  return new ApiException(
    HttpStatus.BAD_REQUEST,
    ApiErrorCode.VALIDATION_FAILED,
    message,
    {
      errors: fieldErrors,
    },
  );
}

export function httpStatusToErrorCode(status: number): ApiErrorCodeValue {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ApiErrorCode.BAD_REQUEST;
    case HttpStatus.UNAUTHORIZED:
      return ApiErrorCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ApiErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ApiErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ApiErrorCode.CONFLICT;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ApiErrorCode.TOO_MANY_REQUESTS;
    default:
      return status >= 500
        ? ApiErrorCode.INTERNAL_ERROR
        : ApiErrorCode.BAD_REQUEST;
  }
}
