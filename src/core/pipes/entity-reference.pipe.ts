import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import {
  isEntityReference,
  normalizeEntityReference,
} from 'src/database/helpers/entity-reference.util';

@Injectable()
export class EntityReferencePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException('Valid reference is required');
    }
    const normalized = normalizeEntityReference(value);
    if (!isEntityReference(normalized)) {
      throw new BadRequestException('Valid reference is required');
    }
    return normalized;
  }
}
