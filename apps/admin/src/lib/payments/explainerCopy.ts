/**
 * Single source for the "what happens when you connect" explainer copy.
 *
 * Stripe collects the business details, payouts go to the tenant's own bank
 * account, Sanvi never holds the money. This module is the canonical
 * definition — TASK-003 imports these keys for the embedded onboarding
 * screen rather than duplicating the strings.
 *
 * The actual user-facing strings live in `packages/i18n/messages/en/admin.json`
 * and `ja/admin.json` under `admin.payments.explainerTitle` /
 * `admin.payments.explainerBody`; this file just re-exports the keys so
 * both tasks reference the same identifiers.
 */
export const EXPLAINER_TITLE_KEY = 'admin.payments.explainerTitle' as const
export const EXPLAINER_BODY_KEY = 'admin.payments.explainerBody' as const

export const EXPLAINER_COPY_KEYS = {
  title: EXPLAINER_TITLE_KEY,
  body: EXPLAINER_BODY_KEY,
} as const
