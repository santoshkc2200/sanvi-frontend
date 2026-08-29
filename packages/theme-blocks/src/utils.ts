import { currentLocale } from '@sanvi/i18n'

export type LocaleMap = Record<string, string>
export type LocalizedText = string | LocaleMap | undefined | null

/**
 * Resolves a potentially localized text value (string or { en: "...", ja: "..." } map)
 * to a plain string in the current or specified locale.
 */
export function resolveText(value: LocalizedText, explicitLocale?: string): string {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object') {
    const loc = explicitLocale ?? currentLocale() ?? 'en'
    if (value[loc]) return value[loc]
    if (value['en']) return value['en']
    const values = Object.values(value)
    if (values.length > 0 && typeof values[0] === 'string') {
      return values[0]
    }
    return ''
  }
  return String(value)
}
