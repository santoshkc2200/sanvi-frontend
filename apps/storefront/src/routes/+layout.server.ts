import { error } from '@sveltejs/kit'
import { BASE_LOCALE, LOCALE_CONFIGS, localeAlternates, normalizeLocaleTag } from '@sanvi/i18n'
import type { LayoutServerLoad } from './$types'
import { getAvailableLocales } from '$lib/locales.server'
import { loadPrivacyContext } from '$lib/privacy.server'

export const load: LayoutServerLoad = async ({ locals, request, url }) => {
  if (locals.tenantResolution === 'unknown-host') {
    // No host/tenant enumeration signal in the message — see architecture-overview.md §8.
    error(404, { message: 'Not found' })
  }
  // TASK-023: a failed tenant resolution is an outage, not a 404 and not a
  // raw 500 — the layout renders the designed outage view (retry, honest
  // copy) over whatever the theme/privacy caches can still serve.
  const outage = locals.tenantResolution === 'backend-unavailable'

  // Phase 05: the directive snapshot and the public notice, resolved with
  // the request's cookies so the consent surface renders before first
  // paint. Null (surfaces simply don't render) when the backend doesn't
  // answer — a missing privacy API must not take the storefront down.
  const privacy = await loadPrivacyContext(request.headers.get('cookie'))

  // Phase 06 SEO data: the canonical URL for *this* page in this locale,
  // plus `hreflang` alternates for every available locale and `x-default`.
  // The default locale is the tenant's; unprefixed URLs are its canonical
  // form (the resolveLocale hook 308s duplicate prefixed URLs to it).
  const availableLocales = getAvailableLocales()
  const defaultLocale = normalizeLocaleTag(locals.tenant?.default_locale) ?? BASE_LOCALE
  const alternates = localeAlternates(url.pathname, defaultLocale, availableLocales)

  return {
    tenant: locals.tenant,
    locale: locals.locale,
    session: locals.session,
    theme: locals.theme,
    privacy,
    outage,
    // Served from the stale-while-revalidate window: cached tenant content
    // that must *say* it may be stale (FR-1111) instead of rendering as
    // normal.
    stale: !outage && locals.tenantStale,
    seo: {
      canonicalPath: alternates.canonicalPath,
      alternates: alternates.alternates,
      ogLocale: LOCALE_CONFIGS[locals.locale].ogLocale,
      availableLocales,
      defaultLocale,
    },
  }
}
