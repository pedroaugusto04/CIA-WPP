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
  'mae/pai': PROFILE_OPTIONS[0],
  'mae e pai': PROFILE_OPTIONS[0],
  familiar: PROFILE_OPTIONS[1],
  'membro da familia': PROFILE_OPTIONS[1],
  'adulto autista': PROFILE_OPTIONS[2],
};

const TEXT_MENU_ALIASES: Readonly<Record<string, MenuOption>> = {
  '1': MenuOption.PARENTS,
  pais: MenuOption.PARENTS,
  '2': MenuOption.ADULTS,
  adultos: MenuOption.ADULTS,
  '3': MenuOption.WELCOME,
  acolhimento: MenuOption.WELCOME,
  '4': MenuOption.TEATIVO,
  teativo: MenuOption.TEATIVO,
  '5': MenuOption.IDENTIFICATION,
  carteirinha: MenuOption.IDENTIFICATION,
  '6': MenuOption.FAQ,
  duvidas: MenuOption.FAQ,
  '7': MenuOption.HUMAN,
};

export function parseMenuOption(input: string): MenuOption | undefined {
  const value = normalizeInput(input.startsWith('menu:') ? input.slice(5) : input);
  if (isMenuOption(value)) return value;
  return TEXT_MENU_ALIASES[value];
}

export function parseProfile(input: string): (typeof PROFILE_OPTIONS)[number] | undefined {
  const value = normalizeInput(input.startsWith('profile:') ? input.slice('profile:'.length) : input);
  return PROFILE_ALIASES[value];
}
