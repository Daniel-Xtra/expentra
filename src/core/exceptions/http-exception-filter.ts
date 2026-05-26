import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { errorRequestResponse } from 'src/core/utils/helper';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let errors: unknown = null;

    if (isHttpException) {
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const res = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          errors = res.message;
        } else {
          message =
            typeof res.message === 'string'
              ? res.message
              : typeof res.error === 'string'
                ? res.error
                : 'Error';
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse = errorRequestResponse(message, status, errors);

    const logMessage = `${request.method} ${request.url} ${status} - ${message}`;

    if (status >= 500) {
      this.logger.error(logMessage, (exception as Error)?.stack);
    } else {
      this.logger.warn(logMessage);
    }

    response.status(status).json(errorResponse);
  }
}
