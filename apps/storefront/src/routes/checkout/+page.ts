import { getTenantCheckoutConfig } from '@sanvi/api-client'
import type { CheckoutConfigView } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import type { PageLoad } from './$types'

export const prerender = false
// The pre-flight below reads the session cookie, and the page is only ever
// reached by a signed-in buyer — the same reason `checkout/return` opts out.
export const ssr = false

export const load: PageLoad = async ({ url }) => {
  const canceled = url.searchParams.get('canceled') === 'true'

  // Readiness and the settlement currency come from the server, before a
  // Pay button is drawn. A failed read leaves both unknown, and unknown
  // is treated as "cannot pay": the alternative is pricing in a guessed
  // currency, which the backend refuses anyway — after the buyer has
  // already committed to the click.
  let config: CheckoutConfigView | null = null
  try {
    config = await getTenantCheckoutConfig(apiClient)
  } catch {
    config = null
  }

  return {
    canceled,
    config,
  }
}
