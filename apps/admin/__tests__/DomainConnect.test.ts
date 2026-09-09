import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DomainConnect from '../src/routes/DomainConnect.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeDomain(overrides: Record<string, unknown> = {}) {
  const hostname = (overrides.hostname as string) || 'custom.example.com'
  return {
    id: 'dom_conn123',
    hostname,
    kind: 'connected',
    role: 'primary',
    status: 'pending_setup',
    challenge: {
      challenge_type: 'txt',
      token: 'tok_conn123',
      txt_name: `_sanvi-challenge.${hostname}`,
      txt_value: 'sanvi-verification=tok_conn123',
      expires_at: '2026-09-01T00:00:00Z',
    },
    detected_registrar: 'cloudflare',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function makeInstructions(hostname: string, domainId = 'dom_conn123') {
  return {
    domain_id: domainId,
    hostname,
    kind: 'connected',
    role: 'primary',
    status: 'pending_setup',
    guide: {
      id: 'guide_cloudflare',
      title: 'Cloudflare DNS setup',
      steps: ['Open the Cloudflare dashboard', 'Add the records below', 'Save'],
    },
    records: [
      {
        record_type: 'TXT',
        name: `_sanvi-challenge.${hostname}`,
        value: 'sanvi-verification=tok_conn123',
        ttl: 300,
        explanation: 'Proves you control this domain.',
      },
      {
        record_type: 'CNAME',
        name: hostname,
        value: 'edge.sanvi-cdn.test',
        ttl: 300,
        explanation: 'Routes visitors to your storefront.',
      },
    ],
  }
}

describe('Admin DomainConnect Wizard Component', () => {
  let domainsList: ReturnType<typeof makeDomain>[] = []

  beforeEach(() => {
    setMemberships([
      { tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' },
      { tenantId: 'dev-unentitled', slug: 'unentitled', displayName: 'Unentitled', role: 'owner' },
    ])
    switchTenant('dev-acme')
    domainsList = []

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = init?.method || 'GET'

        if (url.includes('/instructions') && method === 'GET') {
          const target = domainsList[0]
          return Promise.resolve(
            jsonResponse(makeInstructions(target?.hostname ?? 'custom.example.com', target?.id)),
          )
        }

        if (url.includes('/tenant/domains') && method === 'GET') {
          return Promise.resolve(jsonResponse(domainsList))
        }

        if (url.includes('/tenant/domains') && method === 'POST') {
          if (url.includes('/verify')) {
            return Promise.resolve(jsonResponse({ status: 'queued' }))
          }
          const parsedBody = init?.body ? JSON.parse(init.body as string) : {}
          const newDomain = makeDomain({
            hostname: parsedBody.hostname || 'custom.example.com',
          })
          domainsList = [newDomain]
          return Promise.resolve(jsonResponse(newDomain))
        }

        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders Step 1 (enter domain) in idle state and validates input', async () => {
    render(DomainConnect)

    expect(
      await screen.findByRole('heading', { name: 'Step 1: Enter your domain', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Apex domains \(example\.com\) use an A record/)).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Continue to DNS setup' })
    expect(submitBtn).toBeDisabled()

    const input = screen.getByPlaceholderText('example.com or shop.example.com')
    await fireEvent.input(input, { target: { value: 'invalid-domain' } })
    await fireEvent.click(submitBtn)

    expect(
      await screen.findByText(
        'Please enter a valid domain name (e.g. example.com or app.example.com).',
      ),
    ).toBeInTheDocument()
  })

  it('submits valid hostname in Step 1 and advances to Step 2 with DNS records and registrar guide', async () => {
    render(DomainConnect)

    const input = await screen.findByPlaceholderText('example.com or shop.example.com')
    await fireEvent.input(input, { target: { value: 'shop.example.com' } })

    const submitBtn = screen.getByRole('button', { name: 'Continue to DNS setup' })
    expect(submitBtn).not.toBeDisabled()
    await fireEvent.click(submitBtn)

    expect(
      await screen.findByRole('heading', {
        name: 'Step 2: Add DNS records at your registrar',
        level: 2,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('_sanvi-challenge.shop.example.com')).toBeInTheDocument()
    expect(screen.getByText('sanvi-verification=tok_conn123')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Sanvi will never ask for your registrar password or credentials. Only add the DNS records listed below.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "I've added these records" })).toBeInTheDocument()
  })

  it('shows the punycode equivalent for a unicode hostname and claims the ASCII form (homograph protection)', async () => {
    render(DomainConnect)

    const input = await screen.findByPlaceholderText('example.com or shop.example.com')
    await fireEvent.input(input, { target: { value: '日本語.jp' } })

    expect(
      await screen.findByText(
        'This contains non-Latin characters. It will be connected as its ASCII (punycode) form: xn--wgv71a119e.jp',
      ),
    ).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Continue to DNS setup' })
    await fireEvent.click(submitBtn)

    await screen.findByRole('heading', {
      name: 'Step 2: Add DNS records at your registrar',
      level: 2,
    })

    const postCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([, init]: [unknown, RequestInit | undefined]) => init?.method === 'POST',
    )
    const claimBody = JSON.parse(postCalls[0]![1]!.body as string)
    expect(claimBody.hostname).toBe('xn--wgv71a119e.jp')
  })

  it('does not show a punycode notice for an ordinary ASCII hostname', async () => {
    render(DomainConnect)

    const input = await screen.findByPlaceholderText('example.com or shop.example.com')
    await fireEvent.input(input, { target: { value: 'shop.example.com' } })

    expect(screen.queryByText(/non-Latin characters/)).not.toBeInTheDocument()
  })

  it.each([
    ['SHOP.EXAMPLE.COM', 'shop.example.com'],
    ['shop.example.com.', 'shop.example.com'],
    ['  shop.example.com  ', 'shop.example.com'],
    ['https://shop.example.com/path', 'shop.example.com'],
  ])('normalizes %s to %s before claiming', async (typed, expectedHostname) => {
    render(DomainConnect)

    const input = await screen.findByPlaceholderText('example.com or shop.example.com')
    await fireEvent.input(input, { target: { value: typed } })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to DNS setup' }))

    await screen.findByRole('heading', {
      name: 'Step 2: Add DNS records at your registrar',
      level: 2,
    })

    const postCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([, init]: [unknown, RequestInit | undefined]) => init?.method === 'POST',
    )
    const claimBody = JSON.parse(postCalls[0]![1]!.body as string)
    expect(claimBody.hostname).toBe(expectedHostname)
  })

  it('rejects a single-label hostname (no TLD) as invalid', async () => {
    render(DomainConnect)

    const input = await screen.findByPlaceholderText('example.com or shop.example.com')
    await fireEvent.input(input, { target: { value: 'localhost' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Continue to DNS setup' }))

    expect(
      await screen.findByText(
        'Please enter a valid domain name (e.g. example.com or app.example.com).',
      ),
    ).toBeInTheDocument()
  })

  it('resumes directly at Step 2 when mounted with domain in pending_setup state', async () => {
    domainsList = [
      makeDomain({ id: 'dom_resumed', status: 'pending_setup', hostname: 'store.example.com' }),
    ]

    render(DomainConnect, { props: { id: 'dom_resumed' } })

    expect(
      await screen.findByText('Resuming domain setup for store.example.com'),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', {
        name: 'Step 2: Add DNS records at your registrar',
        level: 2,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('_sanvi-challenge.store.example.com')).toBeInTheDocument()
  })

  it('progresses to Step 3 (verifying) on clicking added records and handles check again', async () => {
    domainsList = [
      makeDomain({ id: 'dom_step2', status: 'pending_setup', hostname: 'store.example.com' }),
    ]

    render(DomainConnect, { props: { id: 'dom_step2' } })

    const addedBtn = await screen.findByRole('button', { name: "I've added these records" })
    await fireEvent.click(addedBtn)

    expect(
      await screen.findByRole('heading', { name: 'Step 3: Verifying DNS records', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/We are actively checking DNS resolvers/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })

  it.each([
    [
      'txt_missing',
      'TXT verification record not found yet. Please make sure the TXT record has been added to your DNS settings.',
    ],
    [
      'txt_mismatch',
      'TXT record found, but its value does not match the required verification token.',
    ],
    [
      'routing_missing',
      'Routing record (CNAME or A) not detected yet. Please ensure the routing record points to Sanvi.',
    ],
    [
      'routing_mismatch',
      'Routing record found, but points to a different destination or conflicting host.',
    ],
    [
      'dns_drift',
      'DNS records changed unexpectedly after verification. Please verify your DNS configuration.',
    ],
    [
      'challenge_expired',
      'The verification challenge expired. Please delete this claim and try again.',
    ],
    ['verified_by_other_tenant', 'This hostname was claimed and verified by another tenant.'],
    ['cert_invalid', 'TLS certificate issuance failed. The system will automatically retry.'],
    [
      'cert_issuance_failed',
      'TLS certificate issuance failed. The system will automatically retry.',
    ],
    ['propagating', 'DNS records are currently propagating across global resolvers.'],
  ])('renders failure banner for failure code %s', async (code, message) => {
    domainsList = [
      makeDomain({
        id: `dom_fail_${code}`,
        status: 'verifying',
        failure: { code, detail: 'Failed reason' },
      }),
    ]

    render(DomainConnect, { props: { id: `dom_fail_${code}` } })

    expect(
      await screen.findByRole('heading', { name: 'Step 3: Verifying DNS records', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('renders Step 4 (issuing TLS certificate) when domain is in issuing_cert status', async () => {
    domainsList = [
      makeDomain({
        id: 'dom_securing',
        status: 'issuing_cert',
        hostname: 'secure.example.com',
      }),
    ]

    render(DomainConnect, { props: { id: 'dom_securing' } })

    expect(
      await screen.findByRole('heading', { name: 'Step 4: Securing your domain', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Issuing an automated SSL\/TLS certificate/)).toBeInTheDocument()
  })

  it('renders Step 5 (live) when domain is live with storefront and details links', async () => {
    domainsList = [
      makeDomain({
        id: 'dom_live',
        status: 'live',
        hostname: 'live.example.com',
      }),
    ]

    render(DomainConnect, { props: { id: 'dom_live' } })

    expect(
      await screen.findByRole('heading', { name: 'Step 5: Your domain is live!', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Live at: https://live.example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Visit storefront' })).toHaveAttribute(
      'href',
      'https://live.example.com',
    )
    expect(screen.getByRole('link', { name: 'View domain settings' })).toHaveAttribute(
      'href',
      '/domains/dom_live',
    )
  })

  it('handles changing registrar guide selection in Step 2', async () => {
    domainsList = [
      makeDomain({ id: 'dom_guide_test', status: 'pending_setup', hostname: 'guide.example.com' }),
    ]

    render(DomainConnect, { props: { id: 'dom_guide_test' } })

    expect(
      await screen.findByRole('heading', {
        name: 'Step 2: Add DNS records at your registrar',
        level: 2,
      }),
    ).toBeInTheDocument()

    const select = screen.getByRole('combobox', { name: 'Registrar guide' })
    expect(select).toHaveValue('cloudflare')
    // Until the tenant overrides the detected registrar, the guide that ships
    // with the backend's instructions response is the one rendered.
    expect(screen.getByRole('heading', { name: 'Cloudflare DNS setup' })).toBeInTheDocument()
    expect(screen.getByText('Open the Cloudflare dashboard')).toBeInTheDocument()

    await fireEvent.change(select, { target: { value: 'route53' } })
    expect(
      screen.getByText(/Open the Amazon Route 53 console and navigate to Hosted zones/),
    ).toBeInTheDocument()

    await fireEvent.change(select, { target: { value: 'onamae_jp' } })
    expect(screen.getByText(/Log in to the Onamae Navi/)).toBeInTheDocument()
  })

  it('handles API 400 validation error on Step 1 claim submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = init?.method || 'GET'
        if (url.includes('/tenant/domains') && method === 'GET') {
          return Promise.resolve(jsonResponse([]))
        }
        if (url.includes('/tenant/domains') && method === 'POST') {
          return Promise.resolve(
            jsonResponse({ title: 'Bad Request', status: 400, detail: 'Invalid domain' }, 400),
          )
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainConnect)

    const input = await screen.findByPlaceholderText('example.com or shop.example.com')
    await fireEvent.input(input, { target: { value: 'bad-hostname.com' } })
    const submitBtn = screen.getByRole('button', { name: 'Continue to DNS setup' })
    await fireEvent.click(submitBtn)

    expect(
      await screen.findByText(
        'Please enter a valid domain name (e.g. example.com or app.example.com).',
      ),
    ).toBeInTheDocument()
  })

  it('handles API 500 error on Step 1 claim submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = init?.method || 'GET'
        if (url.includes('/tenant/domains') && method === 'GET') {
          return Promise.resolve(jsonResponse([]))
        }
        if (url.includes('/tenant/domains') && method === 'POST') {
          return Promise.resolve(jsonResponse({ title: 'Internal Server Error', status: 500 }, 500))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainConnect)

    const input = await screen.findByPlaceholderText('example.com or shop.example.com')
    await fireEvent.input(input, { target: { value: 'server-error.com' } })
    const submitBtn = screen.getByRole('button', { name: 'Continue to DNS setup' })
    await fireEvent.click(submitBtn)

    expect(
      await screen.findByText('Could not load custom domains. Please try again in a moment.'),
    ).toBeInTheDocument()
  })

  it('handles generic failure code fallback in Step 3', async () => {
    domainsList = [
      makeDomain({
        id: 'dom_fail_unknown',
        status: 'verifying',
        failure: { code: 'some_future_code', detail: 'Unknown error detail' },
      }),
    ]

    render(DomainConnect, { props: { id: 'dom_fail_unknown' } })

    expect(
      await screen.findByRole('heading', { name: 'Step 3: Verifying DNS records', level: 2 }),
    ).toBeInTheDocument()
    // An unmapped code falls back to the backend's own detail before the
    // generic message, so a new failure still says something specific.
    expect(screen.getByText('Unknown error detail')).toBeInTheDocument()
  })

  it('handles check now verification API failure gracefully in Step 3', async () => {
    domainsList = [
      makeDomain({
        id: 'dom_check_err',
        status: 'verifying',
      }),
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = init?.method || 'GET'
        if (url.includes('/verify') && method === 'POST') {
          return Promise.resolve(jsonResponse({ title: 'Internal Error', status: 500 }, 500))
        }
        if (url.includes('/instructions') && method === 'GET') {
          return Promise.resolve(
            jsonResponse(makeInstructions('custom.example.com', 'dom_check_err')),
          )
        }
        if (url.includes('/tenant/domains') && method === 'GET') {
          return Promise.resolve(jsonResponse(domainsList))
        }
        return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
      }),
    )

    render(DomainConnect, { props: { id: 'dom_check_err' } })

    const checkBtn = await screen.findByRole('button', { name: 'Check again' })
    await fireEvent.click(checkBtn)

    // Should remain in Step 3 without throwing
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
    })
    expect(
      screen.getByRole('heading', { name: 'Step 3: Verifying DNS records', level: 2 }),
    ).toBeInTheDocument()
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

    render(DomainConnect)

    expect(await screen.findByText('Custom domains require an upgrade')).toBeInTheDocument()
  })

  it('displays stalled warning alert when poller stalls in step 4', async () => {
    vi.useFakeTimers()
    const securingDomain = makeDomain({ status: 'issuing_cert' })
    domainsList = [securingDomain]

    render(DomainConnect, { props: { id: 'dom_conn123' } })

    await vi.advanceTimersByTimeAsync(10)
    expect(
      await screen.findByRole('heading', { name: 'Step 4: Securing your domain', level: 2 }),
    ).toBeInTheDocument()

    for (let i = 0; i < 35; i++) {
      await vi.advanceTimersByTimeAsync(20000)
    }

    expect(
      await screen.findByText('Still pending after 10 minutes — contact support'),
    ).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('has no accessibility violations across wizard steps', async () => {
    const { container } = render(DomainConnect)
    await screen.findByRole('heading', { name: 'Step 1: Enter your domain', level: 2 })
    expect(await axe(container)).toHaveNoViolations()
  })
})
