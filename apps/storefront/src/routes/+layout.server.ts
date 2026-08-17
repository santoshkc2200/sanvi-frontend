import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals }) => {
  return {
    tenant: locals.tenant,
    locale: locals.locale,
  }
}
