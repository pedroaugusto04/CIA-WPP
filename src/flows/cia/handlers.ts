import { AttendanceState } from '../../domain/attendance/types.js';
import type {
  AttendanceConfig,
  OutboundMessage,
  ResourceConfig,
  Transition,
} from '../../domain/attendance/types.js';
import { normalizeInput, renderTemplate } from '../../utils/template.js';
import {
  MENU_OPTIONS,
  MenuOption,
  parseMenuOption,
  parseProfile,
  PROFILE_OPTIONS,
  NavigationOption,
} from './constants.js';

export type StateHandler = (
  input: string,
  config: AttendanceConfig,
  invalidAttempts: number,
) => Transition;

const text = (body: string): OutboundMessage => ({ type: 'text', body });

function transition(
  state: AttendanceState,
  messages: OutboundMessage[],
  invalidAttempts = 0,
): Transition {
  return { state, messages, invalidAttempts };
}

function menuList(config: AttendanceConfig): OutboundMessage {
  return {
    type: 'list',
    body: config.menuMessage,
    button: config.menuButton,
    section: config.menuSection,
    rows: MENU_OPTIONS.map(({ id, labelKey }) => ({
      id: `menu:${id}`,
      title: config.menuLabels[labelKey],
    })),
  };
}

function profileList(config: AttendanceConfig): OutboundMessage {
  return {
    type: 'list',
    body: config.profileMessage,
    button: config.profileButton,
    section: config.profileSection,
    rows: [
      ...PROFILE_OPTIONS.map(({ id, labelKey }) => ({
        id: `profile:${id}`,
        title: config.profileLabels[labelKey],
      })),
      { id: NavigationOption.MENU, title: config.profileBackLabel },
      { id: NavigationOption.HUMAN, title: config.profileHumanLabel },
    ],
  };
}

function faqList(config: AttendanceConfig): OutboundMessage {
  return {
    type: 'list',
    body: `${config.faqTitle}\n\n${config.navigationMessage}`,
    button: config.faqButton,
    section: config.faqSection,
    rows: [
      ...config.faqs.map((entry) => ({ id: `faq:${entry.id}`, title: entry.question })),
      { id: NavigationOption.MENU, title: config.faqBackLabel },
    ],
  };
}

function promptForState(
  state: AttendanceState,
  config: AttendanceConfig,
  invalidAttempts = 0,
): Transition {
  switch (state) {
    case AttendanceState.MENU:
      return transition(state, [menuList(config)], invalidAttempts);
    case AttendanceState.PROFILE:
      return transition(state, [profileList(config)], invalidAttempts);
    case AttendanceState.FAQ:
      return config.faqs.length > 0
        ? transition(state, [faqList(config)], invalidAttempts)
        : showMenu(config);
    case AttendanceState.HUMAN:
      return transition(state, []);
  }
}

export function showMenu(config: AttendanceConfig): Transition {
  return promptForState(AttendanceState.MENU, config);
}

export function showUnsupported(
  state: AttendanceState | undefined,
  config: AttendanceConfig,
  invalidAttempts: number,
): Transition {
  const prompt = promptForState(state ?? AttendanceState.MENU, config, invalidAttempts);
  return {
    ...prompt,
    messages: [text(config.unsupportedMessage), ...prompt.messages],
    invalidAttempts: prompt.invalidAttempts,
  };
}

export function handoff(config: AttendanceConfig, messages: OutboundMessage[] = []): Transition {
  return transition(AttendanceState.HUMAN, [...messages, text(config.humanMessage)]);
}

function showResource(resource: ResourceConfig, config: AttendanceConfig): Transition {
  if (!resource.url) {
    return handoff(config, [text(resource.message), text(config.resourceUnavailableMessage)]);
  }
  return transition(AttendanceState.MENU, [
    text(`${resource.message}\n\n${resource.url}\n\n${config.resourceFooterMessage}`),
  ]);
}

function invalidOption(
  state: AttendanceState,
  config: AttendanceConfig,
  previousAttempts: number,
): Transition {
  const prompt = promptForState(state, config);
  const attempts = prompt.state === state ? Math.min(previousAttempts + 1, 2) : 0;
  return {
    ...prompt,
    invalidAttempts: attempts,
    messages: [
      text(attempts === 1 ? config.invalidOptionMessage : config.repeatedInvalidOptionMessage),
      ...prompt.messages,
    ],
  };
}

const menuTransitions: Record<MenuOption, (config: AttendanceConfig) => Transition> = {
  [MenuOption.PARENTS]: (config) => showResource(config.parents, config),
  [MenuOption.ADULTS]: (config) => handoff(config, [text(config.adultsMessage)]),
  [MenuOption.WELCOME]: (config) => transition(AttendanceState.PROFILE, [profileList(config)]),
  [MenuOption.TEATIVO]: (config) => showResource(config.teativo, config),
  [MenuOption.IDENTIFICATION]: (config) => showResource(config.identification, config),
  [MenuOption.FAQ]: (config) =>
    config.faqs.length === 0
      ? handoff(config, [text(config.faqEmptyMessage)])
      : transition(AttendanceState.FAQ, [faqList(config)]),
  [MenuOption.HUMAN]: (config) => handoff(config),
};

export const stateHandlers: Record<AttendanceState, StateHandler> = {
  [AttendanceState.MENU]: (input, config, invalidAttempts) => {
    const option = parseMenuOption(input, config);
    return option
      ? menuTransitions[option](config)
      : invalidOption(AttendanceState.MENU, config, invalidAttempts);
  },
  [AttendanceState.PROFILE]: (input, config, invalidAttempts) => {
    const profile = parseProfile(input, config);
    return profile
      ? handoff(config, [
          text(
            renderTemplate(config.profileConfirmationMessage, {
              profile: config.profileLabels[profile.labelKey],
            }),
          ),
        ])
      : invalidOption(AttendanceState.PROFILE, config, invalidAttempts);
  },
  [AttendanceState.FAQ]: (input, config, invalidAttempts) => {
    const id = input.startsWith('faq:') ? input.slice('faq:'.length) : undefined;
    const normalizedInput = normalizeInput(input);
    const index = Number.parseInt(normalizedInput, 10);
    const entry =
      config.faqs.find(
        (item) => item.id === id || normalizeInput(item.question) === normalizedInput,
      ) ??
      (Number.isInteger(index) && index >= 1 && index <= config.faqs.length
        ? config.faqs[index - 1]
        : undefined);
    return entry
      ? transition(AttendanceState.FAQ, [text(entry.answer), faqList(config)])
      : invalidOption(AttendanceState.FAQ, config, invalidAttempts);
  },
  [AttendanceState.HUMAN]: () => transition(AttendanceState.HUMAN, []),
};
