import type { components } from '@sanvi/api-client'

export type PublicPlanView = components['schemas']['PublicPlanView']
export type PlanPriceView = components['schemas']['PlanPriceView']
export type PriceInterval = components['schemas']['PriceInterval']

/**
 * Fallback plan catalog used during static prerender if the backend API is
 * unreachable during build. Mirrors the canonical seed catalog.
 */
export const DEFAULT_PLANS: PublicPlanView[] = [
  {
    plan_id: '0190f0d0-0000-7000-8000-000000000011',
    key: 'starter',
    name: 'Starter',
    tier: 'starter',
    sort_order: 1,
    prices: [
      {
        price_id: '0190f0d0-0000-7000-8000-000000000021',
        currency: 'USD',
        interval: 'month',
        unit_amount_minor: 2900,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000022',
        currency: 'USD',
        interval: 'year',
        unit_amount_minor: 29000,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000023',
        currency: 'JPY',
        interval: 'month',
        unit_amount_minor: 3500,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000024',
        currency: 'JPY',
        interval: 'year',
        unit_amount_minor: 35000,
        trial_days: 14,
      },
    ],
    entitlements: [
      { feature_key: 'courses.count', enabled: true, limit: 5 },
      { feature_key: 'members.seats', enabled: true, limit: 3 },
      { feature_key: 'storage.gb', enabled: true, limit: 20 },
      { feature_key: 'domains.custom', enabled: false },
      { feature_key: 'analytics.advanced', enabled: false },
      { feature_key: 'sso.saml', enabled: false },
    ],
  },
  {
    plan_id: '0190f0d0-0000-7000-8000-000000000012',
    key: 'professional',
    name: 'Professional',
    tier: 'professional',
    sort_order: 2,
    prices: [
      {
        price_id: '0190f0d0-0000-7000-8000-000000000025',
        currency: 'USD',
        interval: 'month',
        unit_amount_minor: 7900,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000026',
        currency: 'USD',
        interval: 'year',
        unit_amount_minor: 79000,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000027',
        currency: 'JPY',
        interval: 'month',
        unit_amount_minor: 9800,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000028',
        currency: 'JPY',
        interval: 'year',
        unit_amount_minor: 98000,
        trial_days: 14,
      },
    ],
    entitlements: [
      { feature_key: 'courses.count', enabled: true, limit: 25 },
      { feature_key: 'members.seats', enabled: true, limit: 15 },
      { feature_key: 'storage.gb', enabled: true, limit: 100 },
      { feature_key: 'domains.custom', enabled: true },
      { feature_key: 'analytics.advanced', enabled: true },
      { feature_key: 'sso.saml', enabled: false },
    ],
  },
  {
    plan_id: '0190f0d0-0000-7000-8000-000000000013',
    key: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    sort_order: 3,
    prices: [
      {
        price_id: '0190f0d0-0000-7000-8000-000000000029',
        currency: 'USD',
        interval: 'month',
        unit_amount_minor: 19900,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000030',
        currency: 'USD',
        interval: 'year',
        unit_amount_minor: 199000,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000031',
        currency: 'JPY',
        interval: 'month',
        unit_amount_minor: 25000,
        trial_days: 14,
      },
      {
        price_id: '0190f0d0-0000-7000-8000-000000000032',
        currency: 'JPY',
        interval: 'year',
        unit_amount_minor: 250000,
        trial_days: 14,
      },
    ],
    entitlements: [
      { feature_key: 'courses.count', enabled: true, limit: null },
      { feature_key: 'members.seats', enabled: true, limit: null },
      { feature_key: 'storage.gb', enabled: true, limit: 1000 },
      { feature_key: 'domains.custom', enabled: true },
      { feature_key: 'analytics.advanced', enabled: true },
      { feature_key: 'sso.saml', enabled: true },
    ],
  },
]

export interface ComparisonFeature {
  key: string
  name: string
  description: string
  category: 'core' | 'limits' | 'customization' | 'enterprise'
}

export const COMPARISON_FEATURES: ComparisonFeature[] = [
  {
    key: 'courses.count',
    name: 'Active courses',
    description: 'Number of published courses you can offer to students simultaneously.',
    category: 'limits',
  },
  {
    key: 'members.seats',
    name: 'Team seats',
    description: 'Instructor and administrator accounts included with access to admin tools.',
    category: 'limits',
  },
  {
    key: 'storage.gb',
    name: 'Video & media storage',
    description: 'Storage allocation for high-definition course video, audio, and materials.',
    category: 'limits',
  },
  {
    key: 'domains.custom',
    name: 'Custom domain',
    description: 'Host your storefront under your own domain with automatic SSL certificates.',
    category: 'customization',
  },
  {
    key: 'analytics.advanced',
    name: 'Advanced analytics',
    description: 'Deep engagement analytics, student progress tracking, and exportable cohorts.',
    category: 'core',
  },
  {
    key: 'sso.saml',
    name: 'SAML / SSO login',
    description: 'Enterprise single sign-on integration with Okta, Azure AD, and Google Workspace.',
    category: 'enterprise',
  },
]

export function getPriceForPlan(
  plan: PublicPlanView,
  currency: string,
  interval: PriceInterval,
): PlanPriceView | undefined {
  return plan.prices.find(
    (p) =>
      p.currency.toUpperCase() === currency.toUpperCase() &&
      p.interval.toLowerCase() === interval.toLowerCase(),
  )
}

export function calculateAnnualSavingsPercentage(
  plan: PublicPlanView,
  currency: string,
): number | null {
  const monthly = getPriceForPlan(plan, currency, 'month')
  const annual = getPriceForPlan(plan, currency, 'year')
  if (!monthly || !annual || monthly.unit_amount_minor <= 0) return null

  const annualIfMonthly = monthly.unit_amount_minor * 12
  const actualAnnual = annual.unit_amount_minor
  if (annualIfMonthly <= actualAnnual) return 0

  return Math.round(((annualIfMonthly - actualAnnual) / annualIfMonthly) * 100)
}
