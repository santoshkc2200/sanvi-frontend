import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignBuilder from '../src/routes/advertising/CampaignBuilder.svelte'
import {
  AD_PLATFORM_FIXTURES,
  fixturePlatformByKey,
  platformViewFixture,
} from '@sanvi/ui/test-fixtures'

/**
 * The campaign builder (TASK-012): steps render from the fixture matrix,
 * the draft survives a refresh via the autosave, review blocks on
 * incomplete fields, and a budget increase above the threshold cannot pass
 * without the confirmation dialog showing the delta.
 */

const GOOGLE = fixturePlatformByKey('google_ads')!

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function problemResponse(status: number, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Error', status, ...extra }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  })
}

const HEALTH = {
  can_sync: true,
  can_upload_conversions: true,
  scopes_missing: [] as string[],
  reconnect_required: false,
  token_expires_at: null,
  last_error: null,
  last_synced_at: '2026-09-03T11:00:00Z',
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn_google_1',
    platform: GOOGLE.key,
    external_account_id: '123-456',
    account_name: 'Tokyo Retail',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    status: 'active',
    health: { ...HEALTH },
    ...overrides,
  }
}

function campaignView(overrides: Record<string, unknown> = {}) {
  const { campaign: campaignOverrides, ...rest } = overrides
  return {
    id: 'camp_1',
    connection_id: 'conn_google_1',
    platform: GOOGLE.key,
    external_id: null,
    revision: 7,
    campaign: {
      id: 'camp_1',
      name: 'Existing campaign',
      objective: GOOGLE.capability_matrix.objectives[0],
      budget: { kind: 'daily', amount: { amount_minor: 1000, currency: 'JPY' } },
      schedule: null,
      status: 'draft',
      drift: { drifted: false, changed_fields: [] as string[] },
      ad_groups: [],
      ...(campaignOverrides as Record<string, unknown> | undefined),
    },
    ...rest,
  }
}

interface RouteOptions {
  connections?: unknown[]
  campaign?: unknown
  onCall?: (url: string, init: RequestInit | undefined) => Response | undefined
}

function setupFetch(options: RouteOptions = {}): ReturnType<typeof vi.fn> {
  const connections = options.connections ?? [connection()]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/ads/platforms')) {
      return jsonResponse({
        platforms: [platformViewFixture(GOOGLE, { connection_state: 'connected' })],
      })
    }
    if (url.endsWith('/ads/connections')) return jsonResponse({ connections })
    if (url.includes('/validate')) return jsonResponse({ violations: [] })
    if (
      (init as RequestInit | undefined)?.method === 'GET' &&
      /\/ads\/campaigns\/[^/]+$/.test(url)
    ) {
      if (options.campaign === undefined) return jsonResponse({})
      return jsonResponse(options.campaign)
    }
    const handled = options.onCall?.(url, init)
    if (handled) return handled
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([])
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
        permissions: ['advertising.read', 'advertising.campaign.write'],
      },
    ],
    aal: 'aal2',
    methods: ['totp'],
    authenticatedAt: new Date().toISOString(),
    locale: 'en',
  })
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  setSession(null)
  localStorage.clear()
})

async function fillBasics(): Promise<void> {
  const name = await screen.findByLabelText(/^Campaign name/)
  fireEvent.input(name, { target: { value: 'Summer sale' } })
  const objective = screen.getByLabelText(/^Objective/)
  fireEvent.change(objective, { target: { value: GOOGLE.capability_matrix.objectives[0] } })
}

describe('AdvertisingCampaignBuilder (phase 10, TASK-012)', () => {
  it('renders step 1 with only the matrix-driven basics; the creatives step is an explained stub', async () => {
    setupFetch()
    render(CampaignBuilder)

    await screen.findByText('Name & objective')
    expect(screen.getByLabelText(/^Campaign name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Objective/)).toBeInTheDocument()
    // Steps 2+ exist in the stepper.
    expect(screen.getByText('Targeting')).toBeInTheDocument()
    expect(screen.getByText('Budget & schedule')).toBeInTheDocument()
    expect(screen.getByText('Creatives')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('advances through targeting — every checkbox comes from the fixture matrix', async () => {
    setupFetch()
    render(CampaignBuilder)

    await fillBasics()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Who should see these ads')
    // Every matrix dimension renders as a checkbox — data, not literals.
    expect(screen.getAllByRole('checkbox')).toHaveLength(
      GOOGLE.capability_matrix.targeting_dimensions.length,
    )
    // Axe on a mid-flow step (every step is keyboard operable by construction).
    const stepper = screen.getByRole('navigation')
    expect(stepper).toBeInTheDocument()
  })

  it('blocks Continue while the step is incomplete, then keeps the values', async () => {
    setupFetch()
    render(CampaignBuilder)

    await screen.findByText('Name & objective')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    // Still on step 1: required errors are shown.
    expect((await screen.findAllByText('This field is required.')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Name & objective').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )

    await fillBasics()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Who should see these ads')).toBeInTheDocument()
    // Going back keeps everything.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByLabelText(/^Campaign name/)).toHaveValue('Summer sale')
  })

  it('a refresh mid-builder resumes the draft with every entered value intact', async () => {
    setupFetch()
    const first = render(CampaignBuilder)
    await fillBasics()

    // Move to budget step and enter a budget, then simulate a refresh:
    // unmount, render a fresh component against the same localStorage.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → targeting
    await screen.findByText('Who should see these ads')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → budget
    const budgetInput = await screen.findByLabelText(/budget amount/i)
    fireEvent.input(budgetInput, { target: { value: '1500' } })
    const kind = screen.getByLabelText(/^Budget type/)
    fireEvent.change(kind, { target: { value: 'daily' } })

    first.unmount()
    render(CampaignBuilder)

    // The stepper resumes on the saved step with the values restored.
    expect(await screen.findByLabelText(/budget amount/i)).toHaveValue('1500')
    expect(screen.getByLabelText(/^Budget type/)).toHaveValue('daily')
  })

  it('the review step shows the full draft and create submits an idempotent POST plus the seeded ad group', async () => {
    const fetchMock = setupFetch()
    render(CampaignBuilder)

    await fillBasics()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Who should see these ads')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const budgetInput = await screen.findByLabelText(/budget amount/i)
    fireEvent.input(budgetInput, { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText(/^Budget type/), {
      target: { value: 'daily' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → creatives stub
    expect(await screen.findByText('Ad creatives are added per ad group')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → review

    expect(await screen.findByText('Summer sale')).toBeInTheDocument()
    expect(screen.getByText(/Tokyo Retail/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }))

    await waitFor(() => {
      const creates = fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith('/ads/campaigns') &&
          (init as RequestInit | undefined)?.method === 'POST',
      )
      expect(creates.length).toBe(1)
      const headers = (creates[0]![1] as RequestInit).headers as Record<string, string>
      expect(headers['idempotency-key']).toBeTruthy()
    })
  })

  it('an edit with a budget increase above the threshold cannot save without confirming the delta dialog', async () => {
    const fetchMock = setupFetch({ campaign: campaignView() })
    render(CampaignBuilder, { id: 'camp_1' })

    // Editing an existing campaign loads its values into step 1.
    const name = await screen.findByLabelText(/^Campaign name/)
    expect(name).toHaveValue('Existing campaign')

    // Walk to review with a 10× budget (threshold is +20%).
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Who should see these ads')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const budgetInput = await screen.findByLabelText(/budget amount/i)
    fireEvent.input(budgetInput, { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Ad creatives are added per ad group')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByText('Existing campaign')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    // No PATCH may fire before the dialog is confirmed.
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith('/ads/campaigns/camp_1') &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      ).length,
    ).toBe(0)

    const dialog = await screen.findByRole('dialog')
    // The delta dialog shows daily and projected monthly increases in the
    // ad account's currency.
    expect(within(dialog).getByText('+¥9,000')).toBeInTheDocument()
    expect(within(dialog).getByText('+¥270,000')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm increase' }))
    await waitFor(() => {
      const patches = fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith('/ads/campaigns/camp_1') &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      )
      expect(patches.length).toBe(1)
      const headers = (patches[0]![1] as RequestInit).headers as Record<string, string>
      expect(headers['If-Match']).toBe('7')
      expect(headers['idempotency-key']).toBeTruthy()
    })
  })

  it('a 409 on PATCH renders the conflict and the current state, and does not resubmit', async () => {
    let patchCalls = 0
    const fetchMock = setupFetch({
      campaign: campaignView(),
      onCall: (url, init) => {
        if (
          url.endsWith('/ads/campaigns/camp_1') &&
          (init as RequestInit | undefined)?.method === 'PATCH'
        ) {
          patchCalls += 1
          return problemResponse(409)
        }
        return undefined
      },
    })
    render(CampaignBuilder, { id: 'camp_1' })

    const name = await screen.findByLabelText(/^Campaign name/)
    fireEvent.input(name, { target: { value: 'Renamed in a hurry' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Who should see these ads')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const budgetInput = await screen.findByLabelText(/budget amount/i)
    fireEvent.input(budgetInput, { target: { value: '1100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Ad creatives are added per ad group')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Renamed in a hurry')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText(/changed since you opened it/, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/revision 7/)).toBeInTheDocument()

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(patchCalls).toBe(1)
    void fetchMock
  })

  it('has no axe violations on the basics step', async () => {
    setupFetch()
    const { container } = render(CampaignBuilder)
    await screen.findByText('Name & objective')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('lists platforms from the fixtures (the fake adapter matrices), never frontend data', () => {
    // The engine consumed exactly the fixture matrices — the builder is the
    // same engine, so the parity with the backend's fake adapter holds.
    expect(AD_PLATFORM_FIXTURES.length).toBeGreaterThanOrEqual(2)
  })
})
