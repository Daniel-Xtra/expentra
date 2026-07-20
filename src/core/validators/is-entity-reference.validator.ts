import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isEntityReference } from 'src/database/helpers/entity-reference.util';

@ValidatorConstraint({ name: 'isEntityReference', async: false })
export class IsEntityReferenceConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    return typeof value === 'string' && isEntityReference(value);
  }

  defaultMessage(): string {
    return 'Valid entity reference is required';
  }
}

export function IsEntityReference(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEntityReferenceConstraint,
    });
  };
}
