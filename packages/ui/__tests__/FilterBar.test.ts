import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import FilterBar, { type FilterFieldConfig } from '../src/FilterBar.svelte'

const FIELDS: FilterFieldConfig[] = [
  { type: 'text', key: 'q', label: 'Search', placeholder: 'Search tenants' },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'suspended', label: 'Suspended' },
    ],
    placeholder: 'Any status',
  },
  { type: 'boolean', key: 'flagged', label: 'Flagged only' },
]

function baseProps() {
  return {
    fields: FIELDS,
    values: {},
    onChange: vi.fn(),
  }
}

describe('FilterBar', () => {
  it('renders a control per field', () => {
    render(FilterBar, { props: baseProps() })
    expect(screen.getByPlaceholderText('Search tenants')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Flagged only')).toBeInTheDocument()
  })

  it('reports text input changes', async () => {
    const onChange = vi.fn()
    render(FilterBar, { props: { ...baseProps(), onChange } })
    await fireEvent.input(screen.getByPlaceholderText('Search tenants'), {
      target: { value: 'acme' },
    })
    expect(onChange).toHaveBeenCalledWith({ q: 'acme' })
  })

  it('reports select changes', async () => {
    const onChange = vi.fn()
    render(FilterBar, { props: { ...baseProps(), onChange } })
    await fireEvent.change(screen.getByDisplayValue('Any status'), { target: { value: 'active' } })
    expect(onChange).toHaveBeenCalledWith({ status: 'active' })
  })

  it('reports boolean toggles as "true"/undefined', async () => {
    const onChange = vi.fn()
    render(FilterBar, { props: { ...baseProps(), onChange } })
    const checkbox = screen.getByRole('checkbox', { name: 'Flagged only' })
    await fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalledWith({ flagged: 'true' })
  })

  it('calls onClear when the clear button is clicked', async () => {
    const onClear = vi.fn()
    render(FilterBar, { props: { ...baseProps(), onClear } })
    await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClear).toHaveBeenCalled()
  })

  it('lists saved views and applies one on click', async () => {
    const onApplyView = vi.fn()
    render(FilterBar, {
      props: {
        ...baseProps(),
        savedViews: [
          {
            id: 'v1',
            label: 'My view',
            filters: {},
            sortKey: undefined,
            sortDirection: 'asc' as const,
          },
        ],
        onApplyView,
      },
    })
    await fireEvent.click(screen.getByText('My view'))
    expect(onApplyView).toHaveBeenCalledWith('v1')
  })

  it('saves a new view with the typed name', async () => {
    const onSaveView = vi.fn()
    render(FilterBar, { props: { ...baseProps(), onSaveView } })
    await fireEvent.input(screen.getByPlaceholderText('View name'), {
      target: { value: 'Suspended' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Save current filters' }))
    expect(onSaveView).toHaveBeenCalledWith('Suspended')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(FilterBar, {
      props: { ...baseProps(), onClear: vi.fn(), onSaveView: vi.fn() },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
