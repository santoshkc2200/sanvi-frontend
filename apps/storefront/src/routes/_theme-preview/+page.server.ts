import { error } from '@sveltejs/kit'
import { createApiClient, createTypedApiClient, previewTenantTheme } from '@sanvi/api-client'
import { getAppEnv } from '$lib/env'
import type { PageServerLoad } from './$types'

export const prerender = false

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
  setHeaders({
    'x-robots-tag': 'noindex',
  })

  const token = url.searchParams.get('token')
  if (!token) {
    error(403, { message: 'Preview token is required' })
  }

  const locale = url.searchParams.get('locale') ?? locals.locale ?? 'en'
  const host = locals.tenant?.slug ? `${locals.tenant.slug}.localhost` : undefined

  try {
    const { apiOrigin } = getAppEnv()
    const client = createTypedApiClient(
      createApiClient({
        baseUrl: apiOrigin,
        getTenantId: () => locals.tenant?.tenant_id,
        getExtraHeaders: () => (host ? { host } : {}),
      }),
    )

    const theme = await previewTenantTheme(client, token, locale)
    if (!theme || typeof theme !== 'object' || !('theme_key' in theme)) {
      error(403, { message: 'Invalid or expired preview token' })
    }

    return {
      theme,
      previewToken: token,
    }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      typeof (err as { status: unknown }).status === 'number'
    ) {
      throw err
    }
    error(403, { message: 'Invalid or expired preview token' })
  }
}
