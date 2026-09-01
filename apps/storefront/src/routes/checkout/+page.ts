import type { PageLoad } from './$types'

export const prerender = false

export const load: PageLoad = async ({ url }) => {
  const canceled = url.searchParams.get('canceled') === 'true'
  return {
    canceled,
  }
}
