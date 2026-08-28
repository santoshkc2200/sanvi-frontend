import { listPublicPlans } from '@sanvi/api-client'
import { getMarketingApiClient } from '$lib/api'
import { DEFAULT_PLANS } from '$lib/plans'
import type { PageLoad } from './$types'

export const prerender = true

export const load: PageLoad = async () => {
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
