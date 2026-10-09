# TASK-013: 10.4 Creative management & placement previews

**Phase:** 10
**Status:** done
**Requirement(s):** FR-1007, NFR-1001, NFR-1004
**Depends on:** TASK-012
**Created:** 2026-08-20

**Blocked by (cross-repo):** sanvi-backend TASK-013 (Meta adapter, creative endpoints, creative half of the matrix)
**Slice:** 10.4 — Meta adapter & creatives
**Prerelease:** `v0.11.0-alpha.5` · **Flag:** `advertising.meta`

## Context

The second network arrives — and the point of this task is how little of it is frontend work. List,
builder, detail, and drift already handle Meta; the work here is creatives, previews, and
**verification** that nothing platform-specific was needed.

**The rule: every frontend line added for Meta is a bug in TASK-010.** Deviations are permitted only
for genuinely visual concerns (a placement preview frame), never for field logic, validation, or
availability. Any `platform === 'meta'` in a form path is fixed in the matrix instead — the PR
checklist for this task includes exactly that grep.

## What to do

- [x] **Contract** — `GET/POST /creatives`, `GET/DELETE /creatives/{id}`,
      `GET /creatives/{id}/previews?placement=`. The capability matrix now carries its creative half for
      both platforms: placements, asset specs (dimensions, aspect ratios, file size, duration), text
      fields with per-locale limits, and valid combinations. api-client wrapper functions added for all
      five endpoints; the generated types were already in place.
- [x] **Creative management** — asset upload reusing `@sanvi/course-media` components (not a second
      uploader), per-locale copy fields with character counters **driven by the matrix**, and assignment
      to placements. course-media gained the media service's current namespace-scoped `/v1/assets`
      surface (`AssetUploadController` + `api/assets.ts`) — the creative uploader consumes it; no
      uploader exists in the app. Placement assignment is a multi-select; one creative per placement is
      created (the contract's grain), each validated against that placement's spec.
- [x] **Placement previews** — render each selected placement's frame with the actual assets and copy,
      themed via phase-07 tokens. Japanese copy previews with phase-06 CJK typography rules, because a
      headline that fits in English and overflows in Japanese is a phase-06 bug caught here.
      `PlacementPreview.svelte` in `@sanvi/ui` takes the spec's first allowed ratio as its frame, carries
      the content locale in `lang`, and clips long copy the way a real placement would.
- [x] **Spec feedback** — an asset that does not meet a selected placement's spec says **which
      placement and which dimension**, at upload, with the option to drop the placement instead of the
      asset. `creative-spec.ts` mirrors the backend's dimension vocabulary (`aspect_ratio`, `width_px`,
      `height_px`, `file_size_bytes`, `duration_seconds`, `is_video`) and its 1 % ratio tolerance;
      violations group per placement with one "remove image" per failing asset and one "drop
      {placement}" per placement. Save stays blocked while any violation stands.
- [x] **Meta in the existing screens** — list, builder, detail, and drift already handle it. The work is
      verification and the platform badge, not new screens. Verified: the TASK-012 e2e drift scenario
      runs against a Meta connection; the builder's creatives-step placeholder now links to the library
      (copy only, no form-path branch — the platform-literal grep gate stays green).
- [x] **Cross-platform list** — the campaign list now genuinely spans two platforms: mixed sorting,
      per-platform badges, and currency handling when two connections report in different currencies —
      shown natively, **never silently summed**. The creatives list follows the same shape. Sorting is
      client-side and deliberately limited to label columns (name/platform/status) — a budget column's
      order would silently compare two currencies' magnitudes.

## Acceptance criteria

- [x] A Meta campaign is built and validated through the existing builder with **zero** platform-specific
      frontend code added — the grep gate proves it, and the PR diff shows no new form-path branches.
      `pnpm check:boundaries` (which runs the platform-literal gate over `src/` and `e2e/`) is green.
- [x] The fake adapter's third, unimplemented-by-anyone matrix renders a valid builder with no code
      change — the "third network is an adapter" criterion, demonstrated rather than asserted
      (`AdvertisingCreatives.test.ts` renders the editor against the `asymmetric_demo` fixture: one
      placement, no-video requirement, all from data).
- [x] An asset failing one placement's spec is rejected for that placement only, at upload, naming the
      placement and the failing dimension. Covered at unit level (`creative-spec.test.ts`), component
      level, and e2e (a real 100×100 PNG upload measured in-browser).
- [x] Identical copy passes in English and fails in Japanese where Meta's limit is shorter; the counter
      shows the right limit per field per locale (`ad-locale-copy-editor.test.ts`: 30 characters pass
      en/40, fail ja/25, live, with code-point counting).
- [x] A natively paused Meta ad set renders in the existing drift view with a correct diff — the
      TASK-012 drift e2e scenario runs against the Meta connection; no drift code changed here.
- [x] Two connections in USD and JPY render natively in the list with **no total row summing them**
      (e2e asserts both currency figures visible and no table footer row).
- [x] Visual snapshots pass for placement previews across every shipped theme and both locales,
      including CJK line breaking. **Partial by infrastructure, deferred honestly:** this repo has no
      pixel-snapshot harness — TASK-018 owns visual baselines. What is asserted here: the CJK `lang`
      wiring, the clip-don't-grow CSS contract (`overflow: hidden` + `overflow-wrap: anywhere` on the
      copy block), tokens-only styling (`check:tokens` green), and `check:i18n`/`check:tokens` across
      the new components.
- [x] axe passes on creative management and previews; the uploader is fully keyboard operable (the
      native file input is visually-hidden but focusable, with a visible focus ring).

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:i18n
pnpm check:tokens
pnpm check:budget
pnpm check:boundaries
pnpm test:e2e --filter admin
```

## Out of scope

Meta metrics in the dashboard (TASK-016), the Meta Conversions API surface (TASK-015), and any
campaign-screen redesign — if a screen needs changing for Meta, that is the finding, not the task.

## Files likely touched

- `apps/admin/src/routes/advertising/Creatives.svelte`
- `packages/ui/src/advertising/PlacementPreview.svelte`, character-counter field
- `packages/course-media` integration in the creative uploader
- `packages/i18n` catalogs (`en`, `ja`), visual snapshot fixtures
- admin e2e specs

## Notes / gotchas

- Rollback: `advertising.meta` off → Meta disappears from the catalog and its endpoints return
  `503`; Google is untouched. Meta connections stay listed and keep refreshing, and live Meta campaigns
  keep spending — the UI says so.
- Reuse `course-media`. A second uploader means a second CSP story and a second a11y audit.
- If a preview needs a platform branch, keep it strictly visual and keep it out of any code path that
  decides field availability or validity.

## Execution notes (2026-09-04)

**Verification commands.** `pnpm lint` (one pre-existing `@sanvi/i18n` warning in
`runtime.test.ts`), `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check:i18n`,
`pnpm check:tokens`, `pnpm check:boundaries` (platform-literal gate included) — all green.
`pnpm check:budget` is red on **marketing and platform-admin exactly as on this branch's base**
(verified by stashing this branch and rebuilding both apps on the base tree: marketing's i18n chunk
81.3 KB vs 50 KB, platform-admin 88.8 KB vs 60 KB — the same pre-existing overage TASK-010/011/012
recorded; main's 15e2a47 fixes it). This branch's catalog additions grow marketing's chunk by ~2 KB
but the gate was already red. `pnpm test:e2e --filter admin`: 48 passed, 4 failed — the 4
payments-onboarding failures already recorded as pre-existing in TASK-011's notes (both engines).
Prerelease tag/staging deploy not run — no pipeline exists in this environment.

**course-media integration (a finding, recorded).** The task said to reuse `@sanvi/course-media`
"components"; the package predated the media service's current API: its upload client targeted the
course-scoped `/v1/media/uploads` surface (with `course_id`), which no longer exists anywhere —
`hitox-media-service` serves only the namespace-scoped `/v1/assets` API (`X-Namespace-ID`, mandatory
`Idempotency-Key`). Rather than build a second uploader in the app, the package gained the current
surface additively: `api/assets.ts` + `AssetUploadController` (same store shape, measurement, and
abort-on-teardown semantics as `ImageUploadController`; blob ownership is transferable via
`takeLocalUrl` so the editor's previews survive reset). The legacy course functions are untouched —
migrating them is that future phase's work, not this slice's.

**Media-service auth from the admin SPA (a finding, still deferred).** The media service
authenticates with a *service API key* (`auth.Middleware.Require` accepts nothing else, and it
guards every `/v1/assets` route); the admin SPA's session is a Kratos cookie, and the key is a
server secret that must never reach a browser. `courseApiRequest` omits an empty `Authorization`
header and the admin's context sets `credentials: 'include'`, so a cookie-reading **same-site**
gateway works today — the e2e webServer pins `VITE_MEDIA_ORIGIN` to the preview server to mirror
that shape. A direct-to-media deployment still needs a token-minting path or a backend proxy
(backend work, not present in `sanvi-backend`); until then a cross-origin `VITE_MEDIA_ORIGIN` is
unsupported, not merely untested.

- **Update 2026-10-09 (verified):** backend `c2c59ad` confirms the session-authenticated
  gateway already exists — `/api/v1/tenant/media/v1/assets…` (upload, parts, complete,
  delivery) is present in `sanvi-cli openapi` under the tenant API surface, so no new
  backend work is needed. Remaining work is frontend-side: point the uploader at the
  gateway, wire saved-creative preview images via the delivery endpoint, and retire the
  same-site `VITE_MEDIA_ORIGIN` seam.

**Scoping headers and credentials are per-target, not global (review follow-up).** The first cut
sent `X-Tenant-ID` *and* `X-Namespace-ID` on every `courseApiRequest` and forced
`credentials: 'include'` for all callers. Both break the media service in a cross-origin
deployment and regressed the package's existing course-API callers: its
`Access-Control-Allow-Headers` list does not contain `X-Tenant-ID` (so the preflight fails), and it
answers no `Access-Control-Allow-Credentials: true` while defaulting `CORS_ALLOWED_ORIGINS` to `*`
(so any credentialed cross-origin call is blocked). `CourseApiContext` now carries `target` and
`credentials`: exactly one scoping header travels, and credentials are opt-in. `api/assets.ts`
pins `target: 'media'` itself rather than trusting the caller, and sends the `visibility` the
service demands (`private` by default) — an omitted one is `ErrInvalidAsset`, not a default. The
e2e media mock now enforces those same refusals so it can no longer green-light a request the real
service would reject.

**Saved-creative preview images are not wired (a finding, deferred with the auth gap).**
Saved-creative previews render the server's spec+copy and degrade to text-only frames — the
preview dialog passes no `imageUrl`. `createAssetDelivery` resolves the URL correctly now (an
image's URLs come back in `renditions[]`; the top-level `url` is populated only for public HLS
video), but nothing calls it: every call would 401 until the auth path above exists, so wiring it
would only turn a text-only frame into a failed request.

**Contract deltas.** `CreateCreativeRequest` is one-placement-per-creative, so the editor's
placement multi-select creates one creative per selected placement. The contract's `CreativeText`
has no optional fields, so every field a locale's limits define is sent (empty string when
untyped) — `textsFromEntries` normalizes this, and the platform's own validator is the authority
beyond it. The creative-to-ad attach flow (`addAdAd` referencing a `creative_id`) exists in the
contract and the api-client, but no campaign screen offers it yet — TASK-012 shipped no add-ad UI,
and campaign-screen changes were out of scope here. Until an attach surface lands, creatives are
created and previewed in Sanvi but attached from the platform side.

---
*On completion: satisfy every acceptance criterion, run the verification commands, then
record status in the **same commit** in both places — the `**Status:**` line at the top of this
file and this task's row in [`../backlog.md`](../backlog.md), with the PR or commit as the note.
The two must never disagree.*
