import { sendConversionBeacon } from '@sanvi/api-client'
import type { TrackConversionRequest } from '@sanvi/api-client'
import { getAppEnv } from '$lib/env'
import { readStashedClickIds } from './click-ids'
import type { CheckoutView } from '$lib/checkout/types'

/**
 * The storefront conversion beacon (phase 10, slice 10.5).
 *
 * Same-origin by design: the beacon posts to the tenant's own verified
 * domain, so it needs no CSP relaxation — if that ever stops being true,
 * stop and reopen the design rather than adding an origin. It adds
 * essentially nothing to the bundle and never blocks the confirmation
 * render: the caller hands the payload over and returns immediately; the
 * send itself is fire-and-forget whose failures are indistinguishable from
 * the endpoint's uninformative `202`.
 *
 * The `event_id` is the server-issued `conversion_event_id` from the
 * phase-09 confirmation payload — never minted here. A client-generated id
 * would defeat the platform-side dedupe that makes a refreshed confirmation
 * page safe; exactly-once emission across refreshes is `recordConversionOnce`'s
 * job, layered on top of the backend's own idempotent insert.
 */

export const TRACK_ENDPOINT_PATH = '/api/v1/public/track'

/** The one event the storefront beacon fires, mapped per platform in the
 * admin's tracking matrix (`purchase` → each platform's conversion action). */
export const PURCHASE_EVENT_NAME = 'purchase'

export function buildPurchaseBeacon(
  checkout: CheckoutView,
  conversionEventId: string,
): TrackConversionRequest {
  return {
    // Server-issued, exactly once per order when paid — passed through
    // verbatim, never generated.
    event_id: conversionEventId,
    event_name: PURCHASE_EVENT_NAME,
    value: checkout.amount_minor,
    currency: checkout.currency,
    order_ref: checkout.reference,
    click_ids: readStashedClickIds(),
  }
}

/**
 * Sends the beacon to the same-origin track endpoint and resolves without
 * waiting for an answer. Never throws, never blocks, never retries — the
 * endpoint answers `202` with an uninformative body regardless of outcome,
 * and the backend's idempotent insert makes a lost beacon recoverable in a
 * future slice rather than worth a client-side retry loop.
 */
export function fireConversionBeacon(payload: TrackConversionRequest): void {
  if (typeof window === 'undefined') return
  try {
    const url = `${window.location.origin}${TRACK_ENDPOINT_PATH}`
    const siteKey = getAppEnv().trackingSiteKey
    void sendConversionBeacon({ url, body: payload, siteKey })
  } catch {
    // Fire-and-forget: a thrown send is the same silence as a 202.
  }
}
