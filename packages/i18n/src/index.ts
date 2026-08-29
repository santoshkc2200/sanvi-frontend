/**
 * `@sanvi/i18n` — browser-safe entry point. Request hooks import
 * `@sanvi/i18n/server` instead (Node-only AsyncLocalStorage); link/URL math
 * lives on the dependency-free `@sanvi/i18n/routing` subpath so
 * `svelte.config.js` can import it at build time.
 */

export { parseAcceptLanguage } from './accept-language'
export {
  BASE_LOCALE,
  isLocale,
  LOCALES,
  LOCALE_CONFIGS,
  LOCALE_COOKIE,
  localeOptions,
  normalizeLocaleTag,
  type Locale,
  type LocaleConfig,
} from './config'
export { en, type MessageKey, messages } from './catalogs'
export { fmt } from './format'
export { IcuParseError, MissingParamError, extractParams, formatPattern, parsePattern } from './icu'
export { normalizeEmail, normalizeSlug, normalizeTel, nfkc } from './normalize'
export {
  initI18n,
  locale,
  onLocaleChange,
  setLocale,
  currentLocale,
  persistLocaleChoice,
} from './runtime.svelte'
export { isPseudoMode, pseudoize, setPseudoMode } from './pseudo'
export {
  localeAlternates,
  localeHref,
  parseLocalePrefix,
  stripLocalePrefix,
  withLocalePrefix,
} from './routing'
export { t, translate, type Messages } from './translate'
