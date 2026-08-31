import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DomainPurchase from '../src/routes/DomainPurchase.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    hostname: 'freshstore.com',
    tld: 'com',
    available: true,
    premium: false,
    register_price: { amount_minor: 1299, currency: 'USD' },
    renew_price: { amount_minor: 1499, currency: 'USD' },
    registrar_id: 'enom',
    ...overrides,
  }
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord_purch123',
    hostname: 'freshstore.com',
    term_years: 1,
    price_minor: 1299,
    currency: 'USD',
    status: 'pending',
    auto_renew: true,
    whois_privacy: true,
    created_at: '2026-08-30T00:00:00Z',
    ...overrides,
  }
}

function makeCustomDomain(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dom_purch123',
    hostname: 'freshstore.com',
    kind: 'purchased',
    role: 'primary',
    status: 'pending_setup',
    challenge: {
      challenge_type: 'txt',
      token: 'tok_purch123',
      txt_name: '_sanvi-challenge.freshstore.com',
      txt_value: 'sanvi-verification=tok_purch123',
      expires_at: '2026-09-01T00:00:00Z',
    },
    created_at: '2026-08-30T00:00:00Z',
    updated_at: '2026-08-30T00:00:00Z',
    ...overrides,
  }
}

describe('Admin DomainPurchase Wizard Component', () => {
  let searchResultsList: ReturnType<typeof makeQuote>[] = []
  let ordersList: ReturnType<typeof makeOrder>[] = []
  let customDomainsList: ReturnType<typeof makeCustomDomain>[] = []

  beforeEach(() => {
    setMemberships([
      { tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' },
      { tenantId: 'dev-unentitled', slug: 'unentitled', displayName: 'Unentitled', role: 'owner' },
    ])
    switchTenant('dev-acme')

    searchResultsList = [
      makeQuote({ hostname: 'freshstore.com', available: true }),
      makeQuote({
        hostname: 'freshstore.net',
        tld: 'net',
        available: false,
        register_price: { amount_minor: 1599, currency: 'USD' },
      }),
      makeQuote({
        hostname: 'freshstore.ai',
        tld: 'ai',
        available: true,
        premium: true,
        register_price: { amount_minor: 6999, currency: 'USD' },
        renew_price: { amount_minor: 6999, currency: 'USD' },
      }),
    ]
    ordersList = []
    customDomainsList = []

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = init?.method || 'GET'

        if (url.includes('/tenant/domains/search')) {
          return Promise.resolve(
            jsonResponse({
              query: 'freshstore',
              registrar_id: 'enom',
              results: searchResultsList,
            }),
          )
        }

        if (url.includes('/tenant/domains/orders') && method === 'POST') {
          const parsedBody = init?.body ? JSON.parse(init.body as string) : {}
          const newOrder = makeOrder({
            hostname: parsedBody.hostname || 'freshstore.com',
            term_years: parsedBody.term_years || 1,
            auto_renew: parsedBody.auto_renew ?? true,
            whois_privacy: parsedBody.whois_privacy ?? true,
            status: 'pending',
          })
          ordersList = [newOrder]
          return Promise.resolve(jsonResponse(newOrder, 201))
        }

        if (url.includes('/tenant/domains/orders') && method === 'GET') {
          return Promise.resolve(jsonResponse(ordersList))
        }

        if (url.includes('/tenant/domains') && method === 'GET') {
          return Promise.resolve(jsonResponse(customDomainsList))
        }

        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders Step 1 (search) in idle state and searches domains with debounce', async () => {
    render(DomainPurchase)

    expect(
      await screen.findByRole('heading', { name: 'Step 1: Search for a domain', level: 2 }),
    ).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'freshstore' } })

    expect(await screen.findByText('freshstore.com')).toBeInTheDocument()
    expect(screen.getByText('freshstore.net')).toBeInTheDocument()
    expect(screen.getByText('freshstore.ai')).toBeInTheDocument()

    expect(screen.getByText('$12.99 / 1st year')).toBeInTheDocument()
    expect(screen.getByText('• Renews at $14.99 / year')).toBeInTheDocument()
    expect(screen.getByText('Premium')).toBeInTheDocument()

    const continueBtn = screen.getByRole('button', { name: 'Continue to options' })
    expect(continueBtn).toBeDisabled()

    const selectButtons = screen.getAllByRole('button', { name: 'Select' })
    await fireEvent.click(selectButtons[0]!)

    expect(screen.getByRole('button', { name: 'Selected' })).toBeInTheDocument()
    expect(continueBtn).not.toBeDisabled()
  })

  it('handles empty search results state', async () => {
    searchResultsList = []
    render(DomainPurchase)

    const searchInput = await screen.findByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'nonexistentquery123' } })

    expect(
      await screen.findByText(
        'No domains found. Try searching for a different keyword or extension.',
      ),
    ).toBeInTheDocument()
  })

  it('progresses through Steps 1 to 4: selecting term, privacy, and entering registrant info', async () => {
    render(DomainPurchase)

    const searchInput = await screen.findByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'freshstore' } })

    const selectBtns = await screen.findAllByRole('button', { name: 'Select' })
    await fireEvent.click(selectBtns[0]!)

    const continueToOptionsBtn = screen.getByRole('button', { name: 'Continue to options' })
    await fireEvent.click(continueToOptionsBtn)

    // Step 2: Options
    expect(
      await screen.findByRole('heading', { name: 'Step 2: Domain options', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('freshstore.com')).toBeInTheDocument()

    const autoRenewCheckbox = screen.getByRole('checkbox', { name: /Automatic renewal/ })
    expect(autoRenewCheckbox).toBeChecked()

    const whoisPrivacyCheckbox = screen.getByRole('checkbox', {
      name: /WHOIS privacy protection/,
    })
    expect(whoisPrivacyCheckbox).toBeChecked()

    const continueToRegistrantBtn = screen.getByRole('button', {
      name: 'Continue to registrant details',
    })
    await fireEvent.click(continueToRegistrantBtn)

    // Step 3: Registrant
    expect(
      await screen.findByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Your contact details will be securely transmitted to the domain registrar/),
    ).toBeInTheDocument()

    const continueToReviewBtn = screen.getByRole('button', {
      name: 'Continue to review & payment',
    })
    await fireEvent.click(continueToReviewBtn)

    // Validation fails with empty fields
    expect(
      await screen.findByText('Please fill in all required contact fields.'),
    ).toBeInTheDocument()

    // Fill valid contact fields
    const nameInput = screen.getByPlaceholderText('Jane Doe')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const phoneInput = screen.getByPlaceholderText('+1.5551234567 or +81-3-1234-5678')

    await fireEvent.input(nameInput, { target: { value: 'Alice Smith' } })
    await fireEvent.input(emailInput, { target: { value: 'alice@example.com' } })
    await fireEvent.input(phoneInput, { target: { value: '+1.5551234567' } })

    await fireEvent.click(continueToReviewBtn)

    // Step 4: Review & Pay
    expect(
      await screen.findByRole('heading', { name: 'Step 4: Review and confirm order', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Alice Smith (alice@example.com)')).toBeInTheDocument()
    expect(screen.getByText('$12.99')).toBeInTheDocument()
    expect(screen.getByText('Year 2+ renewal price: $14.99 / year')).toBeInTheDocument()
    expect(
      screen.getByText(/Domain registrations are final and non-refundable/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm & place order' })).toBeInTheDocument()
  })

  it('completes purchase order in Step 4 and transitions to Step 5 (provisioning)', async () => {
    render(DomainPurchase)

    const searchInput = await screen.findByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'freshstore' } })

    const selectBtns = await screen.findAllByRole('button', { name: 'Select' })
    await fireEvent.click(selectBtns[0]!)
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to options' }))

    await screen.findByRole('heading', { name: 'Step 2: Domain options', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to registrant details' }))

    await screen.findByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 })
    await fireEvent.input(screen.getByPlaceholderText('Jane Doe'), {
      target: { value: 'Alice Smith' },
    })
    await fireEvent.input(screen.getByPlaceholderText('owner@example.com'), {
      target: { value: 'alice@example.com' },
    })
    await fireEvent.input(screen.getByPlaceholderText('+1.5551234567 or +81-3-1234-5678'), {
      target: { value: '+1.5551234567' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to review & payment' }))

    await screen.findByRole('heading', { name: 'Step 4: Review and confirm order', level: 2 })
    const placeOrderBtn = screen.getByRole('button', { name: 'Confirm & place order' })
    await fireEvent.click(placeOrderBtn)

    expect(
      await screen.findByRole('heading', { name: 'Step 5: Provisioning your domain', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Processing payment…/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/You can safely navigate away from this page/)).toBeInTheDocument()
  })

  it('handles Failed order terminal state with non-charged copy', async () => {
    ordersList = [
      makeOrder({
        id: 'ord_failed',
        hostname: 'failedstore.com',
        status: 'failed',
      }),
    ]

    render(DomainPurchase, { props: { orderId: 'ord_failed' } })

    expect(
      await screen.findByRole('heading', { name: 'Step 5: Provisioning your domain', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Domain registration failed')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The domain registration order could not be completed. Your payment method was not charged.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search another domain' })).toBeInTheDocument()
  })

  it('handles Refunded order terminal state with refunded copy', async () => {
    ordersList = [
      makeOrder({
        id: 'ord_refunded',
        hostname: 'refundedstore.com',
        status: 'refunded',
      }),
    ]

    render(DomainPurchase, { props: { orderId: 'ord_refunded' } })

    expect(
      await screen.findByRole('heading', { name: 'Step 5: Provisioning your domain', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Order failed and refunded')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Registration could not be completed with the registrar after payment. A full refund has been issued to your payment method.',
      ),
    ).toBeInTheDocument()
  })

  it('resumes directly at Step 6 when domain is live', async () => {
    ordersList = [
      makeOrder({
        id: 'ord_active',
        hostname: 'livestore.com',
        status: 'active',
      }),
    ]
    customDomainsList = [
      makeCustomDomain({
        id: 'dom_live',
        hostname: 'livestore.com',
        status: 'live',
      }),
    ]

    render(DomainPurchase, { props: { orderId: 'ord_active' } })

    expect(
      await screen.findByRole('heading', { name: 'Step 6: Your domain is live!', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Live at: https://livestore.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Visit storefront' })).toHaveAttribute(
      'href',
      'https://livestore.com',
    )
    expect(screen.getByRole('link', { name: 'View domain settings' })).toHaveAttribute(
      'href',
      '/domains/dom_live',
    )
  })

  it('renders upgrade prompt when tenant lacks domains.custom entitlement', async () => {
    switchTenant('dev-unentitled')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            { title: 'Forbidden', status: 403, detail: 'domains.custom not entitled' },
            403,
          ),
        ),
      ),
    )

    render(DomainPurchase)

    expect(await screen.findByText('Custom domains require an upgrade')).toBeInTheDocument()
  })

  it('registers for a one-year term and charges exactly the quoted register_price', async () => {
    render(DomainPurchase)

    const searchInput = await screen.findByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'freshstore' } })

    const selectBtns = await screen.findAllByRole('button', { name: 'Select' })
    await fireEvent.click(selectBtns[0]!)
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to options' }))

    // Step 2: the term is stated, not chosen — the search quote has no term
    // dimension, so a picker here could only misprice the order.
    await screen.findByRole('heading', { name: 'Step 2: Domain options', level: 2 })
    expect(screen.getByText('1 year')).toBeInTheDocument()
    expect(screen.getByText(/Domains are registered for one year/)).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: 'Continue to registrant details' }))

    // Step 3: Fill contact
    await screen.findByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 })
    await fireEvent.input(screen.getByPlaceholderText('Jane Doe'), {
      target: { value: 'Bob Builder' },
    })
    await fireEvent.input(screen.getByPlaceholderText('owner@example.com'), {
      target: { value: 'bob@example.com' },
    })
    await fireEvent.input(screen.getByPlaceholderText('+1.5551234567 or +81-3-1234-5678'), {
      target: { value: '+1.5559876543' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to review & payment' }))

    await screen.findByRole('heading', { name: 'Step 4: Review and confirm order', level: 2 })
    expect(screen.getByText('$12.99')).toBeInTheDocument()
  })

  it('resets to search step when clicking try again from failed order state', async () => {
    ordersList = [
      makeOrder({
        id: 'ord_failed_reset',
        hostname: 'resetstore.com',
        status: 'failed',
      }),
    ]

    render(DomainPurchase, { props: { orderId: 'ord_failed_reset' } })

    const tryAgainBtn = await screen.findByRole('button', { name: 'Search another domain' })
    await fireEvent.click(tryAgainBtn)

    expect(
      await screen.findByRole('heading', { name: 'Step 1: Search for a domain', level: 2 }),
    ).toBeInTheDocument()
  })

  it('handles search API failure with error alert', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/domains/search')) {
          return Promise.resolve(jsonResponse({ title: 'Internal Error' }, 500))
        }
        if (url.includes('/tenant/domains/orders')) {
          return Promise.resolve(jsonResponse([]))
        }
        if (url.includes('/tenant/domains')) {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainPurchase)

    const searchInput = await screen.findByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'errorquery' } })

    expect(
      await screen.findByText(
        'Could not search domain availability. Please try again.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()
  })

  it('supports back navigation between wizard steps', async () => {
    render(DomainPurchase)

    const searchInput = await screen.findByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'freshstore' } })

    const selectBtns = await screen.findAllByRole('button', { name: 'Select' })
    await fireEvent.click(selectBtns[0]!)
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to options' }))

    // In Step 2 -> Go back to Step 1
    await screen.findByRole('heading', { name: 'Step 2: Domain options', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      await screen.findByRole('heading', { name: 'Step 1: Search for a domain', level: 2 }),
    ).toBeInTheDocument()

    // Go back to Step 2 -> Step 3
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to options' }))
    await screen.findByRole('heading', { name: 'Step 2: Domain options', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to registrant details' }))

    // In Step 3 -> Go back to Step 2
    await screen.findByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      await screen.findByRole('heading', { name: 'Step 2: Domain options', level: 2 }),
    ).toBeInTheDocument()

    // Back to Step 3 -> fill details -> Step 4
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to registrant details' }))
    await screen.findByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 })

    // Test invalid email format validation
    await fireEvent.input(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Jane' } })
    await fireEvent.input(screen.getByPlaceholderText('owner@example.com'), {
      target: { value: 'invalid-email-format' },
    })
    await fireEvent.input(screen.getByPlaceholderText('+1.5551234567 or +81-3-1234-5678'), {
      target: { value: '+1.5551234567' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to review & payment' }))
    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument()

    // Fix email -> advance to Step 4
    await fireEvent.input(screen.getByPlaceholderText('owner@example.com'), {
      target: { value: 'jane@example.com' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to review & payment' }))

    // In Step 4 -> Go back to Step 3
    await screen.findByRole('heading', { name: 'Step 4: Review and confirm order', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      await screen.findByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 }),
    ).toBeInTheDocument()
  })

  it('handles order placement API 500 error in Step 4', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = init?.method || 'GET'
        if (url.includes('/tenant/domains/search')) {
          return Promise.resolve(
            jsonResponse({
              query: 'freshstore',
              registrar_id: 'enom',
              results: searchResultsList,
            }),
          )
        }
        if (url.includes('/tenant/domains/orders') && method === 'POST') {
          return Promise.resolve(jsonResponse({ title: 'Internal Server Error', status: 500 }, 500))
        }
        if (url.includes('/tenant/domains/orders') && method === 'GET') {
          return Promise.resolve(jsonResponse([]))
        }
        if (url.includes('/tenant/domains') && method === 'GET') {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainPurchase)

    const searchInput = await screen.findByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'freshstore' } })

    const selectBtns = await screen.findAllByRole('button', { name: 'Select' })
    await fireEvent.click(selectBtns[0]!)
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to options' }))

    await screen.findByRole('heading', { name: 'Step 2: Domain options', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to registrant details' }))

    await screen.findByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 })
    await fireEvent.input(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Jane' } })
    await fireEvent.input(screen.getByPlaceholderText('owner@example.com'), {
      target: { value: 'jane@example.com' },
    })
    await fireEvent.input(screen.getByPlaceholderText('+1.5551234567 or +81-3-1234-5678'), {
      target: { value: '+1.5551234567' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to review & payment' }))

    await screen.findByRole('heading', { name: 'Step 4: Review and confirm order', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm & place order' }))

    expect(
      await screen.findByText('Could not load custom domains. Please try again in a moment.'),
    ).toBeInTheDocument()
  })

  it('handles order placement 403 entitlement error in Step 4', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = init?.method || 'GET'
        if (url.includes('/tenant/domains/search')) {
          return Promise.resolve(
            jsonResponse({
              query: 'freshstore',
              registrar_id: 'enom',
              results: searchResultsList,
            }),
          )
        }
        if (url.includes('/tenant/domains/orders') && method === 'POST') {
          return Promise.resolve(
            jsonResponse({ title: 'Forbidden', status: 403, detail: 'Not entitled' }, 403),
          )
        }
        if (url.includes('/tenant/domains/orders') && method === 'GET') {
          return Promise.resolve(jsonResponse([]))
        }
        if (url.includes('/tenant/domains') && method === 'GET') {
          return Promise.resolve(jsonResponse([]))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainPurchase)

    const searchInput = await screen.findByPlaceholderText('example.com or mystore')
    await fireEvent.input(searchInput, { target: { value: 'freshstore' } })

    const selectBtns = await screen.findAllByRole('button', { name: 'Select' })
    await fireEvent.click(selectBtns[0]!)
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to options' }))

    await screen.findByRole('heading', { name: 'Step 2: Domain options', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to registrant details' }))

    await screen.findByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 })
    await fireEvent.input(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Jane' } })
    await fireEvent.input(screen.getByPlaceholderText('owner@example.com'), {
      target: { value: 'jane@example.com' },
    })
    await fireEvent.input(screen.getByPlaceholderText('+1.5551234567 or +81-3-1234-5678'), {
      target: { value: '+1.5551234567' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to review & payment' }))

    await screen.findByRole('heading', { name: 'Step 4: Review and confirm order', level: 2 })
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm & place order' }))

    expect(await screen.findByText('Custom domains require an upgrade')).toBeInTheDocument()
  })

  it.each([
    ['registered', undefined, 'Registering domain with registrar…'],
    ['configuring', undefined, 'Applying DNS and routing configuration…'],
    ['active', 'verifying', 'Verifying DNS propagation…'],
    ['active', 'issuing_cert', 'Issuing automated SSL/TLS certificate…'],
  ])(
    'renders provisioning sub-state for order status %s and domain status %s',
    async (orderStatus, domainStatus, expectedText) => {
      ordersList = [
        makeOrder({
          id: 'ord_substate',
          hostname: 'substatestore.com',
          status: orderStatus,
        }),
      ]
      if (domainStatus) {
        customDomainsList = [
          makeCustomDomain({
            id: 'dom_substate',
            hostname: 'substatestore.com',
            status: domainStatus,
          }),
        ]
      }

      render(DomainPurchase, { props: { orderId: 'ord_substate' } })

      expect(
        await screen.findByRole('heading', { name: 'Step 5: Provisioning your domain', level: 2 }),
      ).toBeInTheDocument()
      expect(screen.getAllByText(expectedText).length).toBeGreaterThanOrEqual(1)
    },
  )

  it('has no accessibility violations across wizard initial step', async () => {
    const { container } = render(DomainPurchase)
    await screen.findByRole('heading', { name: 'Step 1: Search for a domain', level: 2 })
    expect(await axe(container)).toHaveNoViolations()
  })
})
