/**
 * Minimal i18n module in the style of VSCode:
 *   t('key', 'default value', params)
 *
 * - The first argument is always a string literal key.
 * - The second argument is the default/fallback text (English).
 * - The third optional argument is an interpolation params object using `{name}`.
 *
 * The current locale defaults to the browser language. It can be changed at
 * runtime with `setLocale()`, which notifies subscribers so React components
 * can re-render with the new language.
 */

import { messages, type MessageCatalog, type Params } from './messages';

export type { Params };

export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
};

let currentLocale: SupportedLocale = resolveLocale(readBrowserLocale());

const listeners = new Set<() => void>();

/** Read the browser's display language and map it to a supported locale. */
function readBrowserLocale(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.language || undefined;
}

/**
 * Map an arbitrary locale string (e.g. `zh-CN`, `zh`, `en-US`, `en_GB`)
 * to the closest supported locale. Unknown locales fall back to English.
 */
export function resolveLocale(locale: string | undefined | null): SupportedLocale {
  const base = (locale || '').toLowerCase().replace('_', '-');
  if (base.startsWith('zh')) return 'zh-CN';
  return 'en';
}

export function getLocale(): SupportedLocale {
  return currentLocale;
}

export function setLocale(locale: string): SupportedLocale {
  currentLocale = resolveLocale(locale === 'system' ? readBrowserLocale() : locale);
  listeners.forEach((fn) => fn());
  return currentLocale;
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Translate a key into the current locale.
 *
 * @param key          - Unique translation key (string literal).
 * @param defaultText  - Fallback text used when no catalog entry exists.
 * @param params       - Optional interpolation values referenced as `{name}`.
 */
export function t(key: string, defaultText: string, params?: Params): string {
  const catalog: MessageCatalog | undefined = messages[currentLocale];
  const template = catalog?.[key] ?? defaultText;
  return interpolate(template, params);
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    return name in params ? String(params[name]) : match;
  });
}