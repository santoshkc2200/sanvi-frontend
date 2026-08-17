import { buildContentSecurityPolicyForApp } from '@sanvi/csp'
import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { getAppEnv } from '$lib/env'

/**
 * Resolves the tenant from the request's subdomain or custom domain.
 * Phase 01 (Tenancy, Routing & API Client) replaces this with a real
 * lookup; phase 00 only needs `event.locals.tenant` to exist so downstream
 * code (and its types) can depend on the shape now.
 */
const resolveTenant: Handle = async ({ event, resolve }) => {
  event.locals.tenant = null
  return resolve(event)
}

/**
 * Resolves the request's locale from `Accept-Language`/a cookie. Phase 06
 * (i18n) replaces this; phase 00 hardcodes `en` so every downstream read of
 * `event.locals.locale` is already typed and non-optional.
 */
const resolveLocale: Handle = async ({ event, resolve }) => {
  event.locals.locale = 'en'
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('lang="en"', `lang="${event.locals.locale}"`),
  })
}

/**
 * Applies the storefront's CSP. Unlike marketing, the storefront is SSR'd
 * per request (tenant/theme/locale vary per request), so this always runs —
 * no adapter-node static-serving bypass to work around. Phase 09 (Tenant
 * Payments) extends `mediaOrigin`/Stripe allowances per tenant; phase 07
 * (Theming) adds the tenant's theme asset origin.
 */
const applyCsp: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)
  const { apiOrigin, mediaOrigin } = getAppEnv()

  response.headers.set(
    'content-security-policy',
    buildContentSecurityPolicyForApp('storefront', { apiOrigin, mediaOrigin }),
  )

  return response
}

export const handle: Handle = sequence(resolveTenant, resolveLocale, applyCsp)
