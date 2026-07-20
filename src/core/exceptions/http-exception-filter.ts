import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  CORRELATION_ID_KEY,
  type RequestWithCorrelationId,
} from '../middleware/correlation-id.middleware';
import { errorRequestResponse } from 'src/core/utils/helper';
import { httpStatusToErrorCode } from './api.exception';
import { ApiErrorCode, type ApiErrorBody } from './api-error.types';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithCorrelationId>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let code = httpStatusToErrorCode(status);
    let errors: ApiErrorBody['errors'];
    let details: unknown;

    if (isHttpException) {
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const res = exceptionResponse as Record<string, unknown>;

        if (typeof res.code === 'string') {
          code = res.code as typeof code;
        }

        if (Array.isArray(res.errors)) {
          errors = res.errors as ApiErrorBody['errors'];
        }

        if (res.details !== undefined) {
          details = res.details;
        }

        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          code = ApiErrorCode.VALIDATION_FAILED;
          errors =
            errors ??
            res.message.map((entry, index) => ({
              field: `field_${index}`,
              message: String(entry),
            }));
        } else if (typeof res.message === 'string') {
          message = res.message;
        } else if (typeof res.error === 'string') {
          message = res.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = ApiErrorCode.INTERNAL_ERROR;
    }

    if (status >= 500) {
      message = 'Internal server error';
      code = ApiErrorCode.INTERNAL_ERROR;
      details = undefined;
      errors = undefined;
    }

    const errorResponse = errorRequestResponse(message, status, {
      code,
      ...(details !== undefined ? { data: details } : {}),
      ...(errors?.length ? { errors } : {}),
    });

    const correlationId = request[CORRELATION_ID_KEY];
    const correlationSuffix = correlationId ? ` [${correlationId}]` : '';
    const logMessage = `${request.method} ${request.url} ${status} - ${message}${correlationSuffix}`;

    if (status >= 500) {
      this.logger.error(logMessage, (exception as Error)?.stack);
    } else {
      this.logger.warn(logMessage);
    }

    response.status(status).json(errorResponse);
  }
}
