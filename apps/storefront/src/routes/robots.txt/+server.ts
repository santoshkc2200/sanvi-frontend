import type { RequestHandler } from './$types'

export const prerender = false

/**
 * `Sitemap:` must be an absolute URL per the robots exclusion spec —
 * crawlers ignore a relative one. Same contract as marketing's robots.txt.
 */
export const GET: RequestHandler = ({ url }) => {
  const lines = ['User-agent: *', 'Allow: /', `Sitemap: ${url.origin}/sitemap.xml`, '']
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain' } })
}
