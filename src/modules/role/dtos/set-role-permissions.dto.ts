import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { IsEntityReference } from 'src/core/validators/is-entity-reference.validator';

function toPermissionReferenceList(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  const items = Array.isArray(value) ? value : [value];

  return items.map((item) => {
    if (typeof item === 'string') {
      return item;
    }

    if (item && typeof item === 'object' && 'reference' in item) {
      const reference = (item as { reference: unknown }).reference;
      return typeof reference === 'string' ? reference : reference;
    }

    return item;
  });
}

export class SetRolePermissionsDto {
  @Transform(({ value, obj }) =>
    toPermissionReferenceList(
      value ??
        (obj as Record<string, unknown>).permissionUniqueIdentifiers ??
        (obj as Record<string, unknown>).references,
    ),
  )
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsEntityReference({ each: true })
  permissionReferences: string[];
}
