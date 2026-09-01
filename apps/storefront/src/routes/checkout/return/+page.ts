import type { PageLoad } from './$types'

export const prerender = false
export const ssr = false

export const load: PageLoad = async ({ url }) => {
  const checkoutId =
    url.searchParams.get('id') ??
    url.searchParams.get('checkout_id') ??
    url.searchParams.get('session_id')

  return {
    checkoutId,
  }
}
