import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentsSettings from '../src/routes/PaymentsSettings.svelte'

vi.mock('../src/lib/env', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/env')>('../src/lib/env')
  return {
    ...actual,
    getAppEnv: () => ({
      apiOrigin: 'http://localhost:8080',
      kratosOrigin: 'http://localhost:4433',
      storefrontOrigin: 'http://localhost:4174',
      stripePublishableKey: 'pk_test_123',
      mediaOrigin: undefined,
    }),
  }
})

vi.mock('@sanvi/api-client', async () => {
  const actual = await vi.importActual<typeof import('@sanvi/api-client')>('@sanvi/api-client')
  return {
    ...actual,
    listPaymentProviders: vi.fn(),
    createPaymentConnection: vi.fn(),
    createPaymentConnectionSession: vi.fn(),
    getPaymentConnection: vi.fn(),
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const STRIPE_PROVIDER = {
  kind: 'stripe_connect',
  display_name: 'Stripe',
  available: true,
  requires_onboarding: true,
  supported_countries: ['US', 'JP', 'GB', 'DE'],
}

vi.mock('@stripe/connect-js', () => ({
  loadConnectAndInitialize: vi.fn(
    async ({ fetchClientSecret }: { fetchClientSecret: () => Promise<string> }) => {
      try {
        await fetchClientSecret()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`account_session_create_error: ${msg}`)
      }
      return {
        create: vi.fn((name: string) => {
          const el = document.createElement('div') as unknown as HTMLElement & {
            setOnExit: (cb: () => void) => void
            setOnLoaderStart: (cb: (e: unknown) => void) => void
            setOnLoadError: (cb: (e: { error: { type: string; message: string } }) => void) => void
          }
          el.setOnExit = vi.fn()
          el.setOnLoaderStart = vi.fn((cb) => {
            setTimeout(() => cb({ elementTagName: name }), 0)
          })
          el.setOnLoadError = vi.fn()
          return el
        }),
        logout: vi.fn(),
        update: vi.fn(),
      }
    },
  ),
}))

function mockFetchSuccess() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : ((input as Request).url ?? input.toString())
    const method = init?.method ?? 'GET'
    if (url.includes('/tenant/payments/providers') && method === 'GET') {
      return Promise.resolve(jsonResponse({ providers: [STRIPE_PROVIDER] }))
    }
    if (
      url.includes('/tenant/payments/connections') &&
      url.includes('/session') &&
      method === 'POST'
    ) {
      return Promise.resolve(
        jsonResponse(
          {
            client_secret: 'secret_123',
            components: ['account_onboarding'],
            connection_id: '123',
            expires_at: new Date().toISOString(),
            provider: 'stripe_connect',
          },
          201,
        ),
      )
    }
    if (url.includes('/tenant/payments/connections') && method === 'POST') {
      return Promise.resolve(
        jsonResponse(
          {
            id: 'conn_123',
            provider: 'stripe_connect',
            status: 'pending',
            capabilities: {},
            requirements: { currently_due: [], eventually_due: [], past_due: [], deadline: null },
            blockers: [],
            country: 'US',
            default_currency: 'USD',
            connected_at: null,
            last_synced_at: null,
            can_accept_payments: false,
          },
          201,
        ),
      )
    }
    if (url.includes('/tenant/entitlements')) {
      return Promise.resolve(jsonResponse([{ feature: 'payments.stripe_connect', enabled: true }]))
    }
    return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
  })
}

const originalFetch = globalThis.fetch
const originalGlobalFetch = (global as unknown as { fetch: typeof fetch }).fetch

function setFetchMock(fn: typeof fetch) {
  globalThis.fetch = fn as unknown as typeof fetch
  ;(global as unknown as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch
  if (typeof window !== 'undefined')
    (window as unknown as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch
}

beforeEach(async () => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([{ feature: 'payments.stripe_connect', enabled: true }])
  localStorage.clear()
  setFetchMock(mockFetchSuccess() as unknown as typeof fetch)
  const { listPaymentProviders, createPaymentConnection, createPaymentConnectionSession } =
    await import('@sanvi/api-client')
  vi.mocked(listPaymentProviders).mockResolvedValue({
    providers: [STRIPE_PROVIDER],
  } as unknown as never)
  vi.mocked(createPaymentConnection).mockResolvedValue({
    id: 'conn_123',
    provider: 'stripe_connect',
    status: 'pending',
    capabilities: {},
    requirements: { currently_due: [], eventually_due: [], past_due: [], deadline: null },
    blockers: [],
    country: 'US',
    default_currency: 'USD',
    connected_at: null,
    last_synced_at: null,
    can_accept_payments: false,
  } as unknown as never)
  vi.mocked(createPaymentConnectionSession).mockResolvedValue({
    client_secret: 'secret_123',
    components: ['account_onboarding'],
    connection_id: 'conn_123',
    expires_at: new Date().toISOString(),
    provider: 'stripe_connect',
  } as unknown as never)
})

afterEach(() => {
  globalThis.fetch = originalFetch
  ;(global as unknown as { fetch: typeof fetch }).fetch = originalGlobalFetch
  if (typeof window !== 'undefined')
    (window as unknown as { fetch: typeof fetch }).fetch = originalFetch
  localStorage.clear()
  vi.clearAllMocks()
})

describe('PaymentsSettings onboarding (09.2)', () => {
  it('renders pre-connect explainer with what to expect and time estimate', async () => {
    render(PaymentsSettings)
    expect(await screen.findByText('What Stripe will ask for')).toBeInTheDocument()
    expect(screen.getByText(/Business details, a representative/)).toBeInTheDocument()
    expect(screen.getByText('How long it takes')).toBeInTheDocument()
    expect(screen.getByText(/Most accounts finish in 5–10 minutes/)).toBeInTheDocument()
  })

  it('after Connect, mounts onboarding with per-render session fetch', async () => {
    const { createPaymentConnectionSession } = await import('@sanvi/api-client')
    let sessionCalls = 0
    vi.mocked(createPaymentConnectionSession).mockImplementation(async () => {
      sessionCalls += 1
      return {
        client_secret: `secret_${sessionCalls}`,
        components: ['account_onboarding'],
        connection_id: 'conn_123',
        expires_at: new Date().toISOString(),
        provider: 'stripe_connect',
      } as unknown as never
    })

    render(PaymentsSettings)
    await screen.findByText('Payment providers')
    const connectBtn = await screen.findByRole('button', { name: 'Connect' })
    await fireEvent.click(connectBtn)

    expect(await screen.findByText('Complete your Stripe setup')).toBeInTheDocument()
    expect(screen.getByText(/Finish the steps below/)).toBeInTheDocument()
    await waitFor(() => expect(sessionCalls).toBeGreaterThan(0))
  })

  it('resumability: stored connection id remounts onboarding without clicking Connect', async () => {
    localStorage.setItem('sanvi:payments:connection:dev-acme', 'conn_resume')
    const { createPaymentConnectionSession } = await import('@sanvi/api-client')
    vi.mocked(createPaymentConnectionSession).mockImplementation(async (_client, id) => {
      if (id === 'conn_resume') {
        return {
          client_secret: 'secret_resume',
          components: ['account_onboarding'],
          connection_id: 'conn_resume',
          expires_at: new Date().toISOString(),
          provider: 'stripe_connect',
        } as unknown as never
      }
      return {
        client_secret: 'secret_123',
        components: ['account_onboarding'],
        connection_id: id,
        expires_at: new Date().toISOString(),
        provider: 'stripe_connect',
      } as unknown as never
    })
    render(PaymentsSettings)
    expect(await screen.findByText('Complete your Stripe setup')).toBeInTheDocument()
    // Finding 2: The provider catalog is rendered in addition to the onboarding section, not replaced by it
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
  })

  it('session fetch failure renders retry affordance, not blank iframe', async () => {
    const { createPaymentConnection } = await import('@sanvi/api-client')
    vi.mocked(createPaymentConnection).mockResolvedValue({
      id: 'conn_fail',
      provider: 'stripe_connect',
      status: 'pending',
      capabilities: {},
      requirements: { currently_due: [], eventually_due: [], past_due: [], deadline: null },
      blockers: [],
      country: 'US',
      default_currency: 'USD',
      connected_at: null,
      last_synced_at: null,
      can_accept_payments: false,
    } as unknown as never)
    const { loadConnectAndInitialize } = await import('@stripe/connect-js')
    vi.mocked(loadConnectAndInitialize).mockRejectedValueOnce(
      new Error('account_session_create_error: Provider unavailable'),
    )

    const { container } = render(PaymentsSettings)
    await screen.findByText('Payment providers')
    await fireEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    expect(await screen.findByText('Could not start onboarding')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(container.textContent).not.toBe('')
  })

  it('session fetch 404 clears persisted connection id and recovers to catalog', async () => {
    const { ApiError, createPaymentConnectionSession } = await import('@sanvi/api-client')
    localStorage.setItem('sanvi:payments:connection:dev-acme', 'conn_deleted')
    vi.mocked(createPaymentConnectionSession).mockRejectedValue(
      new ApiError(404, { title: 'Not found', status: 404, type: 'about:blank' }, undefined),
    )

    render(PaymentsSettings)
    await screen.findByText('Payment providers')
    // Storage should be cleared on 404
    await waitFor(() => {
      expect(localStorage.getItem('sanvi:payments:connection:dev-acme')).toBeNull()
    })
  })

  it('tenant switch resets onboarding and loads new tenant state without cross-tenant leak', async () => {
    setMemberships([
      { tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' },
      { tenantId: 'dev-other', slug: 'other', displayName: 'Other Corp', role: 'owner' },
    ])
    localStorage.setItem('sanvi:payments:connection:dev-acme', 'conn_acme')
    const { createPaymentConnectionSession } = await import('@sanvi/api-client')
    const requestedIds: string[] = []
    vi.mocked(createPaymentConnectionSession).mockImplementation(async (_client, id) => {
      requestedIds.push(id)
      return {
        client_secret: `secret_${id}`,
        components: ['account_onboarding'],
        connection_id: id,
        expires_at: new Date().toISOString(),
        provider: 'stripe_connect',
      } as unknown as never
    })

    const { unmount } = render(PaymentsSettings)
    expect(await screen.findByText('Complete your Stripe setup')).toBeInTheDocument()
    unmount()

    // Switch to dev-other (which has no stored connection)
    switchTenant('dev-other')
    render(PaymentsSettings)
    await screen.findByText('Payment providers')
    expect(screen.queryByText('Complete your Stripe setup')).not.toBeInTheDocument()
  })

  it('never writes client_secret to storage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(PaymentsSettings)
    await screen.findByText('Payment providers')
    await fireEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    await screen.findByText('Complete your Stripe setup')
    // Allow async session fetch to complete
    await new Promise((r) => setTimeout(r, 100))
    for (const call of setItemSpy.mock.calls) {
      const value = call[1] as string
      expect(value).not.toContain('secret')
    }
  })
})
