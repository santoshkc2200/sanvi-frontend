import type { RequestHandler } from './$types'

export const prerender = true

export const GET: RequestHandler = () => {
  const body = ['User-agent: *', 'Allow: /', 'Sitemap: /sitemap.xml', ''].join('\n')
  return new Response(body, { headers: { 'content-type': 'text/plain' } })
}
