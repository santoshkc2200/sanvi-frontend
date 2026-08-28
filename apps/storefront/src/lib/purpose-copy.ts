import type { ProcessingPurpose } from '@sanvi/consent'
import { CONSENTABLE_PURPOSES } from '@sanvi/consent'

/**
 * English copy per processing purpose. Phase 06 (i18n) swaps these literals
 * for message lookups; the keys and structure stay. Descriptions are plain
 * language on purpose — the preference centre's rows must be readable by
 * someone who has never heard the words "processing purpose".
 */
export interface PurposeCopy {
  label: string
  description: string
  consequence: string
}

const PURPOSES: Record<ProcessingPurpose, PurposeCopy> = {
  essential: {
    label: 'Essential',
    description: 'What the store needs to function.',
    consequence: 'Always on — cart, sign-in and security cannot work without it.',
  },
  analytics: {
    label: 'Product analytics',
    description: 'Which pages and features are used, counted in aggregate.',
    consequence: 'Your browsing of this store is counted so we can improve it.',
  },
  marketing_email: {
    label: 'Marketing email',
    description: 'News, offers and product announcements by email.',
    consequence: 'Your email address is used for campaigns until you withdraw.',
  },
  ads_personalisation: {
    label: 'Personalised advertising',
    description: 'Ads on other sites picked for you.',
    consequence: 'Ad platforms receive information to select ads for you.',
  },
  ads_measurement: {
    label: 'Ad measurement',
    description: 'Whether ad clicks lead to purchases, in aggregate.',
    consequence: 'Ad platforms receive aggregate conversion signals.',
  },
  session_replay: {
    label: 'Session replay',
    description: 'Recording how the interface is used to fix problems.',
    consequence: 'Interactions such as clicks and scrolls may be recorded.',
  },
  sale_or_share: {
    label: 'Sale or sharing for cross-context advertising',
    description: 'Sharing data with ad platforms so ads follow you across sites.',
    consequence: 'Your data may be shared with the ad vendors listed below.',
  },
  targeted_advertising: {
    label: 'Targeted advertising',
    description: 'Ads chosen based on your profile.',
    consequence: 'Your profile may be used to select advertising.',
  },
  profiling_significant_effects: {
    label: 'Profiling with significant effects',
    description: 'Automated decisions that could seriously affect you.',
    consequence: 'Decisions such as pricing or eligibility may be automated.',
  },
  sensitive_pi_use: {
    label: 'Use of sensitive personal information',
    description: 'Sensitive categories such as health or precise location.',
    consequence: 'Limited to what the service strictly requires.',
  },
}

export function purposeCopy(purpose: ProcessingPurpose): PurposeCopy {
  return PURPOSES[purpose] ?? PURPOSES['essential']
}

/** The purpose rows the banner and preference centre render, in registry order. */
export function consentablePurposeCopy(): { purpose: ProcessingPurpose; copy: PurposeCopy }[] {
  return CONSENTABLE_PURPOSES.map((purpose) => ({
    purpose,
    copy: PURPOSES[purpose] ?? PURPOSES['essential'],
  }))
}
