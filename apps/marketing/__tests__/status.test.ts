import { en, ensureLocaleLoaded, messages } from '@sanvi/i18n'
import { describe, expect, it } from 'vitest'
import { INCIDENT_HISTORY, SLO_JOURNEYS, toOverallStatus } from '$lib/status'

describe('status lib (TASK-025 steps 2+3)', () => {
  it('pins the six SLO journeys from the backend budgets doc', () => {
    expect([...SLO_JOURNEYS]).toEqual([
      'storefront-read',
      'admin-write',
      'checkout-create',
      'webhook-processing',
      'conversion-upload',
      'domain-issuance',
    ])
  })

  it('maps probe results to the page state without a second toggle', () => {
    expect(toOverallStatus({ status: 'ok', checks: [] }, undefined)).toBe('operational')
    expect(
      toOverallStatus(
        { status: 'degraded', checks: [{ name: 'redis', state: 'degraded' }] },
        undefined,
      ),
    ).toBe('degraded')
    expect(toOverallStatus(null, new Error('down'))).toBe('unknown')
    expect(toOverallStatus(null, undefined)).toBe('unknown')
  })

  it('incident history entries name a pinned journey', () => {
    for (const incident of INCIDENT_HISTORY) {
      expect(SLO_JOURNEYS).toContain(incident.journey)
      expect(incident.id).toBeTruthy()
      expect(incident.date).toBeTruthy()
    }
  })

  it('an incident template exists for every SLO journey in both locales', async () => {
    await ensureLocaleLoaded('ja')
    const catalogs = [messages.en, messages.ja] as const
    expect(en['marketing.status.heading']).toBeTruthy()
    for (const journey of SLO_JOURNEYS) {
      for (const catalog of catalogs) {
        expect(
          catalog[`marketing.status.incident.${journey}.title`],
          `${journey} title`,
        ).toBeTruthy()
        expect(catalog[`marketing.status.incident.${journey}.body`], `${journey} body`).toBeTruthy()
      }
    }
  })
})
