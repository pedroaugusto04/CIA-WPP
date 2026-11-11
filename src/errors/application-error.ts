export const ErrorCode = {
  CONFIGURATION_INVALID: 'CONFIGURATION_INVALID',
  JSON_INVALID: 'JSON_INVALID',
  STATE_INVALID: 'STATE_INVALID',
  META_REQUEST_FAILED: 'META_REQUEST_FAILED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ApplicationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApplicationError';
  }
}
