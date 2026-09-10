/**
 * Presentation logic for conversion diagnostics (phase 10, TASK-015) — the
 * layer between the tracking contract types and the reason taxonomy: which
 * taxonomy category a suppression or a failure belongs to, which rows offer
 * a retry, and whether the health banner shows at all.
 *
 * Two rules shape everything here:
 *
 * - **Directive answers are read, never re-derived.** The capture gate froze
 *   its answer onto the event's `ConsentSnapshot`; the upload worker freezes
 *   its late answer into a `failed` state whose reason starts
 *   `suppressed_late`. Both are *respected*, not problems to fix — they map
 *   to the directive-decided taxonomy categories and never to an alert
 *   colour. The backend is the authority; the retry endpoint re-checks the
 *   live directive and refuses what this derivation would have hidden.
 * - **The reason taxonomy has seven categories, and the four
 *   directive-decided ones are not failures.** "40 % suppressed by opt-outs"
 *   and "40 % failed to upload" are different conversations; the banner and
 *   the filters keep them separate.
 *
 * The failure-reason strings are backend vocabulary, matched here by their
 * stable prefixes/substrings (`suppressed_late`, click-id mentions, token
 * mentions). An unknown reason falls to `upload_error` — a specific category
 * with its own message, never a generic string.
 */
import type { ConsentSnapshot, ConversionEvent, UploadState } from '@sanvi/api-client'
import { type AdReasonCategory, isDirectiveCategory } from '@sanvi/ui'
import { deniedPurposes, isSuppressed } from './tracking'

/**
 * The taxonomy category a capture-time suppression belongs to, derived from
 * the snapshot's signal source alongside its denied purposes: a GPC browser
 * signal is a browser privacy signal whatever purpose it denied (a
 * GPC-driven sale/share denial is still the browser deciding), a denied
 * sale/share purpose from any other source is a sale/share opt-out (the
 * consent UI records exactly this combination), a universal opt-out
 * mechanism is a sale/share opt-out, and anything else (the consent UI, a
 * tenant API call, a guardian, an import) means measurement consent was
 * simply not granted.
 */
export function suppressionCategory(consent: ConsentSnapshot): AdReasonCategory {
  if (consent.signal_source === 'gpc') return 'browser_privacy_signal'
  if (deniedPurposes(consent).includes('sale_or_share')) return 'opted_out_sale_share'
  if (consent.signal_source === 'uoom') return 'opted_out_sale_share'
  return 'missing_consent'
}

/**
 * Maps a backend upload-failure reason string onto the taxonomy. The
 * backend's reason strings are its own error text (also shown verbatim in
 * the expanded row); these substrings are the stable vocabulary:
 * `suppressed_late` (consent withdrawn since capture), click-id refusals,
 * and token/credential failures. Everything else is an upload error.
 */
export function failureCategory(reason: string): AdReasonCategory {
  if (reason.includes('suppressed_late')) return 'withdrawn_after_capture'
  if (reason.includes('click')) return 'missing_click_id'
  if (reason.includes('token') || reason.includes('credential')) return 'token_expired'
  return 'upload_error'
}

/**
 * One platform state's category, or null while nothing is wrong (pending,
 * uploaded). Retraction states are directive-decided: the subject withdrew
 * after upload and the retraction worker removed the conversion.
 */
export function uploadCategory(state: UploadState): AdReasonCategory | null {
  switch (state.status) {
    case 'pending':
    case 'uploaded':
      return null
    case 'retracted':
    case 'unpropagated':
      return 'withdrawn_after_capture'
    case 'parked':
    case 'failed':
      return failureCategory(state.reason)
  }
}

/**
 * The row's primary category: the suppression category when the capture
 * gate suppressed the event, otherwise the most consequential platform
 * problem (parked — permanently failed after every attempt — before
 * failed), or null when nothing is wrong. This is what the outcome cell's
 * badge renders and what the outcome filter buckets.
 */
export function primaryCategory(event: ConversionEvent): AdReasonCategory | null {
  if (isSuppressed(event.consent)) return suppressionCategory(event.consent)
  const states = Object.values(event.upload_states ?? {})
  const parked = states.find((state) => state.status === 'parked')
  if (parked) return failureCategory(parked.reason)
  const failed = states.find((state) => state.status === 'failed')
  if (failed) return failureCategory(failed.reason)
  for (const state of states) {
    const category = uploadCategory(state)
    if (category) return category
  }
  return null
}

/** Coarse outcome bucket for the filter control. */
export type RowOutcome = 'permitted' | 'suppressed' | 'upload_issues'

/**
 * The row's outcome bucket: directive-suppressed events are their own
 * bucket (a working privacy system), events with a failed or parked upload
 * are the fixable bucket (an incident), and everything else reads as
 * permitted. Late suppressions (`suppressed_late`) are directive decisions
 * even though they sit in a failed state, so they count as suppressed.
 */
export function rowOutcome(event: ConversionEvent): RowOutcome {
  const category = primaryCategory(event)
  if (category && isDirectiveCategory(category)) return 'suppressed'
  if (category) return 'upload_issues'
  return 'permitted'
}

/**
 * Whether the retry control renders for this event — a *client-side
 * courtesy filter* only; the backend's retry endpoint re-checks everything
 * here and refuses otherwise. Retry exists for parked events: a row the
 * gate suppressed has no platform states at all, a late-suppressed one is
 * a directive answer (retrying it would override the subject's withdrawal),
 * and an email-identified subject stored nothing this context can safely
 * re-check — the backend refuses all three, so the button never shows.
 * A known withdrawal on any platform (late suppression, retraction, or an
 * unsupported removal) also hides the control: the worker leaves other
 * platforms' parked states untouched during suppression, so a surviving
 * parked state must not offer a retry the backend will refuse.
 */
export function canRetry(event: ConversionEvent): boolean {
  if (deniedPurposes(event.consent).length > 0) return false
  if (event.subject_key?.kind === 'contact') return false
  const states = Object.values(event.upload_states ?? {})
  if (states.some((state) => uploadCategory(state) === 'withdrawn_after_capture')) return false
  return states.some((state) => state.status === 'parked')
}

/**
 * True when any platform recorded an unsupported removal: the subject
 * withdrew after upload but the platform has no retraction path, so the
 * conversion may still exist there. The taxonomy category stays
 * `withdrawn_after_capture` — this only selects the platform-limitation
 * explanation instead of the automatic-removal one.
 */
export function hasUnpropagatedState(event: ConversionEvent): boolean {
  return Object.values(event.upload_states ?? {}).some((state) => state.status === 'unpropagated')
}

/**
 * Evidence of an actual upload attempt for one platform state. Capture
 * creates `pending` states with `attempt_count: 0` before any worker picks
 * the event up, and the worker can record a `failed: suppressed_late` with
 * `attempt_count: 0` when consent is withdrawn before the first upload —
 * both are never-attempted and must not dilute the failure denominator. A
 * `pending` or `failed` state only counts once its counter moves past zero;
 * every other status implies a prior attempt.
 */
export function wasAttempted(state: UploadState): boolean {
  switch (state.status) {
    case 'pending':
    case 'failed':
      return (state.attempt_count ?? 0) > 0
    case 'parked':
      return (state.attempts ?? 0) > 0
    default:
      return true
  }
}

/** The banner's figures, computed over the currently loaded conversions. */
export interface DiagnosticsHealth {
  /** Events in the window — the denominator for every share below. */
  total: number
  /** Events the capture gate suppressed outright (no upload ever attempted). */
  suppressed: number
  /** …of those: consent for measurement simply not granted. */
  consentAbsent: number
  /** …of those: a sale/share opt-out (universal opt-out mechanism). */
  optedOut: number
  /** …of those: a browser privacy signal (GPC) decided. */
  browserSignal: number
  /** Events with at least one platform upload attempted at all. */
  attempted: number
  /** …of those: at least one platform currently failed or parked. */
  failing: number
  /** `suppressed / total`, or null when nothing has been captured. */
  suppressionShare: number | null
  /** `failing / attempted`, or null when nothing has been attempted. */
  uploadFailureRatio: number | null
}

/**
 * Thresholds the banner speaks. A quarter of the recent window suppressed
 * is a privacy conversation worth surfacing (not an error — the system is
 * working); a fifth of attempted uploads failing is an incident worth
 * escalating to the error tone. The banner needs a minimum window before
 * any ratio means anything.
 */
export const SUPPRESSION_SHARE_THRESHOLD = 0.25
export const UPLOAD_FAILURE_THRESHOLD = 0.2
export const MIN_EVENTS_FOR_BANNER = 4

/** Aggregates the loaded events into the banner's figures. */
export function diagnosticsHealth(events: ConversionEvent[]): DiagnosticsHealth {
  let suppressed = 0
  let consentAbsent = 0
  let optedOut = 0
  let browserSignal = 0
  let attempted = 0
  let failing = 0
  for (const event of events) {
    if (isSuppressed(event.consent)) {
      suppressed += 1
      const category = suppressionCategory(event.consent)
      if (category === 'opted_out_sale_share') optedOut += 1
      else if (category === 'browser_privacy_signal') browserSignal += 1
      else consentAbsent += 1
      continue
    }
    const states = Object.values(event.upload_states ?? {})
    if (!states.some((state) => wasAttempted(state))) continue
    attempted += 1
    if (
      states.some((state) => {
        const category = uploadCategory(state)
        return category !== null && !isDirectiveCategory(category)
      })
    ) {
      failing += 1
    }
  }
  const total = events.length
  return {
    total,
    suppressed,
    consentAbsent,
    optedOut,
    browserSignal,
    attempted,
    failing,
    suppressionShare: total > 0 ? suppressed / total : null,
    uploadFailureRatio: attempted > 0 ? failing / attempted : null,
  }
}

export type HealthBannerLevel = 'none' | 'warning' | 'error'

/**
 * Whether the banner shows, and at which tone: the suppression share and
 * the upload failure ratio cross their own thresholds independently; a
 * failing upload ratio is the incident (error tone), a suppression share
 * alone is the privacy conversation (warning tone). Both are text figures
 * with their own copy — the tone is never the only encoding.
 */
export function healthBannerLevel(health: DiagnosticsHealth): HealthBannerLevel {
  if (health.total < MIN_EVENTS_FOR_BANNER) return 'none'
  const suppressionCrossed =
    health.suppressionShare !== null && health.suppressionShare >= SUPPRESSION_SHARE_THRESHOLD
  const failureCrossed =
    health.uploadFailureRatio !== null && health.uploadFailureRatio >= UPLOAD_FAILURE_THRESHOLD
  if (failureCrossed) return 'error'
  if (suppressionCrossed) return 'warning'
  return 'none'
}
