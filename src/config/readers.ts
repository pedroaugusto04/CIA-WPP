import { ApplicationError, ErrorCode } from '../errors/application-error.js';
export type Environment = Record<string, string | undefined>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ApplicationError(ErrorCode.CONFIGURATION_INVALID, `Configure ${name} no ambiente.`);
  }

  return value;
}

export function integer(env: Environment, name: string, max = Number.MAX_SAFE_INTEGER): number {
  const value = Number(required(env, name));
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      `${name} deve ser um inteiro entre 1 e ${max}.`,
    );
  }

  return value;
}

export function stringList(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isNonEmptyString)) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      `${name} deve ser um array de strings não vazias.`,
    );
  }
  return value;
}
