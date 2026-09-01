import type { PaymentConnectionView } from '@sanvi/api-client'
import { setLocale } from '@sanvi/i18n'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen, waitFor } from '@testing-library/svelte'
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

vi.mock('@stripe/connect-js', () => ({
  loadConnectAndInitialize: vi.fn(
    async ({ fetchClientSecret }: { fetchClientSecret: () => Promise<string> }) => {
      await fetchClientSecret().catch(() => {})
      return {
        create: vi.fn((name: string) => {
          const el = document.createElement('div') as unknown as HTMLElement & {
            setOnExit: (cb: () => void) => void
            setOnLoaderStart: (cb: (e: unknown) => void) => void
            setOnLoadError: (cb: (e: { error: { type: string; message: string } }) => void) => void
            setOnNotificationsChange: (cb: (e: unknown) => void) => void
            setOnSectionOpen: (cb: (e: unknown) => void) => void
          }
          el.setOnExit = vi.fn()
          el.setOnLoaderStart = vi.fn((cb) => {
            setTimeout(() => cb({ elementTagName: name }), 0)
          })
          el.setOnLoadError = vi.fn()
          el.setOnNotificationsChange = vi.fn()
          el.setOnSectionOpen = vi.fn()
          return el
        }),
        logout: vi.fn(),
        update: vi.fn(),
      }
    },
  ),
}))

const STRIPE_PROVIDER = {
  kind: 'stripe_connect',
  display_name: 'Stripe',
  available: true,
  requires_onboarding: true,
  supported_countries: ['US', 'JP', 'GB', 'DE'],
}

const ACTIVE_CONNECTION_FIXTURE: PaymentConnectionView = {
  id: 'conn_active_123',
  provider: 'stripe_connect',
  status: 'active',
  capabilities: {
    card_payments: 'active',
    transfers: 'active',
  },
  requirements: {
    currently_due: [],
    eventually_due: [],
    past_due: [],
    deadline: null,
  },
  blockers: [],
  country: 'US',
  default_currency: 'USD',
  connected_at: '2026-08-20T10:00:00Z',
  last_synced_at: '2026-08-20T10:05:00Z',
  can_accept_payments: true,
}

const PENDING_CONNECTION_FIXTURE: PaymentConnectionView = {
  id: 'conn_pending_123',
  provider: 'stripe_connect',
  status: 'onboarding',
  capabilities: {
    card_payments: 'inactive',
    transfers: 'inactive',
  },
  requirements: {
    currently_due: [
      { code: 'individual.verification.document', summary_key: 'payments.req.id_document' },
      { code: 'external_account', summary_key: 'payments.req.bank_account' },
    ],
    eventually_due: [{ code: 'business_profile.url', summary_key: 'payments.req.business_url' }],
    past_due: [],
    deadline: '2026-09-30',
  },
  blockers: [{ summary_key: 'payments.blocker.card_payments_inactive' }],
  country: 'US',
  default_currency: 'USD',
  connected_at: '2026-08-20T10:00:00Z',
  last_synced_at: '2026-08-20T10:05:00Z',
  can_accept_payments: false,
}

const RESTRICTED_CONNECTION_FIXTURE: PaymentConnectionView = {
  id: 'conn_restricted_123',
  provider: 'stripe_connect',
  status: 'restricted',
  capabilities: {
    card_payments: 'inactive',
    transfers: 'inactive',
  },
  requirements: {
    currently_due: [],
    eventually_due: [],
    past_due: [
      { code: 'individual.verification.document', summary_key: 'payments.req.id_document' },
    ],
    deadline: '2026-08-15',
  },
  blockers: [{ summary_key: 'payments.blocker.requirements_past_due' }],
  country: 'US',
  default_currency: 'USD',
  connected_at: '2026-08-01T10:00:00Z',
  last_synced_at: '2026-08-16T10:05:00Z',
  can_accept_payments: false,
}

const UNMAPPED_REQUIREMENT_FIXTURE: PaymentConnectionView = {
  id: 'conn_unmapped_123',
  provider: 'stripe_connect',
  status: 'onboarding',
  capabilities: {
    card_payments: 'inactive',
  },
  requirements: {
    currently_due: [
      { code: 'future.unknown.stripe.requirement.code', summary_key: 'payments.req.unmapped' },
    ],
    eventually_due: [],
    past_due: [],
    deadline: null,
  },
  blockers: [],
  country: 'US',
  default_currency: 'USD',
  connected_at: '2026-08-20T10:00:00Z',
  last_synced_at: '2026-08-20T10:05:00Z',
  can_accept_payments: false,
}

beforeEach(async () => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([{ feature: 'payments.stripe_connect', enabled: true }])
  setLocale('en')
  localStorage.clear()

  const { listPaymentProviders, createPaymentConnectionSession } = await import('@sanvi/api-client')
  vi.mocked(listPaymentProviders).mockResolvedValue({
    providers: [STRIPE_PROVIDER],
  } as unknown as never)
  vi.mocked(createPaymentConnectionSession).mockResolvedValue({
    client_secret: 'secret_test_123',
    components: ['account_onboarding', 'notification_banner', 'account_management'],
    connection_id: 'conn_test',
    expires_at: new Date().toISOString(),
    provider: 'stripe_connect',
  } as unknown as never)
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('PaymentsSettings Status, Requirements & Embedded Components (TASK-004)', () => {
  it('renders active state with success verdict banner, capabilities, and dashboard link', async () => {
    localStorage.setItem('sanvi:payments:connection:dev-acme', ACTIVE_CONNECTION_FIXTURE.id)
    const { getPaymentConnection } = await import('@sanvi/api-client')
    vi.mocked(getPaymentConnection).mockResolvedValue(ACTIVE_CONNECTION_FIXTURE)

    render(PaymentsSettings)

    // Connection status section
    expect(await screen.findByText('Connection status')).toBeInTheDocument()
    // Explicit verdict banner
    expect(screen.getByText('You can accept payments')).toBeInTheDocument()
    // Capabilities
    expect(screen.getByText('Capabilities')).toBeInTheDocument()
    expect(screen.getByText('Card payments')).toBeInTheDocument()
    expect(screen.getByText('Transfers & payouts')).toBeInTheDocument()
    // Requirements empty message
    expect(screen.getByText('No outstanding requirements.')).toBeInTheDocument()
    // Real Stripe Dashboard link
    const dashboardLink = screen.getByRole('link', { name: /Open Stripe Dashboard/i })
    expect(dashboardLink).toBeInTheDocument()
    expect(dashboardLink).toHaveAttribute('href', 'https://dashboard.stripe.com')

    // Account Management section
    expect(screen.getByText('Stripe account management')).toBeInTheDocument()
  })

  it('renders pending-verification state with warning banner, requirements, and deadline', async () => {
    localStorage.setItem('sanvi:payments:connection:dev-acme', PENDING_CONNECTION_FIXTURE.id)
    const { getPaymentConnection } = await import('@sanvi/api-client')
    vi.mocked(getPaymentConnection).mockResolvedValue(PENDING_CONNECTION_FIXTURE)

    render(PaymentsSettings)

    expect(await screen.findByText('Connection status')).toBeInTheDocument()
    // Verdict banner
    expect(screen.getByText('You cannot accept payments yet')).toBeInTheDocument()
    expect(screen.getByText('Card payments capability is not yet active.')).toBeInTheDocument()

    // Requirements list with deadline
    expect(screen.getByText('Outstanding requirements')).toBeInTheDocument()
    expect(screen.getByText(/Due by 2026-09-30/)).toBeInTheDocument()
    expect(screen.getByText('Required now')).toBeInTheDocument()
    expect(screen.getByText(/Identity document/)).toBeInTheDocument()
    expect(screen.getByText(/Bank account for payouts/)).toBeInTheDocument()
    expect(screen.getByText('Required soon')).toBeInTheDocument()
    expect(screen.getByText(/Business website or social profile URL/)).toBeInTheDocument()
  })

  it('renders restricted state with distinct prominent treatment, reason, and remediation', async () => {
    localStorage.setItem('sanvi:payments:connection:dev-acme', RESTRICTED_CONNECTION_FIXTURE.id)
    const { getPaymentConnection } = await import('@sanvi/api-client')
    vi.mocked(getPaymentConnection).mockResolvedValue(RESTRICTED_CONNECTION_FIXTURE)

    render(PaymentsSettings)

    expect(await screen.findByText('Connection status')).toBeInTheDocument()
    // Distinct prominent treatment (Account restricted)
    expect(screen.getByText('Account restricted')).toBeInTheDocument()
    expect(screen.getByText(/Your Stripe account is currently restricted/)).toBeInTheDocument()
    expect(screen.getByText('Required verification items are past due.')).toBeInTheDocument()

    // Past due requirement section
    expect(screen.getByText('Past due')).toBeInTheDocument()
    expect(screen.getByText(/Due by 2026-08-15/)).toBeInTheDocument()
    expect(screen.getByText(/Identity document/)).toBeInTheDocument()
  })

  it('degrades unmapped requirement code to raw code + Stripe help link without crashing', async () => {
    localStorage.setItem('sanvi:payments:connection:dev-acme', UNMAPPED_REQUIREMENT_FIXTURE.id)
    const { getPaymentConnection } = await import('@sanvi/api-client')
    vi.mocked(getPaymentConnection).mockResolvedValue(UNMAPPED_REQUIREMENT_FIXTURE)

    render(PaymentsSettings)

    expect(await screen.findByText('Connection status')).toBeInTheDocument()
    // Renders the unmapped code
    expect(screen.getByText(/future\.unknown\.stripe\.requirement\.code/)).toBeInTheDocument()
    // Renders Stripe help link
    const helpLink = screen.getByRole('link', { name: 'Stripe verification guide' })
    expect(helpLink).toBeInTheDocument()
    expect(helpLink).toHaveAttribute(
      'href',
      'https://stripe.com/docs/connect/identity-verification',
    )
  })

  it('renders requirement messages in Japanese when locale is ja', async () => {
    setLocale('ja')
    localStorage.setItem('sanvi:payments:connection:dev-acme', PENDING_CONNECTION_FIXTURE.id)
    const { getPaymentConnection } = await import('@sanvi/api-client')
    vi.mocked(getPaymentConnection).mockResolvedValue(PENDING_CONNECTION_FIXTURE)

    render(PaymentsSettings)

    expect(await screen.findByText('接続ステータス')).toBeInTheDocument()
    expect(screen.getByText('まだ決済を受け付けられません')).toBeInTheDocument()
    expect(screen.getByText('カード決済機能がまだ有効になっていません。')).toBeInTheDocument()
    expect(screen.getByText('未完了の確認事項')).toBeInTheDocument()
    expect(screen.getByText('今すぐ必要')).toBeInTheDocument()
    expect(
      screen.getByText('本人確認書類（パスポート、運転免許証、マイナンバーカードなど）'),
    ).toBeInTheDocument()
    expect(screen.getByText('売上受取用の銀行口座情報')).toBeInTheDocument()
    expect(screen.getByText('今後必要')).toBeInTheDocument()
    expect(screen.getByText(/事業ウェブサイトまたは SNS プロフィール URL/)).toBeInTheDocument()
  })

  it('passes axe accessibility check with no color-only status', async () => {
    localStorage.setItem('sanvi:payments:connection:dev-acme', PENDING_CONNECTION_FIXTURE.id)
    const { getPaymentConnection } = await import('@sanvi/api-client')
    vi.mocked(getPaymentConnection).mockResolvedValue(PENDING_CONNECTION_FIXTURE)

    const { container } = render(PaymentsSettings)
    await screen.findByText('Connection status')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('polls connection while onboarding, updating connection state and stopping when active', async () => {
    localStorage.setItem('sanvi:payments:connection:dev-acme', PENDING_CONNECTION_FIXTURE.id)
    const { getPaymentConnection } = await import('@sanvi/api-client')

    let pollResolve: ((val: PaymentConnectionView) => void) | undefined
    let hasPolled = false
    vi.mocked(getPaymentConnection).mockImplementation(async () => {
      if (!hasPolled) {
        hasPolled = true
        return PENDING_CONNECTION_FIXTURE
      }
      return new Promise((resolve) => {
        pollResolve = resolve
      })
    })

    render(PaymentsSettings)
    expect(await screen.findByText('Connection status')).toBeInTheDocument()
    expect(screen.getByText('You cannot accept payments yet')).toBeInTheDocument()

    // Trigger poller resolution with active connection
    pollResolve?.(ACTIVE_CONNECTION_FIXTURE)

    await waitFor(() => {
      expect(screen.getByText('You can accept payments')).toBeInTheDocument()
    })
  })
})
