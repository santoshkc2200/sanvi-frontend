import { currentLocale } from '@sanvi/i18n'
import type { TelemetrySegmentation } from '@sanvi/telemetry'

/**
 * Marketing RUM wiring (TASK-019, FR-1101). The collector ships **wired but
 * not enabled**: there is no collector endpoint and no traffic. Why it is
 * off: `docs/release/needs-humans.md`, "Needs real traffic" — that pointer
 * is the reason, not a TODO.
 *
 * Marketing runs before the visitor faces any consent surface, so the store
 * here is `null` — and `null` means *denied*. Suppression is the default;
 * when marketing gains consent wiring (phase 05's resolver, both modes),
 * pass the real store and the gate takes over.
 *
 * Switching on takes both of:
 *  1. `TELEMETRY_ENABLED` below → `true` — until then the dynamic import is
 *     dead code and the collector never enters the bundle, and
 *  2. an `endpoint` on the init call, once the backend ships a collector
 *     route.
 */
const TELEMETRY_ENABLED = false

let wired = false

/** Called once from the root layout's client effect. */
export function initMarketingTelemetry(): void {
  if (!TELEMETRY_ENABLED || wired || typeof window === 'undefined') return
  wired = true
  void import('@sanvi/telemetry').then(({ detectDeviceClass, initTelemetry }) => {
    initTelemetry({
      enabled: true,
      // endpoint: set when the backend ships a collector route — until then
      // the collector buffers and sends nothing.
      // store: null is *denied* — marketing has no consent wiring yet.
      store: null,
      release: __APP_BUILD__,
      segmentation: (): TelemetrySegmentation => ({
        route: window.location.pathname,
        tenantId: null,
        locale: currentLocale(),
        deviceClass: detectDeviceClass(),
        themeRevision: null,
      }),
    })
  })
}
