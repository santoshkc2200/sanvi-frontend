import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Privacy from '../src/routes/Privacy.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

// Three operator views covering different jurisdictions and statuses. Due
// dates are chosen far from any real clock: row 1 is never overdue, row 2 is
// long past but completed (no highlight), row 3 is open and long past
// (overdue highlight).
const MOCK_REQUESTS = [
  {
    request_id: '0190f0d0-0000-7000-8000-000000000001',
    tenant_id: TENANT_ID,
    kind: 'erasure',
    status: 'in_progress',
    jurisdiction: 'DE',
    received_at: '2026-08-01T00:00:00Z',
    due_at: '2126-09-01T00:00:00Z',
    subject_key: 'end_user:acme:1001',
    submitted_by: 'tenant_operator',
  },
  {
    request_id: '0190f0d0-0000-7000-8000-000000000002',
    tenant_id: TENANT_ID,
    kind: 'access',
    status: 'completed',
    jurisdiction: 'US-CA',
    received_at: '2026-07-01T00:00:00Z',
    due_at: '2020-01-15T00:00:00Z',
    subject_key: 'end_user:acme:1002',
    submitted_by: 'subject',
    completed_at: '2026-07-15T00:00:00Z',
  },
  {
    request_id: '0190f0d0-0000-7000-8000-000000000003',
    tenant_id: TENANT_ID,
    kind: 'export',
    status: 'on_hold',
    jurisdiction: 'GB',
    received_at: '2026-06-01T00:00:00Z',
    due_at: '2020-06-15T00:00:00Z',
    subject_key: 'end_user:acme:1003',
    submitted_by: 'authorized_agent',
  },
]

const MOCK_SUBMIT_OUTPUT = {
  request_id: '0190f0d0-0000-7000-8000-000000000004',
  status: 'awaiting_verification',
  jurisdiction: 'FR',
  due_at: '2126-10-01T00:00:00Z',
  effective_immediately: false,
  verification_required: true,
  challenge_id: null,
  extended_to: null,
}

function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  const method = init?.method ?? 'GET'
  if (method === 'GET' && url.includes('/tenant/privacy/requests')) {
    return Promise.resolve(jsonResponse(MOCK_REQUESTS))
  }
  if (method === 'POST' && url.includes('/tenant/privacy/requests')) {
    return Promise.resolve(jsonResponse(MOCK_SUBMIT_OUTPUT, 201))
  }
  if (url.includes('/extend')) {
    // The extend endpoint answers text/plain with the new deadline; the
    // client resolves non-JSON bodies to undefined, which the page ignores.
    return Promise.resolve(
      new Response('2127-01-01T00:00:00Z', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    )
  }
  if (url.includes('/reject')) {
    return Promise.resolve(jsonResponse({}))
  }
  return Promise.resolve(jsonResponse({ title: 'not found' }, 404))
}

beforeEach(() => {
  setMemberships([
    { tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' },
    { tenantId: 'dev-error', slug: 'error', displayName: 'Error Corp', role: 'owner' },
  ])
  switchTenant('dev-acme')
  vi.stubGlobal('fetch', vi.fn(mockFetch))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Admin Privacy Route Component', () => {
  it('renders the request table with kinds, jurisdictions, statuses and the overdue highlight', async () => {
    render(Privacy)

    expect(await screen.findByText('Data subject requests')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Requests' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Submit on behalf' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Guidance' })).toBeInTheDocument()

    expect(screen.getByText('erasure')).toBeInTheDocument()
    expect(screen.getByText('access')).toBeInTheDocument()
    expect(screen.getByText('export')).toBeInTheDocument()
    expect(screen.getByText('DE')).toBeInTheDocument()
    expect(screen.getByText('US-CA')).toBeInTheDocument()
    expect(screen.getByText('GB')).toBeInTheDocument()
    expect(screen.getByText('in_progress')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('on_hold')).toBeInTheDocument()

    // Only the open, past-due row gets the overdue badge — the completed row
    // with an older due date must not.
    const overdueBadges = screen.getAllByText(/^Due \d+d$/)
    expect(overdueBadges).toHaveLength(1)
  })

  it('disables the reject submit until a reason is entered', async () => {
    render(Privacy)
    await screen.findByText('Data subject requests')

    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' })
    await fireEvent.click(rejectButtons[0]!)

    const dialog = screen.getByRole('dialog', { name: 'Reject request' })
    const confirm = within(dialog).getByRole('button', { name: 'Reject request' })
    expect(confirm).toBeDisabled()

    const reason = within(dialog).getByLabelText(/^Reason/)
    await fireEvent.input(reason, { target: { value: 'Cannot verify the requester.' } })
    expect(confirm).not.toBeDisabled()
  })

  it('extends a deadline, closes the dialog and reloads the list', async () => {
    render(Privacy)
    await screen.findByText('Data subject requests')

    const extendButtons = screen.getAllByRole('button', { name: 'Extend' })
    await fireEvent.click(extendButtons[0]!)

    const dialog = screen.getByRole('dialog', { name: 'Extend deadline' })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm extension' }))

    // Success closes the dialog and reloads the list — the closing and the
    // loading swap flush together, so once the dialog is gone the table is
    // being refetched; wait for the reloaded rows rather than the pre-reload
    // nodes (which the loading render detaches).
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('erasure')).toBeInTheDocument()
  })

  it('submits a request on behalf of an end user and surfaces jurisdiction and due date', async () => {
    render(Privacy)
    await screen.findByText('Data subject requests')

    await fireEvent.click(screen.getByRole('link', { name: 'Submit on behalf' }))

    const email = screen.getByLabelText(/^End-user email/)
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled()
    await fireEvent.input(email, { target: { value: 'customer@example.com' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByText(/Jurisdiction FR/)).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Privacy)
    await screen.findByText('Data subject requests')
    expect(await axe(container)).toHaveNoViolations()
  })
})
