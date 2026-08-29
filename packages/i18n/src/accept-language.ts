import { LOCALES, normalizeLocaleTag, type Locale } from './config'

/**
 * `Accept-Language` negotiation — the last signal in the detection chain,
 * and the only one expressed in the HTTP header format (`ja;q=0.9,en;q=0.8`).
 *
 * Tags the browser sends are often region-qualified (`ja-JP`, `en-GB`) and
 * may arrive with arbitrary casing and whitespace; each candidate is
 * canonicalised via `normalizeLocaleTag` before it is matched against
 * `available`. Quality values break ties (higher wins; equal values keep
 * header order, per RFC 9110's "more specific first" guidance browsers
 * already follow). `*` is ignored — it means "anything is fine", and
 * guessing a locale from nothing is the base locale's job, not this
 * function's. Returns `null` when nothing matches.
 */
export function parseAcceptLanguage(
  header: string | null | undefined,
  available: readonly Locale[] = LOCALES,
): Locale | null {
  if (!header) return null

  const candidates: { locale: Locale; quality: number; index: number }[] = []
  const parts = header.split(',')
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]?.trim()
    if (!part) continue

    const [tag, ...params] = part.split(';')
    const rawTag = tag?.trim()
    if (!rawTag || rawTag === '*') continue

    const locale = normalizeLocaleTag(rawTag)
    if (!locale || !available.includes(locale)) continue

    let quality = 1
    for (const param of params) {
      const [name, value] = param.split('=')
      if (name?.trim() === 'q') {
        const parsed = Number.parseFloat(value ?? '')
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) quality = parsed
      }
    }
    candidates.push({ locale, quality, index })
  }

  candidates.sort((a, b) => b.quality - a.quality || a.index - b.index)
  return candidates[0]?.locale ?? null
}
