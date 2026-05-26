export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}
export interface IResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: unknown;
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
  data?: unknown,
): IResponse {
  return {
    success: false,
    statusCode,
    message,
    ...(hasPayload(data) ? { data } : {}),
  };
}
