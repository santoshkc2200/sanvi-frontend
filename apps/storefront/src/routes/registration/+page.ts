import { loadFlow } from '$lib/load-flow'
import type { PageLoad } from './$types'

export const prerender = false
export const ssr = false

export const load: PageLoad = async ({ url }) => loadFlow('registration', url)
