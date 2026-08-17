import { env } from '$env/dynamic/public'
import type { RequestHandler } from './$types'

export const prerender = true

// Placeholder route list — phase 06 (i18n) adds locale-alternate <xhtml:link>
// entries once marketing has more than one language.
const ROUTES = ['/', '/pricing']

export const GET: RequestHandler = ({ url }) => {
  // `url.origin` during prerendering is SvelteKit's internal placeholder
  // (`http://sveltekit-prerender`), not the real domain — a sitemap needs
  // the real one, so this prefers an explicit site origin and only falls
  // back to the request URL for non-prerendered (dev/preview) rendering.
  const origin = env['PUBLIC_SITE_ORIGIN'] || url.origin
  const urls = ROUTES.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`

  return new Response(body, { headers: { 'content-type': 'application/xml' } })
}
