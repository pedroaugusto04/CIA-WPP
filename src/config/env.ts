import path from 'node:path';
import {
  DIGITS_ONLY_PATTERN,
  GRAPH_VERSION_PATTERN,
  UNSUPPORTED_ROUTE_CHARACTERS_PATTERN,
} from '../constants/patterns.js';
import {
  LOG_LEVELS,
  MAX_TCP_PORT,
  MILLISECONDS_PER_SECOND,
  MAX_TIMER_DELAY_MS,
  MIN_SESSION_HASH_SECRET_LENGTH,
} from '../constants/runtime.js';
import type { LogLevel } from '../constants/runtime.js';
import { ApplicationError, ErrorCode } from '../errors/application-error.js';
import type { AttendanceConfig } from '../domain/attendance/types.js';
import { readAttendanceConfig } from './attendance.js';
import { required, integer, stringList } from './readers.js';
import type { Environment } from './readers.js';
import { parseJson } from '../utils/validation.js';

export interface AppConfig {
  host: string;
  port: number;
  logLevel: LogLevel;
  logWebhookPayloadShape: boolean;
  webhookPaths: string[];
  verifyToken: string;
  accessToken: string;
  phoneNumberId: string;
  graphVersion: string;
  requestTimeoutMs: number;
  stateFile: string;
  deduplicationLimit: number;
  sessionTtlMs: number;
  deduplicationTtlMs: number;
  cleanupIntervalMs: number;
  sessionHashSecret: string;
  attendance: AttendanceConfig;
}

function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((level) => level === value);
}

export function loadConfig(env: Environment): AppConfig {
  const graphVersion = required(env, 'META_GRAPH_VERSION');
  if (!GRAPH_VERSION_PATTERN.test(graphVersion)) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      'META_GRAPH_VERSION deve ter o formato v21.0.',
    );
  }

  const phoneNumberId = required(env, 'WHATSAPP_PHONE_NUMBER_ID');
  if (!DIGITS_ONLY_PATTERN.test(phoneNumberId)) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      'WHATSAPP_PHONE_NUMBER_ID deve conter apenas dígitos.',
    );
  }

  const webhookPaths = stringList(
    parseJson(required(env, 'WEBHOOK_PATHS'), 'WEBHOOK_PATHS'),
    'WEBHOOK_PATHS',
  );
  if (
    webhookPaths.some(
      (route) => !route.startsWith('/') || UNSUPPORTED_ROUTE_CHARACTERS_PATTERN.test(route),
    ) ||
    new Set(webhookPaths).size !== webhookPaths.length
  ) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      'WEBHOOK_PATHS deve conter rotas literais distintas iniciadas por /.',
    );
  }
  const logLevel = required(env, 'LOG_LEVEL');
  if (!isLogLevel(logLevel)) {
    throw new ApplicationError(ErrorCode.CONFIGURATION_INVALID, 'LOG_LEVEL inválido.');
  }

  return {
    host: required(env, 'HOST'),
    port: integer(env, 'PORT', MAX_TCP_PORT),
    logLevel,
    logWebhookPayloadShape: env.WEBHOOK_LOG_PAYLOAD_SHAPE?.trim().toLowerCase() === 'true',
    webhookPaths,
    verifyToken: required(env, 'META_VERIFY_TOKEN'),
    accessToken: required(env, 'META_ACCESS_TOKEN'),
    phoneNumberId,
    graphVersion,
    requestTimeoutMs: integer(env, 'META_REQUEST_TIMEOUT_MS', MAX_TIMER_DELAY_MS),
    stateFile: path.resolve(required(env, 'STATE_FILE')),
    deduplicationLimit: integer(env, 'DEDUPLICATION_LIMIT'),
    sessionTtlMs:
      integer(
        env,
        'SESSION_TTL_SECONDS',
        Math.floor(Number.MAX_SAFE_INTEGER / MILLISECONDS_PER_SECOND),
      ) * MILLISECONDS_PER_SECOND,
    deduplicationTtlMs:
      integer(
        env,
        'DEDUPLICATION_TTL_SECONDS',
        Math.floor(Number.MAX_SAFE_INTEGER / MILLISECONDS_PER_SECOND),
      ) * MILLISECONDS_PER_SECOND,
    cleanupIntervalMs:
      integer(
        env,
        'SESSION_CLEANUP_INTERVAL_SECONDS',
        Math.floor(MAX_TIMER_DELAY_MS / MILLISECONDS_PER_SECOND),
      ) * MILLISECONDS_PER_SECOND,
    sessionHashSecret: readHashSecret(env),
    attendance: readAttendanceConfig(env),
  };
}

function readHashSecret(env: Environment): string {
  const secret = required(env, 'SESSION_HASH_SECRET');
  if (secret.length < MIN_SESSION_HASH_SECRET_LENGTH) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      `SESSION_HASH_SECRET deve ter ao menos ${MIN_SESSION_HASH_SECRET_LENGTH} caracteres.`,
    );
  }
  return secret;
}
