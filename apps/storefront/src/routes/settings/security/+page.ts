import { loadFlow } from '$lib/load-flow'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url }) => loadFlow('settings', url)
