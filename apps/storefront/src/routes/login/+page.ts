import { loadFlow } from '$lib/load-flow'
import type { PageLoad } from './$types'

// Kratos's login flow is bound to the browser's cookie context for this one
// visit — SSR has no meaningful place to hold that, so this route (and
// every other self-service route) never renders on the server.
export const prerender = false
export const ssr = false

export const load: PageLoad = async ({ url }) => loadFlow('login', url)
