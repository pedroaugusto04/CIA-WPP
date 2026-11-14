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
  { id: MenuOption.PARENTS, labelKey: 'parents', number: '1', alias: 'pais' },
  { id: MenuOption.ADULTS, labelKey: 'adults', number: '2', alias: 'adultos' },
  { id: MenuOption.WELCOME, labelKey: 'welcome', number: '3', alias: 'acolhimento' },
  { id: MenuOption.TEATIVO, labelKey: 'teativo', number: '4', alias: 'teativo' },
  { id: MenuOption.IDENTIFICATION, labelKey: 'identification', number: '5', alias: 'carteirinha' },
  { id: MenuOption.FAQ, labelKey: 'faq', number: '6', alias: 'duvidas' },
  { id: MenuOption.HUMAN, labelKey: 'human', number: '7', alias: 'humano' },
] as const;

export const PROFILE_OPTIONS = [
  {
    id: 'mother_or_father',
    labelKey: 'mother_or_father',
    number: '1',
    aliases: ['mae', 'pai', 'mae ou pai'],
  },
  {
    id: 'family_member',
    labelKey: 'family_member',
    number: '2',
    aliases: ['familiar'],
  },
  {
    id: 'autistic_adult',
    labelKey: 'autistic_adult',
    number: '3',
    aliases: ['autista adulto', 'adulto autista'],
  },
] as const;

export function parseMenuOption(input: string, config?: AttendanceConfig): MenuOption | undefined {
  const value = normalizeInput(input.startsWith('menu:') ? input.slice(5) : input);
  if (isMenuOption(value)) return value;

  for (const option of MENU_OPTIONS) {
    if (
      value === option.number ||
      value === option.alias ||
      (config && value === normalizeInput(config.menuLabels[option.labelKey]))
    ) {
      return option.id;
    }
  }

  return undefined;
}

export function parseProfile(
  input: string,
  config?: AttendanceConfig,
): (typeof PROFILE_OPTIONS)[number] | undefined {
  const value = normalizeInput(
    input.startsWith('profile:') ? input.slice('profile:'.length) : input,
  );

  for (const option of PROFILE_OPTIONS) {
    if (
      value === option.id ||
      value === option.number ||
      option.aliases.some((alias) => alias === value) ||
      (config && value === normalizeInput(config.profileLabels[option.labelKey]))
    ) {
      return option;
    }
  }

  return undefined;
}
