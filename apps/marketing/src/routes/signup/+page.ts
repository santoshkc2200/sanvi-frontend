import type { PageLoad } from './$types'

export const prerender = false

export const load: PageLoad = async ({ url }) => {
  const plan = url.searchParams.get('plan') ?? 'starter'
  const interval = url.searchParams.get('interval') ?? 'month'
  const currency = url.searchParams.get('currency') ?? 'USD'

  return {
    selectedPlan: plan,
    selectedInterval: interval,
    selectedCurrency: currency,
  }
}
