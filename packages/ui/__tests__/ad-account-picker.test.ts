import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import AdAccountPicker from '../src/advertising/AdAccountPicker.svelte'
import type { AdPickerLabels } from '../src/advertising/AdAccountPicker.svelte'

const ACCOUNTS = [
  { external_id: '123-456', display_name: 'Tokyo Retail' },
  { external_id: '789-000', display_name: 'Osaka Wholesale' },
  { external_id: '111-222', display_name: 'Manager Account' },
]

const LABELS: AdPickerLabels = {
  searchLabel: 'Search accounts',
  searchPlaceholder: 'Search by name or ID',
  accountsGroupLabel: 'Ad accounts',
  noMatches: 'No accounts match your search.',
  currencyLabel: 'Account currency',
  currencyHint: 'ISO currency code, e.g. JPY or USD.',
  currencyPlaceholder: 'e.g. JPY',
  currencyError: 'Currency must be three ASCII letters.',
  timezoneLabel: 'Account timezone',
  timezoneHint: 'IANA timezone name, e.g. Asia/Tokyo',
  timezonePlaceholder: 'e.g. Asia/Tokyo',
  timezoneError: 'Timezone is required.',
  timezoneConsequence:
    'The timezone decides what counts as today in every report this platform gives you.',
  confirmLabel: 'Connect this account',
  cancelLabel: 'Cancel',
}

async function renderWithAccounts() {
  const rendered = render(AdAccountPicker, {
    props: { accounts: ACCOUNTS, labels: LABELS, onConfirm: vi.fn(), onCancel: vi.fn() },
  })
  // Wait for the radios to be present before interacting.
  await screen.findByRole('radio', { name: /Tokyo Retail/ })
  return rendered
}

describe('AdAccountPicker', () => {
  it('renders every account with its name and external id', async () => {
    await renderWithAccounts()
    expect(screen.getByRole('radio', { name: /Tokyo Retail/ })).toBeInTheDocument()
    expect(screen.getByText('123-456')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Osaka Wholesale/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Manager Account/ })).toBeInTheDocument()
  })

  it('filters accounts by name and external id as the search text changes', async () => {
    await renderWithAccounts()
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'osaka' } })
    expect(screen.getByRole('radio', { name: /Osaka Wholesale/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Tokyo Retail/ })).not.toBeInTheDocument()

    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: '111-2' } })
    expect(screen.getByRole('radio', { name: /Manager Account/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Osaka Wholesale/ })).not.toBeInTheDocument()

    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText('No accounts match your search.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('asks for currency and timezone of the chosen account, with the consequence stated', async () => {
    await renderWithAccounts()
    expect(screen.queryByText(/Account currency/)).not.toBeInTheDocument()

    await fireEvent.click(screen.getByRole('radio', { name: /Tokyo Retail/ }))
    expect(screen.getByText('Account currency (Tokyo Retail)')).toBeInTheDocument()
    expect(screen.getByText('Account timezone (Tokyo Retail)')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The timezone decides what counts as today in every report this platform gives you.',
      ),
    ).toBeInTheDocument()
  })

  it('confirms with the normalized choice only once currency and timezone are valid', async () => {
    const onConfirm = vi.fn()
    render(AdAccountPicker, {
      props: { accounts: ACCOUNTS, labels: LABELS, onConfirm, onCancel: vi.fn() },
    })
    await screen.findByRole('radio', { name: /Tokyo Retail/ })
    await fireEvent.click(screen.getByRole('radio', { name: /Tokyo Retail/ }))

    const confirm = screen.getByRole('button', { name: 'Connect this account' })
    expect(confirm).toBeDisabled()

    // The labels carry a required marker, so match by prefix.
    const currencyInput = screen.getByLabelText(/Account currency \(Tokyo Retail\)/)
    const timezoneInput = screen.getByLabelText(/Account timezone \(Tokyo Retail\)/)

    await fireEvent.input(currencyInput, { target: { value: 'JP' } })
    await fireEvent.input(timezoneInput, { target: { value: 'Asia/Tokyo' } })
    expect(confirm).toBeDisabled() // two letters is not ISO-4217

    await fireEvent.input(currencyInput, { target: { value: 'jpy' } })
    expect(confirm).toBeEnabled()

    await fireEvent.click(confirm)
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        externalAccountId: '123-456',
        displayName: 'Tokyo Retail',
        currency: 'JPY',
        timezone: 'Asia/Tokyo',
      }),
    )
  })

  it('cancel hands control back to the caller', async () => {
    const onCancel = vi.fn()
    render(AdAccountPicker, {
      props: { accounts: ACCOUNTS, labels: LABELS, onConfirm: vi.fn(), onCancel },
    })
    await screen.findByRole('radio', { name: /Tokyo Retail/ })
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows the caller error above the form and locks the radios while submitting', async () => {
    render(AdAccountPicker, {
      props: {
        accounts: ACCOUNTS,
        labels: LABELS,
        submitting: true,
        errorMessage: 'The platform refused the account.',
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    })
    expect(screen.getByText('The platform refused the account.')).toBeInTheDocument()
    const radio = await screen.findByRole('radio', { name: /Tokyo Retail/ })
    expect(radio).toBeDisabled()
  })

  it('passes axe on the initial, chosen, and empty-search states', async () => {
    const initial = render(AdAccountPicker, {
      props: { accounts: ACCOUNTS, labels: LABELS, onConfirm: vi.fn(), onCancel: vi.fn() },
    })
    await screen.findByRole('radio', { name: /Tokyo Retail/ })
    expect(await axe(initial.container)).toHaveNoViolations()
    initial.unmount()

    const chosen = render(AdAccountPicker, {
      props: { accounts: ACCOUNTS, labels: LABELS, onConfirm: vi.fn(), onCancel: vi.fn() },
    })
    await fireEvent.click(await screen.findByRole('radio', { name: /Tokyo Retail/ }))
    expect(await axe(chosen.container)).toHaveNoViolations()
    chosen.unmount()

    const empty = render(AdAccountPicker, {
      props: { accounts: [], labels: LABELS, onConfirm: vi.fn(), onCancel: vi.fn() },
    })
    await screen.findByText('No accounts match your search.')
    expect(await axe(empty.container)).toHaveNoViolations()
  })

  it('disables confirmation and hides currency/timezone panel when the selected account is filtered out', async () => {
    const onConfirm = vi.fn()
    render(AdAccountPicker, {
      props: { accounts: ACCOUNTS, labels: LABELS, onConfirm, onCancel: vi.fn() },
    })
    await screen.findByRole('radio', { name: /Tokyo Retail/ })
    await fireEvent.click(screen.getByRole('radio', { name: /Tokyo Retail/ }))

    const currencyInput = screen.getByLabelText(/Account currency \(Tokyo Retail\)/)
    const timezoneInput = screen.getByLabelText(/Account timezone \(Tokyo Retail\)/)
    await fireEvent.input(currencyInput, { target: { value: 'jpy' } })
    await fireEvent.input(timezoneInput, { target: { value: 'Asia/Tokyo' } })

    const confirm = screen.getByRole('button', { name: 'Connect this account' })
    expect(confirm).toBeEnabled()

    // Filter out Tokyo Retail by searching for Osaka
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'osaka' } })
    expect(screen.queryByRole('radio', { name: /Tokyo Retail/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Account currency/)).not.toBeInTheDocument()
    expect(confirm).toBeDisabled()

    await fireEvent.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('renders field errors for invalid currency and empty timezone', async () => {
    render(AdAccountPicker, {
      props: { accounts: ACCOUNTS, labels: LABELS, onConfirm: vi.fn(), onCancel: vi.fn() },
    })
    await screen.findByRole('radio', { name: /Tokyo Retail/ })
    await fireEvent.click(screen.getByRole('radio', { name: /Tokyo Retail/ }))

    const currencyInput = screen.getByLabelText(/Account currency \(Tokyo Retail\)/)
    const timezoneInput = screen.getByLabelText(/Account timezone \(Tokyo Retail\)/)

    // Type invalid currency (2 letters)
    await fireEvent.input(currencyInput, { target: { value: 'US' } })
    expect(screen.getByRole('alert')).toHaveTextContent(LABELS.currencyError)
    expect(currencyInput).toHaveAttribute('aria-invalid', 'true')

    // Fix currency
    await fireEvent.input(currencyInput, { target: { value: 'USD' } })
    expect(screen.queryByText(LABELS.currencyError)).not.toBeInTheDocument()
    expect(currencyInput).not.toHaveAttribute('aria-invalid')

    // Touch timezone with empty / whitespace
    await fireEvent.input(timezoneInput, { target: { value: '   ' } })
    expect(screen.getByRole('alert')).toHaveTextContent(LABELS.timezoneError)
    expect(timezoneInput).toHaveAttribute('aria-invalid', 'true')
  })
})
