/**
 * The frontend's security headers, specified rather than incidental
 * (NFR-1114) — the same header set the backend's
 * `crates/platform/http/src/middleware.rs` `SecurityHeaders` layer puts on
 * every API response, consumed here so an HTML app answers with the same
 * posture the API does. The CSP itself is *not* part of this record: it has
 * its own builder (see `./index.ts`) because its delivery differs per app
 * (response header for the SvelteKit apps, `<meta http-equiv>` for the
 * Vite SPAs), while these headers are plain response headers everywhere.
 *
 * A header removed from {@link buildSecurityHeaders} is a test failure, not
 * a silent regression — `__tests__/security-headers.test.ts` asserts the
 * exact set against the backend's specified values.
 */

/** The headers every Sanvi app ships, independent of the CSP. */
export interface SanviSecurityHeaders {
  'x-content-type-options': 'nosniff'
  'referrer-policy': 'same-origin'
  'x-frame-options': 'DENY'
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  /**
   * Present only when {@link BuildSecurityHeadersOptions.hsts} is set —
   * never on a localhost origin. HSTS is per *hostname* (no port), so a
   * dev server on `localhost:5173` sending it would pin `localhost` to
   * HTTPS for every other local server too; the backend gates it the same
   * way. Production sets it at the edge: the Node adapter / CDN in front
   * of the SvelteKit apps, the static host in front of the SPAs.
   */
  'strict-transport-security'?: 'max-age=31536000; includeSubDomains'
}

export interface BuildSecurityHeadersOptions {
  /**
   * Emit `Strict-Transport-Security`. Turn this on for any non-localhost
   * origin — see the field doc above for why localhost must stay off.
   * @default false
   */
  hsts?: boolean
}

/** Hostnames a dev server runs on — HSTS must never be emitted for these. */
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])

/**
 * True when the request's `Host`/origin hostname is a localhost form —
 * the storefront/marketing hooks use this to keep HSTS off in local dev
 * without every caller hard-coding the list.
 */
export function isLocalhostHost(host: string | undefined | null): boolean {
  if (!host) return false
  // Strip an explicit port (`localhost:5173`); IPv6 literals keep their
  // brackets, which the set above includes.
  const hostname = host.includes('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]
  return LOCALHOST_HOSTNAMES.has(hostname?.toLowerCase() ?? '')
}

/**
 * The backend-specified security headers for an HTML response — exact
 * values, so a snapshot can assert them verbatim.
 */
export function buildSecurityHeaders(
  options: BuildSecurityHeadersOptions = {},
): SanviSecurityHeaders {
  const { hsts = false } = options
  const headers: SanviSecurityHeaders = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  }
  if (hsts) {
    headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains'
  }
  return headers
}

/**
 * {@link buildSecurityHeaders} flattened to the `Record<string, string>`
 * Vite's `server.headers` / `preview.headers` config wants — the Vite SPA
 * apps (`admin`, `platform-admin`) hand this to their dev/preview servers,
 * which are the only header-setting surface a static SPA owns locally; the
 * production static host/CDN sets the same record from this same builder.
 */
export function securityHeadersRecord(
  options: BuildSecurityHeadersOptions = {},
): Record<string, string> {
  return { ...buildSecurityHeaders(options) }
}
