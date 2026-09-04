/**
 * Presentation logic for conversion tracking (phase 10, TASK-014) — the
 * layer between the tracking contract types and the localized UI: the
 * directive outcome a conversion row displays, derived only from the event's
 * frozen consent snapshot.
 *
 * The backend's directive gate is the authority on upload; this derivation
 * only has to *read* the snapshot the gate froze onto the event. By
 * construction the gate denies the whole event when any asked purpose is
 * denied, and records the denying purpose in `answers` and its directive's
 * signal source in `signal_source` — so a denied answer anywhere means
 * "captured but never uploaded", with the reason already on the event.
 */
import type { ConsentSnapshot, ConversionEvent } from '@sanvi/api-client'
import { humanizeOptionValue } from '@sanvi/ui'
import { t } from '@sanvi/i18n'

type Catalog = Record<string, () => string>

/**
 * Localized label for a consent purpose key from the shared catalog
 * (`consent.purpose.<name>.label`), falling back to the humanized raw
 * value for a purpose this build has never seen.
 */
export function purposeLabel(purpose: string): string {
  const entry = (t as unknown as Catalog)[`consent.purpose.${purpose}.label`]
  return typeof entry === 'function' ? entry() : humanizeOptionValue(purpose)
}

const DENIED = 'denied'

/** Purposes from the snapshot's answers that the resolver denied, in asked order. */
export function deniedPurposes(consent: ConsentSnapshot): string[] {
  return Object.entries(consent.answers)
    .filter(([, answer]) => answer === DENIED)
    .map(([purpose]) => purpose)
}

/** True when the frozen snapshot says uploads are suppressed for this event. */
export function isSuppressed(consent: ConsentSnapshot): boolean {
  return deniedPurposes(consent).length > 0
}

export interface DirectiveOutcome {
  suppressed: boolean
  /** Denied purpose keys and the (raw) signal source that suppressed the event. */
  purpose: string | undefined
  source: string
}

/**
 * The directive outcome a conversion row renders: permitted, or suppressed
 * naming the denying purpose and the signal source behind it. This is the
 * simple per-row view — the full suppression taxonomy and its fix-vs-respect
 * split arrive with TASK-015's diagnostics.
 */
export function directiveOutcome(consent: ConsentSnapshot): DirectiveOutcome {
  const denied = deniedPurposes(consent)
  return {
    suppressed: denied.length > 0,
    purpose: denied[0],
    source: consent.signal_source,
  }
}

/** A conversion's display value in minor units, or null when the event carries none. */
export function conversionValue(event: ConversionEvent): number | null {
  return event.value?.amount_minor ?? null
}

/** The event's currency, or null — rendered natively, never converted. */
export function conversionCurrency(event: ConversionEvent): string | null {
  return event.value?.currency ?? null
}
