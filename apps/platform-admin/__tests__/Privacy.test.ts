import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Privacy from '../src/routes/Privacy.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_DSR = {
  request_id: 'req-1',
  kind: 'access',
  jurisdiction: 'us-ca',
  status: 'in_progress',
  submitted_by: 'subject',
  received_at: '2026-01-01T00:00:00Z',
  due_at: '2027-01-15T00:00:00Z',
  completed_at: null,
  rejection_reason: null,
  tenant_id: null,
  subject_key: 'subject-1',
}

const MOCK_APPEAL = {
  id: 'appeal-1',
  request_id: 'req-1',
  reason: 'I disagree with the refusal.',
  received_at: '2026-01-05T00:00:00Z',
  due_at: '2027-02-05T00:00:00Z',
  decided_at: null,
  decided_by: null,
  decision_reason: null,
  authority_notice: null,
  outcome: null,
}

const MOCK_JURISDICTION = {
  code: 'eu',
  regime: 'gdpr',
  consent_model: 'opt_in',
  response_days: 30,
  extension_days: 60,
  honours_universal_opt_out: true,
  risk_assessment_required: true,
  effective_from: '2026-01-01',
  authority: {
    name: 'European Data Protection Board',
    complaint_url: 'https://edpb.europa.eu',
  },
  breach_rules: {},
}

const MOCK_INCIDENT = {
  id: 'incident-1',
  discovered_at: '2026-01-10T00:00:00Z',
  contained_at: null,
  affected: { subjects: 3, tenants: 1, jurisdictions: ['eu'] },
  data_classes: ['contact'],
  encrypted_at_rest: false,
  notes: null,
  created_by: null,
}

const MOCK_RETENTION_RULE = {
  data_class: 'contact',
  sensitivity: 'standard',
  period_days: 365,
  action: 'delete',
  basis: null,
  disclosed_in_notice: true,
}

const MOCK_SUBPROCESSOR = {
  name: 'Acme Analytics',
  role: 'processor',
  location: 'Frankfurt, Germany',
  purpose: 'Product analytics',
  added_at: '2026-01-01T00:00:00Z',
  removed_at: null,
  contract_terms: null,
  dpa_url: null,
  transfer_mechanism: 'sccs',
}

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/platform/privacy/requests')) {
    return Promise.resolve(jsonResponse([MOCK_DSR]))
  }
  if (url.includes('/platform/privacy/appeals')) {
    return Promise.resolve(jsonResponse([MOCK_APPEAL]))
  }
  if (url.includes('/platform/privacy/jurisdictions')) {
    return Promise.resolve(jsonResponse([MOCK_JURISDICTION]))
  }
  if (url.includes('/platform/privacy/incidents')) {
    return Promise.resolve(jsonResponse([MOCK_INCIDENT]))
  }
  if (url.includes('/platform/privacy/retention-rules')) {
    return Promise.resolve(jsonResponse([MOCK_RETENTION_RULE]))
  }
  if (url.includes('/platform/privacy/subprocessors')) {
    return Promise.resolve(jsonResponse([MOCK_SUBPROCESSOR]))
  }
  return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(mockFetch))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Platform Admin Privacy Console', () => {
  it('renders the DSR queue with a request row on the Requests tab', async () => {
    render(Privacy)

    expect(await screen.findByText('access')).toBeInTheDocument()
    expect(screen.getByText('us-ca')).toBeInTheDocument()
    expect(screen.getByText('in_progress')).toBeInTheDocument()
    expect(screen.getByText('subject')).toBeInTheDocument()
  })

  it('renders a jurisdiction profile row on the Jurisdictions tab', async () => {
    render(Privacy)
    await screen.findByText('access')

    await fireEvent.click(screen.getByRole('link', { name: 'Jurisdictions' }))

    expect(await screen.findByText('European Data Protection Board')).toBeInTheDocument()
    expect(screen.getByText('gdpr')).toBeInTheDocument()
    expect(screen.getByText('opt_in')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Privacy)
    await screen.findByText('access')
    expect(await axe(container)).toHaveNoViolations()
  })
})
