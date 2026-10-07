import { BASE_LOCALE, type Locale } from './config'
import { compiledPattern, en, type MessageKey } from './catalogs'
import { formatPattern, MissingParamError, type MessageParams } from './icu'

export function hasMessage(key: string): key is MessageKey {
  return Object.hasOwn(en, key)
}
import { catalogRevision, currentLocale } from './runtime.svelte'
import { isPseudoMode, pseudoize } from './pseudo' /**
 * `t` — the typed message accessor. `t['key.name']({ count: 3 })` resolves
 * the current locale (AsyncLocalStorage on the server, the rune store on
 * the client), renders the ICU pattern, and falls back per-key to the base
 * locale — never an empty string, never a raw `undefined`. Unknown keys
 * render as the key itself with a console error: loud in development, and
 * `i18n:check` should have caught them in CI.
 */

function render(locale: Locale, key: MessageKey, params?: MessageParams): string | null {
  const nodes = compiledPattern(locale, key)
  if (!nodes) return null
  try {
    return formatPattern(nodes, params, locale)
  } catch (error) {
    if (error instanceof MissingParamError) return null
    throw error
  }
}

export function translate(key: MessageKey, params?: MessageParams): string {
  const locale = currentLocale()
  // Reactive dependency on catalog arrival (TASK-022): a call made while the
  // locale's lazy shards were still in flight fell back to the base locale;
  // when the catalog lands, this read re-runs every derivation holding it.
  void catalogRevision()
  let text = render(locale, key, params)
  if (text === null && locale !== BASE_LOCALE) text = render(BASE_LOCALE, key, params)
  if (text === null) {
    console.error(`[i18n] unknown message key "${key}"`)
    return key
  }
  return isPseudoMode() ? pseudoize(text) : text
}

export type Messages = { [K in MessageKey]: (params?: MessageParams) => string }

/**
 * `t` is a Proxy so the type stays `{ [K in MessageKey]: fn }` (compile-time
 * checked against the catalog) while the runtime never materialises one
 * function per key. Missing keys arrive here as arbitrary strings; the
 * signature lie is contained in this one cast.
 */
export const t: Messages = new Proxy({} as Messages, {
  get(_target, key: string | symbol) {
    if (typeof key !== 'string') return () => key
    return (params?: MessageParams) => translate(key as MessageKey, params)
  },
})
