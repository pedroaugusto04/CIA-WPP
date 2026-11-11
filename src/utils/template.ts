import { TEMPLATE_PLACEHOLDER_PATTERN } from '../constants/patterns.js';
import { INPUT_LOCALE } from '../constants/runtime.js';

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(TEMPLATE_PLACEHOLDER_PATTERN, (_, key: string) =>
    Object.hasOwn(values, key) ? (values[key] ?? '') : '',
  );
}

export function normalizeInput(value: string): string {
  return value.trim().toLocaleLowerCase(INPUT_LOCALE);
}
