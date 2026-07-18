import { ValidationPipe } from '@nestjs/common';
import { validationException } from '../exceptions/api.exception';

export function createValidationConfig(): ValidationPipe {
  const isProduction = process.env.NODE_ENV === 'production';

  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: isProduction,
    disableErrorMessages: isProduction,
    skipMissingProperties: false,
    skipNullProperties: false,
    skipUndefinedProperties: false,
    stopAtFirstError: false,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors) => validationException(errors),
  });
}
