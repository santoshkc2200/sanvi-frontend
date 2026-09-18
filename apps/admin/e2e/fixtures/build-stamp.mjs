/**
 * The deterministic release stamp this app's e2e build runs under.
 *
 * The playwright config sets the same three `SANVI_*` env vars on the app's
 * `webServer`, so `vite.config.ts`'s `resolveReleaseStamp` bakes exactly
 * these values into the build — the fixture is what `GET /api/v1/system/build`
 * would report for a build from the same release train. `version` is *not*
 * env-overridable — it comes from the app's package.json, which is what
 * makes the equality assertion mean something: bump the version without
 * updating this fixture and the spec fails with exactly that diff.
 */

export const E2E_BUILD_STAMP = Object.freeze({
  commit: 'e2eb1d9',
  version: '0.1.0',
  built_at: '2026-01-01T00:00:00Z',
  environment: 'local',
})
