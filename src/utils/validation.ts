import { ApplicationError, ErrorCode } from '../errors/application-error.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (cause) {
    throw new ApplicationError(ErrorCode.JSON_INVALID, `${label} deve conter JSON válido.`, {
      cause,
    });
  }
}
