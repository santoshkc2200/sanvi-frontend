import { currentLocale } from '@sanvi/i18n'
import { theme } from '@sanvi/theme-runtime'
import { get } from 'svelte/store'
import type { TelemetrySegmentation } from '@sanvi/telemetry'
import { getConsent } from './consent.svelte'

/**
 * Storefront RUM wiring (TASK-019, FR-1101). The collector ships **wired but
 * not enabled**: there is no collector endpoint and no traffic, so collection
 * stays off. Building it directive-gated from the first line is the point —
 * a collector wired to ship first and ask permission later is how a month of
 * data becomes a month of data that has to be thrown away. Enabling it later
 * is configuration, not a project. Why it is off:
 * `docs/release/needs-humans.md`, "Needs real traffic" — that pointer is the
 * reason, not a TODO.
 *
 * Switching on takes both of:
 *  1. `TELEMETRY_ENABLED` below → `true` — until then the dynamic import is
 *     dead code and the collector never enters the bundle, and
 *  2. an `endpoint` on the init call, once the backend ships a collector
 *     route.
 * Even with both on, nothing is emitted unless the phase-05 directive
 * resolver allows the `analytics` purpose in this jurisdiction: EU opt-in
 * denies by default, US notice-and-opt-out allows until an opt-out. The
 * store is consulted live, so a revocation mid-session stops collection and
 * drops whatever was buffered.
 */
const TELEMETRY_ENABLED = false

let wired = false

/** Called once from the root layout's client effect, after consent init. */
export function initStorefrontTelemetry(): void {
  if (!TELEMETRY_ENABLED || wired || typeof window === 'undefined') return
  wired = true
  void import('@sanvi/telemetry').then(({ detectDeviceClass, initTelemetry }) => {
    initTelemetry({
      enabled: true,
      // endpoint: set when the backend ships a collector route — until then
      // the collector buffers and sends nothing.
      store: getConsent(),
      release: __APP_BUILD__,
      segmentation: (): TelemetrySegmentation => ({
        route: window.location.pathname,
        // Storefront tenants resolve per-request Host on the server; the
        // browser holds no tenant id to attribute — null is the honest value.
        tenantId: null,
        locale: currentLocale(),
        deviceClass: detectDeviceClass(),
        themeRevision: get(theme)?.revision ?? null,
      }),
    })
  })
}
