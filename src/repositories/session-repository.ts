import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from '../config/env.js';
import { HASHED_IDENTIFIER_PATTERN } from '../constants/patterns.js';
import { FileSystem } from '../constants/runtime.js';
import { AttendanceState } from '../domain/attendance/types.js';
import type { Session } from '../domain/attendance/types.js';
import { ApplicationError, ErrorCode } from '../errors/application-error.js';
import { isRecord, parseJson } from '../utils/validation.js';

const STATE_SCHEMA_VERSION = 3;
const MAX_INVALID_ATTEMPTS = 2;

type RepositoryConfig = Pick<
  AppConfig,
  'stateFile' | 'sessionHashSecret' | 'sessionTtlMs' | 'deduplicationTtlMs' | 'deduplicationLimit'
>;

interface StoredState {
  version: typeof STATE_SCHEMA_VERSION;
  sessions: Record<string, Session>;
  processed: Record<string, number>;
}

function validState(value: unknown): value is AttendanceState {
  return Object.values(AttendanceState).some((state) => state === value);
}

function validateState(value: unknown): StoredState {
  if (
    !isRecord(value) ||
    value.version !== STATE_SCHEMA_VERSION ||
    !isRecord(value.sessions) ||
    !isRecord(value.processed)
  ) {
    throw new ApplicationError(
      ErrorCode.STATE_INVALID,
      'Estado incompatível. Configure STATE_FILE para um novo arquivo de sessões.',
    );
  }

  const sessions: Record<string, Session> = {};
  const processed: Record<string, number> = {};
  for (const [key, item] of Object.entries(value.sessions)) {
    const state = isRecord(item) && validState(item.state) ? item.state : undefined;
    const invalidAttempts = isRecord(item) ? item.invalidAttempts : undefined;
    if (
      !HASHED_IDENTIFIER_PATTERN.test(key) ||
      !isRecord(item) ||
      !state ||
      typeof item.updatedAt !== 'number' ||
      !Number.isSafeInteger(item.updatedAt) ||
      item.updatedAt < 0 ||
      typeof invalidAttempts !== 'number' ||
      !Number.isInteger(invalidAttempts) ||
      invalidAttempts < 0 ||
      invalidAttempts > MAX_INVALID_ATTEMPTS
    ) {
      throw new ApplicationError(ErrorCode.STATE_INVALID, 'Sessão inválida no arquivo de estado.');
    }
    sessions[key] = { state, updatedAt: item.updatedAt, invalidAttempts };
  }
  for (const [key, timestamp] of Object.entries(value.processed)) {
    if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 0) {
      throw new ApplicationError(
        ErrorCode.STATE_INVALID,
        'Registro técnico inválido no arquivo de estado.',
      );
    }
    processed[key] = timestamp;
  }
  return { version: STATE_SCHEMA_VERSION, sessions, processed };
}

/** Uma instância por arquivo; operações serializadas pelo serviço. Não guarda respostas. */
export class SessionRepository {
  private state: StoredState = { version: STATE_SCHEMA_VERSION, sessions: {}, processed: {} };

  constructor(private readonly config: RepositoryConfig) {}

  async initialize(): Promise<void> {
    await mkdir(path.dirname(this.config.stateFile), {
      recursive: true,
      mode: FileSystem.PRIVATE_DIRECTORY_MODE,
    });
    try {
      this.state = validateState(
        parseJson(await readFile(this.config.stateFile, 'utf8'), 'Arquivo de sessões'),
      );
    } catch (error) {
      if (!isRecord(error) || error.code !== FileSystem.NOT_FOUND) throw error;
    }
    await this.cleanup();
  }

  private hash(namespace: string, value: string): string {
    return createHmac('sha256', this.config.sessionHashSecret)
      .update(`${namespace}:${value}`)
      .digest('hex');
  }

  hasProcessed(messageId: string, now = Date.now()): boolean {
    const timestamp = this.state.processed[this.hash('message', messageId)];
    return timestamp !== undefined && now - timestamp < this.config.deduplicationTtlMs;
  }

  get(phone: string, now = Date.now()): Session | undefined {
    const session = this.state.sessions[this.hash('session', phone)];
    if (!session || now - session.updatedAt >= this.config.sessionTtlMs) return undefined;
    return { ...session };
  }

  async commit(
    phone: string,
    state: AttendanceState,
    messageId: string,
    now = Date.now(),
    invalidAttempts = 0,
  ): Promise<void> {
    const next = structuredClone(this.state);
    next.sessions[this.hash('session', phone)] = { state, updatedAt: now, invalidAttempts };
    next.processed[this.hash('message', messageId)] = now;
    this.prune(next, now);
    await this.persist(next);
  }

  async cleanup(now = Date.now()): Promise<void> {
    const next = structuredClone(this.state);
    this.prune(next, now);
    await this.persist(next);
  }

  private prune(state: StoredState, now: number): void {
    for (const [key, session] of Object.entries(state.sessions)) {
      if (now - session.updatedAt >= this.config.sessionTtlMs) delete state.sessions[key];
    }
    state.processed = Object.fromEntries(
      Object.entries(state.processed)
        .filter(([, timestamp]) => now - timestamp < this.config.deduplicationTtlMs)
        .sort((a, b) => a[1] - b[1])
        .slice(-this.config.deduplicationLimit),
    );
  }

  private async persist(next: StoredState): Promise<void> {
    const temp = `${this.config.stateFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(next, null, 2), {
        mode: FileSystem.PRIVATE_FILE_MODE,
        flag: FileSystem.EXCLUSIVE_WRITE_FLAG,
      });
      await rename(temp, this.config.stateFile);
      this.state = next;
    } finally {
      await rm(temp, { force: true });
    }
  }
}
