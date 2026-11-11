export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;
export const INPUT_LOCALE = 'pt-BR';
export const MAX_TCP_PORT = 65535;

export const FileSystem = {
  NOT_FOUND: 'ENOENT',
  PRIVATE_DIRECTORY_MODE: 0o700,
  PRIVATE_FILE_MODE: 0o600,
  EXCLUSIVE_WRITE_FLAG: 'wx',
} as const;

export const MILLISECONDS_PER_SECOND = 1000;
export const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
export const MIN_SESSION_HASH_SECRET_LENGTH = 32;
