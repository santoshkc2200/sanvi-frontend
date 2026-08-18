import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ApprovalRequest, { type ApprovalRequestItem } from '../src/ApprovalRequest.svelte'

const REQUEST: ApprovalRequestItem = {
  id: '1',
  actionLabel: 'entitlement.grant',
  requestedByLabel: 'alice@example.com',
  requestedAt: '2026-08-18T10:00:00Z',
  detail: 'Grant advertising.google_ads',
  targetLabel: 'Acme Corporation',
}

describe('ApprovalRequest', () => {
  it('renders the action, requester, and detail', () => {
    render(ApprovalRequest, { props: { request: REQUEST, onApprove: vi.fn(), onReject: vi.fn() } })
    expect(screen.getByText('entitlement.grant')).toBeInTheDocument()
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Grant advertising.google_ads')).toBeInTheDocument()
  })

  it('calls onApprove directly, with no confirmation step', async () => {
    const onApprove = vi.fn()
    render(ApprovalRequest, { props: { request: REQUEST, onApprove, onReject: vi.fn() } })
    await fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onApprove).toHaveBeenCalled()
  })

  it('requires a second click to reject, and calls onReject with no arguments', async () => {
    const onReject = vi.fn()
    render(ApprovalRequest, { props: { request: REQUEST, onApprove: vi.fn(), onReject } })

    await fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onReject).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm reject' })).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: 'Confirm reject' }))
    expect(onReject).toHaveBeenCalledWith()
  })

  it('cancel returns to the initial state without calling onReject', async () => {
    const onReject = vi.fn()
    render(ApprovalRequest, { props: { request: REQUEST, onApprove: vi.fn(), onReject } })

    await fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onReject).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ApprovalRequest, {
      props: { request: REQUEST, onApprove: vi.fn(), onReject: vi.fn() },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
