import type { AttendanceConfig } from '../../domain/attendance/types.js';
import { normalizeInput } from '../../utils/template.js';

export const MenuOption = {
  PARENTS: 'parents',
  ADULTS: 'adults',
  WELCOME: 'welcome',
  TEATIVO: 'teativo',
  IDENTIFICATION: 'card',
  FAQ: 'faq',
  HUMAN: 'human',
} as const;

export const NavigationOption = {
  MENU: 'nav:menu',
  HUMAN: 'nav:human',
} as const;

export type MenuOption = (typeof MenuOption)[keyof typeof MenuOption];

const MENU_OPTION_VALUES: ReadonlySet<string> = new Set(Object.values(MenuOption));

function isMenuOption(value: string): value is MenuOption {
  return MENU_OPTION_VALUES.has(value);
}

export const MENU_OPTIONS = [
  { id: MenuOption.PARENTS, labelKey: 'parents' },
  { id: MenuOption.ADULTS, labelKey: 'adults' },
  { id: MenuOption.WELCOME, labelKey: 'welcome' },
  { id: MenuOption.TEATIVO, labelKey: 'teativo' },
  { id: MenuOption.IDENTIFICATION, labelKey: 'identification' },
  { id: MenuOption.FAQ, labelKey: 'faq' },
  { id: MenuOption.HUMAN, labelKey: 'human' },
] as const;

export const PROFILE_OPTIONS = [
  { id: 'mother_or_father', labelKey: 'mother_or_father' },
  { id: 'family_member', labelKey: 'family_member' },
  { id: 'autistic_adult', labelKey: 'autistic_adult' },
] as const;

const PROFILE_ALIASES: Readonly<Record<string, (typeof PROFILE_OPTIONS)[number]>> = {
  '1': PROFILE_OPTIONS[0],
  '2': PROFILE_OPTIONS[1],
  '3': PROFILE_OPTIONS[2],
  mother_or_father: PROFILE_OPTIONS[0],
  family_member: PROFILE_OPTIONS[1],
  autistic_adult: PROFILE_OPTIONS[2],
  mae: PROFILE_OPTIONS[0],
  pai: PROFILE_OPTIONS[0],
  'mae ou pai': PROFILE_OPTIONS[0],
  'pai ou mae': PROFILE_OPTIONS[0],
  'mae/pai': PROFILE_OPTIONS[0],
  'mae e pai': PROFILE_OPTIONS[0],
  pais: PROFILE_OPTIONS[0],
  familiar: PROFILE_OPTIONS[1],
  familiares: PROFILE_OPTIONS[1],
  familia: PROFILE_OPTIONS[1],
  'membro da familia': PROFILE_OPTIONS[1],
  'adulto autista': PROFILE_OPTIONS[2],
  'autista adulto': PROFILE_OPTIONS[2],
  'adultos autistas': PROFILE_OPTIONS[2],
  'autistas adultos': PROFILE_OPTIONS[2],
  autista: PROFILE_OPTIONS[2],
};

const TEXT_MENU_ALIASES: Readonly<Record<string, MenuOption>> = {
  '1': MenuOption.PARENTS,
  pais: MenuOption.PARENTS,
  'grupo de pais': MenuOption.PARENTS,
  'grupo pais': MenuOption.PARENTS,
  'grupo dos pais': MenuOption.PARENTS,
  'grupo de pais e familiares': MenuOption.PARENTS,
  'pais e familiares': MenuOption.PARENTS,

  '2': MenuOption.ADULTS,
  adultos: MenuOption.ADULTS,
  'grupo de adultos': MenuOption.ADULTS,
  'grupo dos adultos': MenuOption.ADULTS,
  'grupo adultos': MenuOption.ADULTS,
  'grupo de autistas adultos': MenuOption.ADULTS,
  'autistas adultos': MenuOption.ADULTS,
  'adultos autistas': MenuOption.ADULTS,

  '3': MenuOption.WELCOME,
  acolhimento: MenuOption.WELCOME,
  acolher: MenuOption.WELCOME,

  '4': MenuOption.TEATIVO,
  teativo: MenuOption.TEATIVO,
  'projeto teativo': MenuOption.TEATIVO,
  'te ativo': MenuOption.TEATIVO,
  'projeto te ativo': MenuOption.TEATIVO,

  '5': MenuOption.IDENTIFICATION,
  carteirinha: MenuOption.IDENTIFICATION,
  carteira: MenuOption.IDENTIFICATION,
  identificacao: MenuOption.IDENTIFICATION,
  'carteirinha de identificacao': MenuOption.IDENTIFICATION,
  'carteira de identificacao': MenuOption.IDENTIFICATION,

  '6': MenuOption.FAQ,
  duvidas: MenuOption.FAQ,
  duvida: MenuOption.FAQ,
  faq: MenuOption.FAQ,
  perguntas: MenuOption.FAQ,
  'duvidas frequentes': MenuOption.FAQ,

  '7': MenuOption.HUMAN,
  humano: MenuOption.HUMAN,
  atendente: MenuOption.HUMAN,
  equipe: MenuOption.HUMAN,
  'falar com a equipe': MenuOption.HUMAN,
  'falar com atendente': MenuOption.HUMAN,
};

export function parseMenuOption(input: string, config?: AttendanceConfig): MenuOption | undefined {
  const value = normalizeInput(input.startsWith('menu:') ? input.slice(5) : input);
  if (isMenuOption(value)) return value;
  if (config) {
    for (const option of MENU_OPTIONS) {
      if (normalizeInput(config.menuLabels[option.labelKey]) === value) {
        return option.id;
      }
    }
  }
  return TEXT_MENU_ALIASES[value];
}

export function parseProfile(
  input: string,
  config?: AttendanceConfig,
): (typeof PROFILE_OPTIONS)[number] | undefined {
  const value = normalizeInput(
    input.startsWith('profile:') ? input.slice('profile:'.length) : input,
  );
  if (config) {
    for (const option of PROFILE_OPTIONS) {
      if (normalizeInput(config.profileLabels[option.labelKey]) === value) {
        return option;
      }
    }
  }
  return PROFILE_ALIASES[value];
}
