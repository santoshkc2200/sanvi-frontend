import { error } from '@sveltejs/kit'
import { createApiClient, createTypedApiClient, previewTenantTheme } from '@sanvi/api-client'
import { themeStyleCss } from '@sanvi/theme-runtime'
import { getAppEnv } from '$lib/env'
import type { PageServerLoad } from './$types'

export const prerender = false

export const load: PageServerLoad = async ({ url, locals, setHeaders, request }) => {
  setHeaders({
    'x-robots-tag': 'noindex',
  })

  const token = url.searchParams.get('token')
  if (!token) {
    error(403, { message: 'Preview token is required' })
  }

  const locale = url.searchParams.get('locale') ?? locals.locale ?? 'en'
  const mode = url.searchParams.get('mode')
  const host =
    request?.headers?.get('host') ??
    url.host ??
    (locals.tenant?.slug ? `${locals.tenant.slug}.localhost` : undefined)

  try {
    const { apiOrigin } = getAppEnv()
    const client = createTypedApiClient(
      createApiClient({
        baseUrl: apiOrigin,
        getTenantId: () => locals.tenant?.tenant_id,
        getExtraHeaders: () => (host ? { host } : undefined),
      }),
    )

    const theme = await previewTenantTheme(client, token, locale)
    if (!theme || typeof theme !== 'object' || !('theme_key' in theme)) {
      error(403, { message: 'Invalid or expired preview token' })
    }

    // TASK-024: this page renders a second inline theme `<style>` (the
    // previewed theme, not `locals.theme`). The tightened CSP has no
    // `unsafe-inline`, so its exact content is enumerated here and hashed
    // into `style-src` by the `runtimeConnectSrc` hook.
    locals.themeStyleOverrides ??= []
    locals.themeStyleOverrides.push(themeStyleCss(theme))

    return {
      theme,
      previewToken: token,
      mode: mode === 'dark' || mode === 'light' ? mode : undefined,
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
