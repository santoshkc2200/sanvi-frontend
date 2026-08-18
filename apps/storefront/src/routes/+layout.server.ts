import { error } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals }) => {
  if (locals.tenantResolution === 'unknown-host') {
    // No host/tenant enumeration signal in the message — see architecture-overview.md §8.
    error(404, { message: 'Not found' })
  }

  return {
    tenant: locals.tenant,
    locale: locals.locale,
    session: locals.session,
  }
}
