import type { AttendanceConfig, FaqEntry, ResourceConfig } from '../domain/attendance/types.js';
import { ApplicationError, ErrorCode } from '../errors/application-error.js';
import { DIGITS_ONLY_PATTERN, IDENTIFIER_PATTERN } from '../constants/patterns.js';
import { normalizeInput } from '../utils/template.js';
import { isRecord, parseJson } from '../utils/validation.js';
import { required, stringList } from './readers.js';
import type { Environment } from './readers.js';

function commands(env: Environment, key: string): string[] {
  const values = stringList(parseJson(required(env, key), key), key).map(normalizeInput);
  if (values.some((value) => DIGITS_ONLY_PATTERN.test(value))) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      `${key} deve conter comandos não numéricos.`,
    );
  }
  return [...new Set(values)];
}

function resource(env: Environment, messageKey: string, urlKey: string): ResourceConfig {
  const message = required(env, messageKey);
  const raw = env[urlKey]?.trim();
  if (!raw) return { message };

  let url: URL;
  try {
    url = new URL(raw);
  } catch (cause) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      `${urlKey} deve ser uma URL HTTPS válida ou ficar vazio.`,
      { cause },
    );
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      `${urlKey} deve ser HTTPS e não conter credenciais.`,
    );
  }
  return { message, url: url.toString() };
}

function faqs(env: Environment): FaqEntry[] {
  const value = parseJson(required(env, 'FAQ_ENTRIES'), 'FAQ_ENTRIES');
  if (!Array.isArray(value) || value.length > 9)
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      'FAQ_ENTRIES deve ser um array com no máximo 9 perguntas.',
    );
  const ids = new Set<string>();
  const questions = new Set<string>();
  return value.map((item: unknown) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !IDENTIFIER_PATTERN.test(item.id) ||
      typeof item.question !== 'string' ||
      !item.question.trim() ||
      item.question.trim().length > 24 ||
      typeof item.answer !== 'string' ||
      !item.answer.trim()
    ) {
      throw new ApplicationError(
        ErrorCode.CONFIGURATION_INVALID,
        'Cada FAQ deve conter id, question e answer válidos.',
      );
    }
    const question = normalizeInput(item.question);
    if (ids.has(item.id) || questions.has(question))
      throw new ApplicationError(
        ErrorCode.CONFIGURATION_INVALID,
        'FAQ_ENTRIES contém IDs ou perguntas repetidas.',
      );
    ids.add(item.id);
    questions.add(question);
    return { id: item.id, question: item.question.trim(), answer: item.answer.trim() };
  });
}

export function readAttendanceConfig(env: Environment): AttendanceConfig {
  const menuCommands = commands(env, 'BOT_MENU_COMMANDS');
  const humanCommands = commands(env, 'BOT_HUMAN_COMMANDS');
  const allCommands = [...menuCommands, ...humanCommands];
  if (new Set(allCommands).size !== allCommands.length)
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      'Cada comando global deve ser único.',
    );
  const resumeFlag = required(env, 'BOT_RESUME_ENABLED');
  if (resumeFlag !== 'true' && resumeFlag !== 'false')
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      'BOT_RESUME_ENABLED deve ser true ou false.',
    );
  const resumeEnabled = resumeFlag === 'true';
  const resumeCommand = resumeEnabled
    ? normalizeInput(required(env, 'BOT_RESUME_COMMAND'))
    : undefined;
  if (
    resumeCommand &&
    (humanCommands.includes(resumeCommand) || DIGITS_ONLY_PATTERN.test(resumeCommand))
  )
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      'BOT_RESUME_COMMAND deve ser distinto dos comandos de atendimento humano e não numérico.',
    );
  const menuButton = required(env, 'BOT_MENU_BUTTON');
  const menuSection = required(env, 'BOT_MENU_SECTION');
  const profileButton = required(env, 'PROFILE_BUTTON');
  const profileSection = required(env, 'PROFILE_SECTION');
  const faqButton = required(env, 'FAQ_BUTTON');
  const faqSection = required(env, 'FAQ_SECTION');
  if (
    menuButton.length > 20 ||
    profileButton.length > 20 ||
    faqButton.length > 20 ||
    menuSection.length > 24 ||
    profileSection.length > 24 ||
    faqSection.length > 24
  )
    throw new ApplicationError(
      ErrorCode.CONFIGURATION_INVALID,
      'Rótulos de listas interativas excedem os limites do WhatsApp.',
    );
  return {
    menuMessage: required(env, 'BOT_MENU_MESSAGE'),
    menuLabels: {
      parents: required(env, 'MENU_LABEL_PARENTS'),
      adults: required(env, 'MENU_LABEL_ADULTS'),
      welcome: required(env, 'MENU_LABEL_WELCOME'),
      teativo: required(env, 'MENU_LABEL_TEATIVO'),
      identification: required(env, 'MENU_LABEL_IDENTIFICATION'),
      faq: required(env, 'MENU_LABEL_FAQ'),
      human: required(env, 'MENU_LABEL_HUMAN'),
    },
    profileLabels: {
      mother_or_father: required(env, 'PROFILE_LABEL_MOTHER_OR_FATHER'),
      family_member: required(env, 'PROFILE_LABEL_FAMILY_MEMBER'),
      autistic_adult: required(env, 'PROFILE_LABEL_AUTISTIC_ADULT'),
    },
    menuCommands,
    humanCommands,
    resumeEnabled,
    resumeCommand,
    invalidOptionMessage: required(env, 'BOT_INVALID_OPTION_MESSAGE'),
    repeatedInvalidOptionMessage: required(env, 'BOT_REPEATED_INVALID_OPTION_MESSAGE'),
    staleSelectionMessage: required(env, 'BOT_STALE_SELECTION_MESSAGE'),
    unsupportedMessage: required(env, 'BOT_UNSUPPORTED_MESSAGE'),
    navigationMessage: required(env, 'BOT_NAVIGATION_MESSAGE'),
    resourceFooterMessage: required(env, 'BOT_RESOURCE_FOOTER_MESSAGE'),
    humanMessage: required(env, 'BOT_HUMAN_MESSAGE'),
    resourceUnavailableMessage: required(env, 'BOT_RESOURCE_UNAVAILABLE_MESSAGE'),
    parents: resource(env, 'PARENTS_GROUP_MESSAGE', 'PARENTS_GROUP_FORM_URL'),
    teativo: resource(env, 'TEATIVO_MESSAGE', 'TEATIVO_WAITLIST_URL'),
    identification: resource(env, 'CARD_MESSAGE', 'CARD_FORM_URL'),
    adultsMessage: required(env, 'ADULTS_GROUP_MESSAGE'),
    profileMessage: required(env, 'WELCOME_PROFILE_MESSAGE'),
    profileConfirmationMessage: required(env, 'WELCOME_CONFIRMATION_MESSAGE'),
    faqTitle: required(env, 'FAQ_TITLE'),
    faqEmptyMessage: required(env, 'FAQ_EMPTY_MESSAGE'),
    faqs: faqs(env),
    faqBackLabel: required(env, 'FAQ_BACK_LABEL'),
    profileBackLabel: required(env, 'PROFILE_BACK_LABEL'),
    profileHumanLabel: required(env, 'PROFILE_HUMAN_LABEL'),
    menuButton,
    menuSection,
    profileButton,
    profileSection,
    faqButton,
    faqSection,
  };
}
