export interface ContentSecurityPolicyOptions {
  /** Origin the backend API is reachable at (e.g. `https://api.example.com`), added to `connect-src`. */
  apiOrigin: string
  /**
   * Origin object/media storage is served from (course images/video use
   * presigned URLs against this origin, not the API origin). Omit when the
   * app has none configured — `https:` in `img-src`/`media-src` already
   * covers any HTTPS storage origin; this only matters for HTTP dev origins
   * (e.g. `http://localhost:9000`) that the scheme wildcard can't match.
   */
  mediaOrigin?: string
  /**
   * Origin Ory Kratos's public API is reachable at (e.g.
   * `http://localhost:4433` in dev, `https://auth.sanvi.app` in prod). The
   * browser calls Kratos directly for self-service flows (phase 02's
   * `@sanvi/auth`) — no backend proxy — so it needs its own `connect-src`
   * allowance distinct from `apiOrigin`. Omit for apps that don't render
   * auth screens (e.g. `marketing`).
   */
  kratosOrigin?: string
  /**
   * Adds `'unsafe-inline'` to `script-src`. Next.js injects inline
   * hydration/bootstrap scripts it doesn't nonce by default, so Next apps
   * need this; static SPA shells that only load scripts by `src` don't.
   */
  allowInlineScripts?: boolean
  /** Adds `'unsafe-eval'` to `script-src` — only for dev-mode tooling that relies on it. */
  allowEval?: boolean
  /**
   * How the policy reaches the browser. `frame-ancestors` is ignored by
   * browsers when the policy is delivered through a `<meta http-equiv>`
   * element, so it is omitted from `'meta'` policies rather than emitted
   * just to be dropped. Clickjacking protection for a meta-delivered app
   * (`admin`, `platform-admin` — see `./vite-plugin.ts`) has to come from a
   * real `Content-Security-Policy` response header set at the CDN/static
   * host in production instead.
   *
   * @default 'header'
   */
  delivery?: 'header' | 'meta'
}

function directive(name: string, ...values: Array<string | false | undefined>): string {
  const tokens = values.filter((value): value is string => Boolean(value))
  return `${name} ${tokens.join(' ')}`
}

/**
 * Single source of truth for the CSP every Sanvi app ships (`marketing`,
 * `storefront` — SvelteKit, response header; `admin`, `platform-admin` — Vite
 * SPA, `<meta http-equiv>`) — all embed the same course-media/billing-elements
 * packages, so they need the same Stripe/YouTube/media-storage allowances;
 * only the deploy-time origins and script-src runtime needs differ per app.
 */
export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const {
    apiOrigin,
    mediaOrigin = '',
    kratosOrigin = '',
    allowInlineScripts = false,
    allowEval = false,
    delivery = 'header',
  } = options

  return [
    directive('default-src', "'self'"),
    directive(
      'script-src',
      "'self'",
      allowInlineScripts && "'unsafe-inline'",
      allowEval && "'unsafe-eval'",
      'https://js.stripe.com',
      'https://*.stripe.com',
    ),
    directive('style-src', "'self'", "'unsafe-inline'"),
    directive(
      'img-src',
      "'self'",
      'data:',
      'blob:',
      'https:',
      mediaOrigin,
      'https://*.stripe.com',
      'https://i.ytimg.com',
      'https://img.youtube.com',
    ),
    directive('media-src', "'self'", 'blob:', 'https:', mediaOrigin),
    directive('font-src', "'self'", 'data:'),
    directive(
      'frame-src',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://*.stripe.com',
      'https://*.link.com',
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://youtu.be',
    ),
    directive(
      'connect-src',
      "'self'",
      apiOrigin,
      mediaOrigin,
      kratosOrigin,
      'https://api.stripe.com',
      'https://*.stripe.com',
      'https://*.link.com',
    ),
    directive('worker-src', "'self'", 'blob:'),
    directive('object-src', "'none'"),
    directive('base-uri', "'self'"),
    directive('form-action', "'self'", 'https://*.stripe.com'),
    delivery === 'header' ? directive('frame-ancestors', "'none'") : undefined,
  ]
    .filter((value): value is string => value !== undefined)
    .join('; ')
}

/** The four apps in the workspace, matching `docs/architecture-overview.md`. */
export type SanviApp = 'marketing' | 'storefront' | 'admin' | 'platform-admin'

export type CspAppPresetOptions = Pick<
  ContentSecurityPolicyOptions,
  'apiOrigin' | 'mediaOrigin' | 'kratosOrigin'
>

/**
 * Per-app defaults for the options `buildContentSecurityPolicy` can't infer:
 * `marketing`/`storefront` are SvelteKit apps that send a real
 * `Content-Security-Policy` response header, so they keep `frame-ancestors`.
 * `admin`/`platform-admin` are Vite SPAs that deliver the policy via
 * `<meta http-equiv>` in dev/preview, where `frame-ancestors` is ignored.
 */
const APP_PRESETS: Record<
  SanviApp,
  Pick<ContentSecurityPolicyOptions, 'allowInlineScripts' | 'allowEval' | 'delivery'>
> = {
  marketing: { allowInlineScripts: false, allowEval: false, delivery: 'header' },
  storefront: { allowInlineScripts: false, allowEval: false, delivery: 'header' },
  admin: { allowInlineScripts: false, allowEval: false, delivery: 'meta' },
  'platform-admin': { allowInlineScripts: false, allowEval: false, delivery: 'meta' },
}

/**
 * `buildContentSecurityPolicy` pinned to one of the four workspace apps —
 * every app declares its CSP through this, never a per-app ad-hoc policy
 * (`docs/architecture-overview.md` non-negotiable #5).
 */
export function buildContentSecurityPolicyForApp(
  app: SanviApp,
  options: CspAppPresetOptions,
): string {
  return buildContentSecurityPolicy({ ...options, ...APP_PRESETS[app] })
}
