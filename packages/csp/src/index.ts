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
  /** Origin theme CDN assets (fonts, images, per-theme stylesheet) are served from. */
  themeAssetOrigin?: string
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
  /**
   * Folds the ad-platform origins from the {@link ads} preset into the
   * policy — OAuth handoff hosts (`connect-src`, `form-action`) and creative
   * preview CDNs (`img-src`). Opt-in per app: the admin console turns it on
   * (its `APP_PRESETS` entry), the storefront deliberately does not, so the
   * storefront policy is byte-identical to its pre-advertising form — first
   * party tracking is same-origin by design and needs no third-party origin.
   *
   * @default false
   */
  ads?: boolean
}

/**
 * The ad-platform origins phase 10 (advertising) needs, as one named preset
 * rather than per-app ad-hoc additions, so `admin` and `storefront` cannot
 * drift apart.
 *
 * - **OAuth handoff** — the browser is redirected to the platform's
 *   authorization page at an URL the *backend* mints (signed `state`
 *   included; the frontend never constructs it and never sees a token), so
 *   the origins are the two authorization hosts, allowed for `form-action`
 *   (a handoff may be a form navigation) and `connect-src` (any in-page
 *   fetch during the handoff). The token endpoints
 *   (`oauth2.googleapis.com`, `graph.facebook.com`) are deliberately absent:
 *   token exchange is server-to-server, and a browser that could reach them
 *   would mean client-side token handling, which the design forbids.
 * - **Creative previews** — campaign creatives are rendered from the
 *   platforms' own media CDNs: Google serves ad assets from
 *   `googleusercontent.com`, Meta from `fbcdn.net`.
 *
 * Never adds anything to `script-src` or `style-src` — no `unsafe-inline`
 * widening, no platform script is ever loaded into Sanvi pages (asserted in
 * the package tests).
 */
export function ads(): Partial<CspDirectives> {
  return {
    'connect-src': ['https://accounts.google.com', 'https://www.facebook.com'],
    'img-src': ['https://*.googleusercontent.com', 'https://*.fbcdn.net'],
    'form-action': ['https://accounts.google.com', 'https://www.facebook.com'],
  }
}

function directive(name: string, ...values: Array<string | false | undefined>): string {
  const tokens = values.filter((value): value is string => Boolean(value))
  return `${name} ${tokens.join(' ')}`
}

/** SvelteKit `kit.csp.directives` shape: directive name → source list (empty-string sources dropped). */
export type CspDirectives = Record<string, string[]>

function directiveSources(
  name: string,
  ...values: Array<string | false | undefined>
): CspDirectives {
  return {
    [name]: values.filter((value): value is string => Boolean(value)),
  }
}

/**
 * The same policy as {@link buildContentSecurityPolicy}, in SvelteKit's
 * `kit.csp.directives` shape. SvelteKit apps that render per-request HTML
 * should prefer this form: with `kit.csp` configured, SvelteKit stamps its
 * own inline hydration/bootstrap scripts with a nonce (mode `'nonce'`) and
 * emits the header itself — a statically-built header from
 * {@link buildContentSecurityPolicy} cannot know that nonce, and would
 * block the very scripts the framework needs.
 */
export function buildContentSecurityPolicyDirectives(
  options: ContentSecurityPolicyOptions,
): CspDirectives {
  const {
    apiOrigin,
    mediaOrigin = '',
    themeAssetOrigin = '',
    kratosOrigin = '',
    allowInlineScripts = false,
    allowEval = false,
    delivery = 'header',
    ads: adsOrigins = false,
  } = options
  const adPreset = adsOrigins ? ads() : {}

  return {
    ...directiveSources('default-src', "'self'"),
    ...directiveSources(
      'script-src',
      "'self'",
      allowInlineScripts && "'unsafe-inline'",
      allowEval && "'unsafe-eval'",
      'https://js.stripe.com',
      'https://*.stripe.com',
    ),
    ...directiveSources('style-src', "'self'", "'unsafe-inline'", themeAssetOrigin),
    ...directiveSources(
      'img-src',
      "'self'",
      'data:',
      'blob:',
      'https:',
      mediaOrigin,
      themeAssetOrigin,
      'https://*.stripe.com',
      'https://i.ytimg.com',
      'https://img.youtube.com',
      ...(adPreset['img-src'] ?? []),
    ),
    ...directiveSources('media-src', "'self'", 'blob:', 'https:', mediaOrigin),
    ...directiveSources('font-src', "'self'", 'data:', themeAssetOrigin),
    ...directiveSources(
      'frame-src',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://*.stripe.com',
      'https://*.link.com',
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://youtu.be',
    ),
    ...directiveSources(
      'connect-src',
      "'self'",
      apiOrigin,
      mediaOrigin,
      themeAssetOrigin,
      kratosOrigin,
      'https://api.stripe.com',
      'https://*.stripe.com',
      'https://*.link.com',
      ...(adPreset['connect-src'] ?? []),
    ),
    ...directiveSources('worker-src', "'self'", 'blob:'),
    ...directiveSources('object-src', "'none'"),
    ...directiveSources('base-uri', "'self'"),
    ...directiveSources(
      'form-action',
      "'self'",
      'https://*.stripe.com',
      ...(adPreset['form-action'] ?? []),
    ),
    ...(delivery === 'header' ? directiveSources('frame-ancestors', "'none'") : {}),
  }
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
    themeAssetOrigin = '',
    kratosOrigin = '',
    allowInlineScripts = false,
    allowEval = false,
    delivery = 'header',
    ads: adsOrigins = false,
  } = options
  const adPreset = adsOrigins ? ads() : {}

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
    directive('style-src', "'self'", "'unsafe-inline'", themeAssetOrigin),
    directive(
      'img-src',
      "'self'",
      'data:',
      'blob:',
      'https:',
      mediaOrigin,
      themeAssetOrigin,
      'https://*.stripe.com',
      'https://i.ytimg.com',
      'https://img.youtube.com',
      ...(adPreset['img-src'] ?? []),
    ),
    directive('media-src', "'self'", 'blob:', 'https:', mediaOrigin),
    directive('font-src', "'self'", 'data:', themeAssetOrigin),
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
      ...(adPreset['connect-src'] ?? []),
    ),
    directive('worker-src', "'self'", 'blob:'),
    directive('object-src', "'none'"),
    directive('base-uri', "'self'"),
    directive('form-action', "'self'", 'https://*.stripe.com', ...(adPreset['form-action'] ?? [])),
    delivery === 'header' ? directive('frame-ancestors', "'none'") : undefined,
  ]
    .filter((value): value is string => value !== undefined)
    .join('; ')
}

/** The four apps in the workspace, matching `docs/architecture-overview.md`. */
export type SanviApp = 'marketing' | 'storefront' | 'admin' | 'platform-admin'

export type CspAppPresetOptions = Pick<
  ContentSecurityPolicyOptions,
  'apiOrigin' | 'mediaOrigin' | 'kratosOrigin' | 'themeAssetOrigin'
>

/**
 * Per-app defaults for the options `buildContentSecurityPolicy` can't infer:
 * `marketing`/`storefront` are SvelteKit apps that send a real
 * `Content-Security-Policy` response header, so they keep `frame-ancestors`.
 * `admin`/`platform-admin` are Vite SPAs that deliver the policy via
 * `<meta http-equiv>` in dev/preview, where `frame-ancestors` is ignored.
 *
 * Only `admin` opts into the {@link ads} preset: it is where OAuth handoff
 * and creative previews render. `platform-admin`'s advertising surface is a
 * read-only health overview served by our own API (no platform origin is
 * contacted), and `marketing`/`storefront` have no advertising surface at
 * all — the storefront's policy must stay byte-identical to its
 * pre-advertising form.
 */
const APP_PRESETS: Record<
  SanviApp,
  Pick<ContentSecurityPolicyOptions, 'allowInlineScripts' | 'allowEval' | 'delivery' | 'ads'>
> = {
  marketing: { allowInlineScripts: false, allowEval: false, delivery: 'header', ads: false },
  storefront: { allowInlineScripts: false, allowEval: false, delivery: 'header', ads: false },
  admin: { allowInlineScripts: false, allowEval: false, delivery: 'meta', ads: true },
  'platform-admin': { allowInlineScripts: false, allowEval: false, delivery: 'meta', ads: false },
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

/**
 * {@link buildContentSecurityPolicyDirectives} pinned to one of the four
 * workspace apps — the SvelteKit-app flavour of "every app declares its CSP
 * through this package".
 */
export function buildContentSecurityPolicyDirectivesForApp(
  app: SanviApp,
  options: CspAppPresetOptions,
): CspDirectives {
  return buildContentSecurityPolicyDirectives({ ...options, ...APP_PRESETS[app] })
}
