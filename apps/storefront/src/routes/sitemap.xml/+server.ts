import { withLocalePrefix, type Locale } from '@sanvi/i18n'
import type { RequestHandler } from './$types'
import { getAvailableLocales } from '$lib/locales.server'

export const prerender = false

/**
 * The tenant's public pages, per locale, with `xhtml:link` alternates so
 * search engines discover every language version of every URL (the phase-06
 * localized-sitemap deliverable — Google's cross-referenced `<url>` model:
 * each locale variant is listed and carries the full alternate set,
 * `x-default` pointing at the unprefixed canonical). Host-dependent
 * (`url.origin`), so unlike marketing's sitemap this cannot prerender — it
 * renders per request from the same cached locale set the negotiation hook
 * uses.
 */
const PUBLIC_PATHS = [
  '/',
  '/privacy',
  '/privacy/choices',
  '/legal/privacy-notice',
  '/legal/cookies',
  '/legal/sub-processors',
  '/legal/request-metrics',
]

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export const GET: RequestHandler = ({ url, locals }) => {
  const origin = url.origin
  const available: Locale[] = getAvailableLocales()
  const defaultLocale = locals.locale

  const entries: string[] = []
  for (const path of PUBLIC_PATHS) {
    const alternates = available
      .map((locale) => {
        const href = withLocalePrefix(path, locale, defaultLocale)
        return `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(`${origin}${href}`)}"/>`
      })
      .concat([
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}${path}`)}"/>`,
      ])
      .join('\n')
    for (const locale of available) {
      const loc = `${origin}${withLocalePrefix(path, locale, defaultLocale)}`
      entries.push(`  <url>\n    <loc>${escapeXml(loc)}</loc>\n${alternates}\n  </url>`)
    }
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`

  return new Response(body, { headers: { 'content-type': 'application/xml' } })
}
