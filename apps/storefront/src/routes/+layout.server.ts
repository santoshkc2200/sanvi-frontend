import { error } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'
import { loadPrivacyContext } from '$lib/privacy.server'

export const load: LayoutServerLoad = async ({ locals, request }) => {
  if (locals.tenantResolution === 'unknown-host') {
    // No host/tenant enumeration signal in the message — see architecture-overview.md §8.
    error(404, { message: 'Not found' })
  }

  // Phase 05: the directive snapshot and the public notice, resolved with
  // the request's cookies so the consent surface renders before first
  // paint. Null (surfaces simply don't render) when the backend doesn't
  // answer — a missing privacy API must not take the storefront down.
  const privacy = await loadPrivacyContext(request.headers.get('cookie'))

  return {
    tenant: locals.tenant,
    locale: locals.locale,
    session: locals.session,
    privacy,
  }
}
