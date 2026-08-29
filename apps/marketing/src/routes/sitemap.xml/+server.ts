import { BASE_LOCALE, LOCALES, withLocalePrefix } from '@sanvi/i18n'
import { env } from '$env/dynamic/public'
import type { RequestHandler } from './$types'

export const prerender = true

// Marketing has no tenant and no negotiation: the unprefixed URLs are the
// default locale's canonical form and every configured locale gets a prefixed
// variant, so each path emits one `<url>` per locale, cross-referenced with
// `xhtml:link` alternates (and `x-default` pointing at the unprefixed
// canonical) — the same model the storefront sitemap uses.
const ROUTES = ['/', '/pricing']

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export const GET: RequestHandler = ({ url }) => {
  // `url.origin` during prerendering is SvelteKit's internal placeholder
  // (`http://sveltekit-prerender`), not the real domain — a sitemap needs
  // the real one, so this prefers an explicit site origin and only falls
  // back to the request URL for non-prerendered (dev/preview) rendering.
  const origin = env['PUBLIC_SITE_ORIGIN'] || url.origin

  const entries: string[] = []
  for (const path of ROUTES) {
    const alternates = LOCALES.map((locale) => {
      const href = withLocalePrefix(path, locale, BASE_LOCALE)
      return `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(`${origin}${href}`)}"/>`
    })
      .concat([
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}${path}`)}"/>`,
      ])
      .join('\n')
    for (const locale of LOCALES) {
      const loc = `${origin}${withLocalePrefix(path, locale, BASE_LOCALE)}`
      entries.push(`  <url>\n    <loc>${escapeXml(loc)}</loc>\n${alternates}\n  </url>`)
    }
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`

  return new Response(body, { headers: { 'content-type': 'application/xml' } })
}
