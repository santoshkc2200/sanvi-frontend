import { listPublicPlans } from '@sanvi/api-client'
import { getMarketingApiClient } from '$lib/api'
import { DEFAULT_PLANS } from '$lib/plans'
import type { PageServerLoad } from './$types'

export const prerender = true

// A *server* load, not a universal one (TASK-024): it runs at prerender
// time only, and the result is serialized into the static HTML. A universal
// (`+page.ts`) load re-runs in the browser, which would need `connect-src`
// for the API origin inside the *baked* prerendered CSP meta — a policy that
// cannot know the runtime origins. Plans ship as build-time content; the
// DEFAULT_PLANS fallback covers an unreachable API at build.
export const load: PageServerLoad = async () => {
  try {
    const client = getMarketingApiClient()
    const plans = await listPublicPlans(client)
    if (plans && Array.isArray(plans) && plans.length > 0) {
      return { plans }
    }
  } catch {
    // API not reachable during static build; fallback to standard catalog
  }
  return { plans: DEFAULT_PLANS }
}
