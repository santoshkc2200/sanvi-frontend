import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BudgetCaps from '../src/routes/advertising/BudgetCaps.svelte'

/**
 * The budget-cap form's optimistic locking (TASK-017 follow-ups):
 *
 * - The `If-Match` version is derived from the *currently selected* target
 *   on every save, so switching scope/campaign/period mid-draft re-binds
 *   the guard instead of sending another cap's version (or none).
 * - A stale-write 409 repopulates the draft from the winner, so the retry
 *   carries the current version and figures rather than overwriting blind.
 *
 * Fetch is stubbed at the HTTP boundary, so the whole api-client → screen
 * path runs for real, including the spend-status reload after a conflict.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function problemResponse(detail: string, status = 409): Response {
  return jsonResponse(
    { type: 'about:blank', title: 'Conflict', status, detail, instance: '/test' },
    status,
  )
}

function money(amount_minor: number, currency = 'JPY') {
  return { amount_minor, currency }
}

function freshness(overrides: Record<string, unknown> = {}) {
  return {
    last_synced_at: '2026-09-10T11:00:00Z',
    lag_hours: 1,
    is_settled: false,
    is_stale: false,
    ...overrides,
  }
}

function cap(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cap_tenant_monthly',
    tenant_id: 'dev-acme',
    campaign_id: null,
    period: 'monthly',
    amount: money(100_000),
    effective_currency: 'JPY',
    declared_fx_basis: null,
    fx_rate_date: null,
    auto_pause: false,
    auto_resume_on_rollover: false,
    version: 2,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
    ...overrides,
  }
}

function spendItem(
  scope: string,
  campaignId: string | null,
  period: 'daily' | 'monthly',
  capValue: Record<string, unknown>,
  spendMinor: number,
) {
  return {
    scope,
    campaign_id: campaignId,
    period,
    cap: capValue,
    spend_to_date: money(spendMinor),
    settled_spend: money(0),
    provisional_spend: money(spendMinor),
    provisional_lower_bound: money(Math.round(spendMinor * 0.8)),
    projected_spend: money(spendMinor * 2),
    percentage: (spendMinor / (capValue['amount'] as { amount_minor: number }).amount_minor) * 100,
    data_freshness: freshness(),
    actions_configured: {
      threshold_80: 'notify',
      threshold_100: 'notify',
      auto_pause: false,
      auto_resume_on_rollover: false,
    },
    unconvertible_spend_currencies: [],
  }
}

const TENANT_CAP = () => cap()
const CAMPAIGN_CAP = () =>
  cap({
    id: 'cap_camp_daily',
    campaign_id: 'camp_1',
    period: 'daily',
    amount: money(50_000),
    version: 5,
  })

function items() {
  return [
    spendItem('tenant', null, 'monthly', TENANT_CAP(), 10_000),
    spendItem('campaign:camp_1', 'camp_1', 'daily', CAMPAIGN_CAP(), 5_000),
  ]
}

const CONNECTIONS = [
  {
    id: 'conn_1',
    platform: 'google_ads',
    external_account_id: '123-456',
    account_name: 'Tokyo Retail',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    status: 'active',
    health: {
      can_sync: true,
      can_upload_conversions: true,
      scopes_missing: [],
      reconnect_required: false,
      token_expires_at: null,
      last_error: null,
      last_synced_at: '2026-09-10T11:00:00Z',
    },
  },
]

const CAMPAIGNS = [
  {
    id: 'camp_1',
    connection_id: 'conn_1',
    platform: 'google_ads',
    campaign: {
      name: 'Summer sale',
      budget: { kind: 'daily', amount: money(200_000) },
    },
  },
]

const SETTINGS = {
  default_locale: 'en',
  enabled_locales: ['en'],
  timezone: 'Asia/Tokyo',
  updated_at: '2026-09-01T00:00:00Z',
}

interface PutCall {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

function setupFetch(state: { items: unknown[]; put: (call: PutCall) => Response }) {
  const puts: PutCall[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/ads/spend-status')) return jsonResponse({ items: state.items })
    if (url.endsWith('/ads/campaigns')) return jsonResponse({ campaigns: CAMPAIGNS })
    if (url.endsWith('/ads/connections')) return jsonResponse({ connections: CONNECTIONS })
    if (url.endsWith('/localization/settings')) return jsonResponse(SETTINGS)
    if (init?.method === 'PUT' && url.includes('/ads/')) {
      const call: PutCall = {
        url,
        headers: { ...((init.headers as Record<string, string> | undefined) ?? {}) },
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      }
      puts.push(call)
      return state.put(call)
    }
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return puts
}

function setupSession() {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([{ feature: 'advertising.budget_guardrails', enabled: true }])
  setLocale('en')
  setSession({
    userId: 'usr_1',
    email: 'owner@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [
      {
        tenant_id: 'dev-acme',
        tenant_slug: 'acme',
        tenant_name: 'Acme',
        role_id: 'owner',
        permissions: ['advertising.read', 'advertising.budget.manage'],
      },
    ],
    aal: 'aal2',
    methods: ['totp'],
    authenticatedAt: new Date().toISOString(),
    locale: 'en',
  })
}

beforeEach(() => {
  setupSession()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  setSession(null)
})

async function editFirstCap() {
  render(BudgetCaps)
  await screen.findByText('Caps in place')
  const edits = await screen.findAllByText('Edit')
  await fireEvent.click(edits[0]!)
}

describe('BudgetCaps optimistic locking (phase 10, TASK-017)', () => {
  it('renders the caps screen with no axe violations', async () => {
    setupFetch({ items: items(), put: () => jsonResponse(cap({ version: 3 })) })
    const { container } = render(BudgetCaps)
    // The full screen — caps in place, the form, and the disclosure copy —
    // is the a11y surface; assert on the loaded state, not the spinner.
    await screen.findByText('Caps in place')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sends the selected target version, rebinding when the target switches', async () => {
    const state = { items: items(), put: () => jsonResponse(cap({ version: 3 })) }
    const puts = setupFetch(state)
    await editFirstCap()

    // Draft holds the tenant monthly cap (v2): saving as-is sends v2.
    await fireEvent.click(screen.getByRole('button', { name: 'Save cap' }))
    await waitFor(() => expect(puts.length).toBe(1))
    expect(puts[0]!.url).toContain('/ads/budget-caps')
    expect(puts[0]!.headers['If-Match']).toBe('2')

    // Switch the draft to the campaign daily cap (v5): the guard rebinds to
    // v5 rather than re-sending the tenant cap's v2.
    await fireEvent.change(screen.getByLabelText(/What does this cap cover/), {
      target: { value: 'campaign' },
    })
    await fireEvent.change(await screen.findByLabelText(/^Campaign/), {
      target: { value: 'camp_1' },
    })
    await fireEvent.change(await screen.findByLabelText(/^Period/), { target: { value: 'daily' } })
    // Lower the figure below the campaign cap so no raise-confirmation
    // dialog intercepts the save.
    await fireEvent.input(screen.getByLabelText(/Cap amount \(JPY\)/), {
      target: { value: '40000' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Save cap' }))
    await waitFor(() => expect(puts.length).toBe(2))
    expect(puts[1]!.url).toContain('/ads/campaigns/camp_1/budget-cap')
    expect(puts[1]!.headers['If-Match']).toBe('5')
  })

  it('repopulates the draft from the winner after a stale conflict', async () => {
    const winner = cap({ version: 3, amount: money(120_000) })
    const winnerItems = [spendItem('tenant', null, 'monthly', winner, 10_000)]
    const state = {
      items: items(),
      put: (call: PutCall) => {
        // First save loses the race: the winner is already committed
        // server-side (visible on the reload), so the retry must guard on it.
        if (call.headers['If-Match'] === '2') {
          state.items = winnerItems
          return problemResponse('budget cap changed since it was read; refresh and resubmit')
        }
        return jsonResponse(winner)
      },
    }
    const puts = setupFetch(state)
    await editFirstCap()

    await fireEvent.click(screen.getByRole('button', { name: 'Save cap' }))
    // The draft now shows the winner's figures, not the stale typed ones…
    await waitFor(() =>
      expect((screen.getByLabelText(/Cap amount \(JPY\)/) as HTMLInputElement).value).toBe(
        '120000',
      ),
    )
    expect(
      await screen.findByText(/Someone saved this cap while you were editing/),
    ).toBeInTheDocument()

    // …so retrying guards on the winner's version instead of overwriting blind.
    await fireEvent.click(screen.getByRole('button', { name: 'Save cap' }))
    await waitFor(() => expect(puts.length).toBe(2))
    expect(puts[1]!.headers['If-Match']).toBe('3')
  })
})
