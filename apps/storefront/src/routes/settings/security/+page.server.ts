import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const ssr = false
export const prerender = false

/**
 * The one guard this app has today: redirect-before-render, so no protected
 * content ever flashes (this `load` runs server-side even with `ssr =
 * false` — only the page's own HTML rendering is skipped, not `load`).
 */
export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.session) {
    redirect(303, `/login?return_to=${encodeURIComponent(url.pathname + url.search)}`)
  }
}
