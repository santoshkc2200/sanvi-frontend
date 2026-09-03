import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { initI18n } from '@sanvi/i18n'
import { describe, expect, it } from 'vitest'
import ConfirmingState from '../src/lib/checkout/ConfirmingState.svelte'

describe('ConfirmingState component', () => {
  initI18n({ locale: 'en' })

  it('renders spinner and confirming instructions in a polite live region', () => {
    render(ConfirmingState, { props: { delayed: false } })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Confirming your payment...',
    )
    expect(screen.getByText(/Please wait while we verify your transaction/)).toBeInTheDocument()
  })

  it('renders delayed reassurance notice when confirmation takes longer than usual without false failure', () => {
    render(ConfirmingState, { props: { delayed: true } })

    expect(
      screen.getByText(
        "Payment confirmation is taking longer than usual. We'll send your receipt and order details by email as soon as it completes.",
      ),
    ).toBeInTheDocument()
    // Invariant: never false failure
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ConfirmingState, { props: { delayed: true } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
