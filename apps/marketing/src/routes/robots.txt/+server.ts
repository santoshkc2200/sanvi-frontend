import { env } from '$env/dynamic/public'
import type { RequestHandler } from './$types'

export const prerender = true

export const GET: RequestHandler = () => {
  // The Sitemap directive must be an absolute URL per the robots exclusion
  // spec — crawlers ignore a relative one. When PUBLIC_SITE_ORIGIN isn't
  // set the line is omitted rather than emitted invalid.
  const siteOrigin = env['PUBLIC_SITE_ORIGIN']
  const lines = ['User-agent: *', 'Allow: /']
  if (siteOrigin) lines.push(`Sitemap: ${siteOrigin}/sitemap.xml`)
  lines.push('')

  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain' } })
}
