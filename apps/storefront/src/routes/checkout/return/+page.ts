import type { PageLoad } from './$types'

export const prerender = false
export const ssr = false

export const load: PageLoad = async ({ url }) => {
  let checkoutId =
    url.searchParams.get('id') ??
    url.searchParams.get('checkout_id') ??
    url.searchParams.get('session_id')

  if (!checkoutId && typeof window !== 'undefined') {
    try {
      checkoutId = window.sessionStorage?.getItem('sanvi_pending_checkout_id')
    } catch {
      // Ignore privacy mode / restricted storage errors
    }
  }

  return {
    checkoutId,
  }
}
