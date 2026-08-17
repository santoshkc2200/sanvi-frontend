import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Never prerendered — a health check must reflect the running instance, not
// a build-time snapshot.
export const prerender = false

export const GET: RequestHandler = () => {
  return json({ status: 'ok', version: __APP_VERSION__ })
}
