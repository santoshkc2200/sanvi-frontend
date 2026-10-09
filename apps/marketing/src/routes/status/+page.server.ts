import { getSystemReadiness } from '@sanvi/api-client'
import { getMarketingRawApiClient } from '$lib/api'
import { INCIDENT_HISTORY } from '$lib/status'
import type { PageServerLoad } from './$types'

export const prerender = true

// A *server* load, like the pricing page's (TASK-024): it runs at prerender
// time only and the result is serialized into the static HTML, so the page
// degrades to its last known state rather than to an error — a universal
// (`+page.ts`) load would re-run in the browser and need `connect-src` for
// the API origin inside the baked prerendered CSP meta. When the API is
// unreachable at build time the fallback below ships; the client-side poll
// in `+page.svelte` takes over from there.
export const load: PageServerLoad = async () => {
  try {
    const readiness = await getSystemReadiness(getMarketingRawApiClient())
    return {
      readiness,
      loadError: false,
      builtAt: new Date().toISOString(),
      incidents: INCIDENT_HISTORY,
    }
  } catch {
    // API not reachable during static build; the page renders its unknown
    // state with the last known (empty) signal instead of failing the build.
    return {
      readiness: null,
      loadError: true,
      builtAt: new Date().toISOString(),
      incidents: INCIDENT_HISTORY,
    }
  }
}
