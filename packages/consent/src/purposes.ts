import type { components } from '@sanvi/api-client'

/**
 * Purpose and directive types are re-exported from the generated OpenAPI
 * types, never redefined here: the backend owns the purpose registry, and a
 * hand-copied union in a second package is how the two drift apart.
 */
export type ProcessingPurpose = components['schemas']['ProcessingPurpose']
export type ConsentModel = components['schemas']['ConsentModel']
export type DirectiveState = components['schemas']['DirectiveState']
export type DirectiveSource = components['schemas']['DirectiveSource']
export type PurposeDirective = components['schemas']['PurposeDirective']
export type DirectiveSnapshot = components['schemas']['DirectiveSnapshot']
export type ConsentChangeRequest = components['schemas']['ConsentChangeRequest']
export type RecordOptOutCommand = components['schemas']['RecordOptOutCommand']
export type JurisdictionRef = components['schemas']['JurisdictionRef']

/** Never consentable, never deniable — the store refuses any decision for it. */
export const ESSENTIAL_PURPOSE: ProcessingPurpose = 'essential'

/** Every purpose a subject may decide. `essential` is deliberately absent. */
export const CONSENTABLE_PURPOSES: readonly ProcessingPurpose[] = [
  'analytics',
  'marketing_email',
  'ads_personalisation',
  'ads_measurement',
  'session_replay',
  'sale_or_share',
  'targeted_advertising',
  'profiling_significant_effects',
  'sensitive_pi_use',
]

/**
 * Purposes a Global Privacy Control signal opts out of, per the CCPA
 * regulations' treatment of GPC as a valid "Do Not Sell or Share" request.
 * A GPC signal never *grants* anything — it is opt-out only.
 */
export const GPC_PURPOSES: readonly ProcessingPurpose[] = ['sale_or_share', 'targeted_advertising']

/**
 * Purposes flipped by the statutory one-click opt-out (the footer's
 * "Do Not Sell or Share My Personal Information" flow). Deliberately
 * excludes `ads_measurement` and `analytics`: those are the measurement
 * purposes US opt-out law does not reach.
 */
export const OPT_OUT_PURPOSES: readonly ProcessingPurpose[] = [
  'sale_or_share',
  'targeted_advertising',
  'profiling_significant_effects',
]

/** Purposes that additionally require `sale_or_share`/`targeted_advertising` to run — ad and audience integrations. */
export function requiresSaleShareConsent(purpose: ProcessingPurpose): boolean {
  return purpose === 'ads_personalisation'
}

export function isConsentable(purpose: ProcessingPurpose): boolean {
  return purpose !== ESSENTIAL_PURPOSE
}
