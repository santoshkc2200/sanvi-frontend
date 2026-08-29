/**
 * Locale-prefix parsing for `svelte.config.js`'s `reroute` — a deliberately
 * dependency-free mirror of `@sanvi/i18n`'s `routing.ts` (`parseLocalePrefix`
 * + the configured locale set). The Svelte config is loaded by plain Node
 * ESM, which can't resolve the i18n package's extensionless TypeScript
 * imports, so the twelve lines this file needs live here — and
 * `__tests__/locale-prefix.test.ts` fails the build if the two drift.
 *
 * The `?=` lookahead keeps the slash after the locale on the "rest" side;
 * only configured locales match, so real routes never collide with a prefix.
 */

export const LOCALES = ['en', 'ja']

const PREFIX_SHAPE = /^\/([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?)(?=\/|$)/

/** @param {string} pathname @returns {{ locale: string, rest: string } | null} */
export function parseLocalePrefix(pathname) {
  const match = PREFIX_SHAPE.exec(pathname)
  if (!match) return null
  const language = (match[1] ?? '').toLowerCase().split(/[-_]/)[0] ?? ''
  if (!LOCALES.includes(language)) return null
  return { locale: language, rest: pathname.slice(match[0].length) || '/' }
}
