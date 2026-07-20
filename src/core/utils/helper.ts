import { BadRequestException } from '@nestjs/common';

export function parsePositiveIntId(id: string | number, label = 'id'): number {
  const parsed =
    typeof id === 'number' ? id : Number.parseInt(String(id).trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`Valid ${label} is required`);
  }
  return parsed;
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/** PostgreSQL ILIKE term with ESCAPE '\\' — use with escapeLikePattern(). */
export function ilikeTerm(search: string): string {
  return `%${escapeLikePattern(search)}%`;
}

export function parseOptionalBooleanQuery(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
    return undefined;
  }
  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  return undefined;
}

export function parseBooleanInput(value: unknown): boolean | undefined {
  return parseOptionalBooleanQuery(value);
}

export interface IResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  code?: string;
  data?: T;
  meta?: unknown;
  errors?: Array<{ field: string; message: string }>;
}

export function hasPayload(value: unknown): boolean {
  return value !== undefined && value !== null;
}

export function successRequestResponse<T>(
  message: string,
  data?: T,
  meta?: unknown,
): IResponse<T> {
  return {
    success: true,
    statusCode: 200,
    message,
    ...(hasPayload(data) ? { data } : {}),
    ...(hasPayload(meta) ? { meta } : {}),
  };
}

export function errorRequestResponse(
  message: string,
  statusCode: number,
  options?: {
    code?: string;
    data?: unknown;
    errors?: Array<{ field: string; message: string }>;
  },
): IResponse {
  const code = options?.code;
  const data = options?.data;
  const errors = options?.errors;

  return {
    success: false,
    statusCode,
    message,
    ...(code ? { code } : {}),
    ...(hasPayload(data) ? { data } : {}),
    ...(errors?.length ? { errors } : {}),
  };
}
