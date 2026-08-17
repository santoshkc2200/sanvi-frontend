import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import SuspendedTenantNotice from '../src/SuspendedTenantNotice.svelte'

describe('SuspendedTenantNotice', () => {
  it.each([
    ['suspended', 'suspended'],
    ['provisioning', 'set up'],
    ['archived', 'no longer available'],
  ] as const)('renders reason-specific copy for %s', (reason, expectedFragment) => {
    render(SuspendedTenantNotice, { props: { reason } })
    expect(screen.getByText(new RegExp(expectedFragment, 'i'))).toBeInTheDocument()
  })

  it('shows a billing link only when suspended and a billingHref is given', () => {
    render(SuspendedTenantNotice, { props: { reason: 'suspended', billingHref: '/billing' } })
    expect(screen.getByRole('link', { name: 'Go to billing' })).toHaveAttribute('href', '/billing')
  })

  it('omits the billing link for a non-suspended reason even with a billingHref', () => {
    render(SuspendedTenantNotice, { props: { reason: 'archived', billingHref: '/billing' } })
    expect(screen.queryByRole('link', { name: 'Go to billing' })).not.toBeInTheDocument()
  })

  it('omits the billing link when no billingHref is given', () => {
    render(SuspendedTenantNotice, { props: { reason: 'suspended' } })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows the trace id when provided', () => {
    render(SuspendedTenantNotice, { props: { reason: 'suspended', traceId: 'trace-123' } })
    expect(screen.getByText('Reference: trace-123')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(SuspendedTenantNotice, {
      props: { reason: 'suspended', billingHref: '/billing', traceId: 'trace-123' },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
