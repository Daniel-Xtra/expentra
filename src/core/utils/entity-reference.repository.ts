import { NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import {
  isEntityReference,
  normalizeEntityReference,
} from 'src/database/helpers/entity-reference.util';

export async function findEntityByReference<
  T extends ObjectLiteral & { reference: string },
>(
  repository: Repository<T>,
  reference: string,
  notFoundMessage = 'Resource not found',
): Promise<T> {
  const normalized = normalizeEntityReference(reference);
  if (!isEntityReference(normalized)) {
    throw new NotFoundException(notFoundMessage);
  }

  const entity = await repository.findOne({
    where: { reference: normalized } as never,
  });
  if (!entity) {
    throw new NotFoundException(notFoundMessage);
  }
  return entity;
}
