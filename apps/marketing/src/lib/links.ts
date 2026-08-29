import { BASE_LOCALE, currentLocale, withLocalePrefix } from '@sanvi/i18n'

/**
 * Prefixed internal links: `localePath('/pricing')` renders as
 * `/ja/pricing` on a Japanese page and `/pricing` on the default-locale
 * (unprefixed) one. Marketing has no tenant, so the default locale is
 * always the platform base — and because every internal link goes through
 * here, the prerender crawler discovers the `/{locale}` variant of every
 * page simply by crawling the default ones (and vice versa).
 */
export function localePath(path: string): string {
  return withLocalePrefix(path, currentLocale(), BASE_LOCALE)
}
