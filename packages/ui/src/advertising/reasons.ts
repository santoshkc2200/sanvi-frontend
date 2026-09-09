/**
 * The conversion-diagnostics reason taxonomy (phase 10, TASK-015, FR-1009).
 *
 * Seven categories, and the split between the first four and the last three
 * is the whole point of the screen: a suppression that a privacy directive
 * decided is a *working privacy system*, not an incident — it must never
 * share a colour, a banner, or a sentence with a delivery failure. The
 * categories are therefore two families:
 *
 * - **Respect (directive-decided, not a problem to fix):** `missing_consent`
 *   (measurement purpose not granted), `opted_out_sale_share` (US
 *   sale/share opt-out, including one expressed via GPC's uoom sibling),
 *   `browser_privacy_signal` (a browser-level signal such as GPC decided),
 *   `withdrawn_after_capture` (consent withdrawn after the event was
 *   captured — retraction, or a late suppression at upload time).
 * - **Fix (delivery problems a tenant can act on):** `missing_click_id`
 *   (the platform cannot attribute without it), `token_expired`
 *   (reconnect), `upload_error` (transient/platform-side failure).
 *
 * This module knows only the *taxonomy*; how a wire object maps onto it
 * lives with the data layer (the admin app's diagnostics lib), because
 * `@sanvi/ui` imports no data layer — same rule as `health.ts`.
 */

export const AD_REASON_CATEGORIES = [
  'missing_consent',
  'opted_out_sale_share',
  'browser_privacy_signal',
  'withdrawn_after_capture',
  'missing_click_id',
  'token_expired',
  'upload_error',
] as const

export type AdReasonCategory = (typeof AD_REASON_CATEGORIES)[number]

/** The directive-decided categories: working privacy, not an incident. */
export const AD_DIRECTIVE_CATEGORIES: readonly AdReasonCategory[] = [
  'missing_consent',
  'opted_out_sale_share',
  'browser_privacy_signal',
  'withdrawn_after_capture',
]

/** True for a category the tenant must respect rather than fix. */
export function isDirectiveCategory(category: AdReasonCategory): boolean {
  return AD_DIRECTIVE_CATEGORIES.includes(category)
}

/**
 * Badge tone per category. Directive-decided categories render neutral —
 * deliberately *not* an alert colour, because "40 % of conversions were
 * suppressed by opt-outs" is a working privacy system, while "40 % failed
 * to upload" is an incident. The label text always carries the meaning;
 * tone is never the only encoding.
 */
export const AD_REASON_TONES: Record<AdReasonCategory, 'neutral' | 'warning' | 'error'> = {
  missing_consent: 'neutral',
  opted_out_sale_share: 'neutral',
  browser_privacy_signal: 'neutral',
  withdrawn_after_capture: 'neutral',
  missing_click_id: 'warning',
  token_expired: 'warning',
  upload_error: 'error',
}
