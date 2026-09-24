# CSP widenings — phases 07–10, enumerated before removal (TASK-024)

You cannot verify the removal of a set you have not written down. This file lists every
Content-Security-Policy relaxation added from phase 07 (theming) through phase 10 (advertising),
with the commit that added it, the reason given at the time, and the disposition TASK-024 decided.
It ends with the per-app differences from the shared preset, so the list accounts for **every**
delta between `@sanvi/csp`'s shared policy and each app's effective policy.

The policy itself is built only by `packages/csp` — every app calls
`buildContentSecurityPolicyForApp` / `buildContentSecurityPolicyDirectivesForApp`
(`docs/architecture-overview.md` non-negotiable #5). All commits below are `sanvi-frontend`.

## Phase 07 — theming

| Widening | Commit | Reason given | Disposition |
| --- | --- | --- | --- |
| `themeAssetOrigin` added to `style-src`, `img-src`, `font-src` (and `connect-src` in the directives builder) | efea2e0 `feat(csp): extend policy with theme asset origin` | Per-tenant theme assets — fonts, images, the per-theme stylesheet — are served from a tenant CDN origin configured at runtime. | **Keep.** A single, deploy-configured origin — not a wildcard. Removing it would break every tenant whose theme assets live on a CDN. |
| Storefront `runtimeConnectSrc` hook rewrites `connect-src` and folds `themeAssetOrigin` into `style-src`/`img-src`/`font-src` on the way out | 469a46e `feat(storefront): allow theme asset origin in CSP`, on the mechanism from ce61c24 | `kit.csp` freezes origins at *build* time; the origins are runtime env. The hook re-adds the configured origins per request. | **Keep.** A delivery mechanism, not a relaxation: it can only add origins the deploy explicitly configured. It now also injects the per-request theme style hash (below). |

Phase 07 also *inherited* the pre-existing `style-src 'unsafe-inline'` (phase 00) as the thing that
made tenant custom-CSS rendering work — see "pre-existing", below.

## Phase 08 — custom domains

**No widening.** No commit in the phase 08 window touched `packages/csp` (verified: `git log
--follow -- packages/csp`). Custom domains are a serving/TLS concern; the storefront policy is
host-agnostic by design — nothing in it names a Sanvi-owned domain.

## Phase 09 — tenant payments

**No widening.** The Stripe origins the Connect embedded components need
(`js.stripe.com`, `hooks.stripe.com`, `*.stripe.com`, `*.link.com`) all predate the phase —
`git log -S "link.com" -- packages/csp` finds only the phase 00 bootstrap (29c8fcf). Phase 09's
commits that mention CSP (69bd96a, 079a775, eb9c322) touch tests and workflow wiring only. The
task-specified headers added in TASK-024 step 1 (HSTS, referrer policy, permissions policy,
`X-Frame-Options`) are tightenings, not widenings.

## Phase 10 — advertising

| Widening | Commit | Reason given | Disposition |
| --- | --- | --- | --- |
| `ads()` preset: `connect-src` `accounts.google.com`, `www.facebook.com` | d3b8422 `feat(advertising): generated client, CSP ads() preset & advertising shell` | "Allowed for connect-src (any in-page fetch during the handoff)". | **Removed (TASK-024).** The handoff is a top-level navigation (`window.location.href` to the backend-minted authorization URL) — CSP does not govern plain navigations — and token exchange is server-to-server by design, so the browser never fetches either host. Speculative at birth; the report-only exercise showed no violation. |
| `ads()` preset: `form-action` (same two hosts) | d3b8422 | "(a handoff may be a form navigation)". | **Removed (TASK-024).** No ad handoff is a form submission — `Connections.svelte` and `OAuthCallback.svelte` navigate with `window.location.href`; `form-action` never fired. |
| `ads()` preset: `img-src` `*.googleusercontent.com`, `*.fbcdn.net` | d3b8422 | Creative previews render from the platforms' own media CDNs. | **Keep.** Campaign creatives genuinely load from these hosts; there is no same-origin proxy for them. |

The preset remains opt-in per app (`admin` only); the storefront's policy stays byte-identical to
its pre-advertising form.

## Pre-existing sources reviewed under this task (not phase 07–10 additions)

| Source | Origin | Disposition |
| --- | --- | --- |
| `style-src 'unsafe-inline'` | phase 00 bootstrap | **Removed (TASK-024).** The one relaxation that made the whole policy say less: an inline-style allowance covers `<style>` elements *and* `style="…"` attributes everywhere, for every tenant. What needed it: (a) the theme runtime's SSR-inlined `<style id="sanvi-theme">` carrying tenant `css_vars` + custom CSS — now allowed by a per-request `sha256` hash of exactly that content, injected by the storefront hook; (b) `style="…"` attributes in `@sanvi/ui` layout/chart components — converted to Svelte `style:` directives, which set styles through CSSOM and are not CSP-governed; (c) `vite dev`'s injected styles — handled by an explicit `devInlineStyles` option that no production preset can reach. |
| `img-src https:` | phase 00 bootstrap | **Keep (reviewed).** Course media uses presigned URLs against whatever storage origin the deploy configures — S3, R2, MinIO — so the scheme wildcard is the honest description of production traffic. `mediaOrigin` pins a specific (dev, HTTP) origin when configured. Pinning the storage origin per environment is the future tightening, owned by whichever task reworks media delivery. |
| `worker-src 'self' 'blob:'` | phase 00 bootstrap | **Keep (reviewed).** Blob workers back media/video tooling; no first-party script origin is implied. |
| `frame-src` Stripe/YouTube/Link hosts | phase 00 bootstrap | **Keep (reviewed).** Embedded billing (phase 04), tenant payments (phase 09) and course video all frame these hosts today. |
| `script-src https://js.stripe.com https://*.stripe.com` | phase 00 bootstrap | **Keep (reviewed).** Stripe.js and the Connect embedded components are loaded from these hosts by every app that embeds the billing/payments packages. |

## Per-app differences from the shared preset (complete accounting)

| App | Delivery | Deltas from the shared policy |
| --- | --- | --- |
| `marketing` | response header, set in `hooks.server.ts` | None beyond deploy origins (`apiOrigin`, optional `mediaOrigin`). No Kratos, no themes, no ads. |
| `storefront` | `kit.csp` header (hash mode for kit's own scripts), rewritten per request by `runtimeConnectSrc` | `kratosOrigin` (phase 02 self-service flows), `mediaOrigin`, `themeAssetOrigin` (phase 07) — all deploy-configured, injected per request. No ads. The per-request theme style hash is injected here. |
| `admin` | `<meta http-equiv>` (injected by `@sanvi/csp/vite`); production CDN sets the real header | `kratosOrigin`; `ads: true` (phase 10 — now `img-src`-only, see above). `frame-ancestors` is omitted because browsers ignore it in a meta tag; the clickjacking protection is `X-Frame-Options: DENY` from the security-headers builder plus the CDN's real CSP header. |
| `platform-admin` | `<meta http-equiv>`, as `admin` | `kratosOrigin` only. No themes, no ads — its advertising surface reads the platform's own API. |

## Enforcement

The tightened policy shipped **report-only first**: the full e2e suites of all four apps ran with a
`securitypolicyviolation` collector installed (`apps/*/e2e/csp.spec.ts`) and recorded **zero
violations** across the enforced tightened policy, in place of the staging cycle this repo has no
host for (see `docs/release/needs-humans.md`). A staging deployment must re-run a real report-only
cycle with a collector endpoint before production enforcement at the edge.
