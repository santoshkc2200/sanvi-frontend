import { currentLocale } from '@sanvi/i18n'
import type { TelemetrySegmentation } from '@sanvi/telemetry'

/**
 * Platform console RUM wiring (TASK-019, FR-1101). The collector ships
 * **wired but not enabled**: there is no collector endpoint and no traffic.
 * Why it is off: `docs/release/needs-humans.md`, "Needs real traffic" —
 * that pointer is the reason, not a TODO.
 *
 * The platform console is an authenticated operator surface with no consent
 * resolver wired, so the store here is `null` — and `null` means *denied*.
 * Suppression is the default.
 *
 * Switching on takes both of:
 *  1. `TELEMETRY_ENABLED` below → `true` — until then the dynamic import is
 *     dead code and the collector never enters the bundle, and
 *  2. an `endpoint` on the init call, once the backend ships a collector
 *     route.
 */
const TELEMETRY_ENABLED = false

let wired = false

/**
 * The route source `App.svelte` registers once its `Router` exists — the
 * router is created after telemetry init, and only it can name the matched
 * route pattern. Until registration (when nothing can emit anyway) and for
 * not-found routes, the raw path is the honest fallback.
 */
let routeSource: (() => string) | null = null

/** Called by `App.svelte` right after `createRouter`. */
export function setPlatformAdminTelemetryRouteSource(source: () => string): void {
  routeSource = source
}

/** Called once from `main.ts`'s boot, browser-only. */
export function initPlatformAdminTelemetry(): void {
  if (!TELEMETRY_ENABLED || wired || typeof window === 'undefined') return
  wired = true
  void import('@sanvi/telemetry').then(({ detectDeviceClass, initTelemetry }) => {
    initTelemetry({
      enabled: true,
      // endpoint: set when the backend ships a collector route — until then
      // the collector buffers and sends nothing.
      // store: null is *denied* — the console has no consent resolver yet.
      store: null,
      release: __APP_BUILD__,
      segmentation: (): TelemetrySegmentation => ({
        // The matched route pattern, not the raw path — ids embedded in a
        // route would give every visit its own segmentation bucket. See
        // `setPlatformAdminTelemetryRouteSource`.
        route: routeSource?.() ?? window.location.pathname,
        // Platform operators sit above every tenant — there is no active one.
        tenantId: null,
        locale: currentLocale(),
        deviceClass: detectDeviceClass(),
        // The console renders on the default token set, not a published theme.
        themeRevision: null,
      }),
    })
  })
}
