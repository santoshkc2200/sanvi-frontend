import type { ProcessingPurpose } from '@sanvi/consent'
import { CONSENTABLE_PURPOSES } from '@sanvi/consent'
import { t } from '@sanvi/i18n'

/**
 * Copy per processing purpose, straight from the phase-06 catalog (the
 * phase-05 English literals these keys replaced live in
 * `messages/en.json`). Keys are
 * `consent.purpose.<name>.{label,description,consequence}`; the names below
 * are the catalog's purpose list, and a `ProcessingPurpose` arriving from
 * the registry that the catalog doesn't know yet falls back to `essential`
 * rather than rendering a raw key.
 */
export interface PurposeCopy {
  label: string
  description: string
  consequence: string
}

const PURPOSE_NAMES = [
  'essential',
  'analytics',
  'marketing_email',
  'ads_personalisation',
  'ads_measurement',
  'session_replay',
  'sale_or_share',
  'targeted_advertising',
  'profiling_significant_effects',
  'sensitive_pi_use',
] as const

type PurposeName = (typeof PURPOSE_NAMES)[number]

function purposeCopyFor(name: PurposeName): PurposeCopy {
  return {
    label: t[`consent.purpose.${name}.label`](),
    description: t[`consent.purpose.${name}.description`](),
    consequence: t[`consent.purpose.${name}.consequence`](),
  }
}

const CATALOG_PURPOSES = new Set<string>(PURPOSE_NAMES)

export function purposeCopy(purpose: ProcessingPurpose): PurposeCopy {
  return CATALOG_PURPOSES.has(purpose)
    ? purposeCopyFor(purpose as PurposeName)
    : purposeCopyFor('essential')
}

/** The purpose rows the banner and preference centre render, in registry order. */
export function consentablePurposeCopy(): { purpose: ProcessingPurpose; copy: PurposeCopy }[] {
  return CONSENTABLE_PURPOSES.map((purpose) => ({
    purpose,
    copy: purposeCopy(purpose),
  }))
}
