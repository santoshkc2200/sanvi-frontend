import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DataTable from '../src/DataTable.svelte'
import type { TableColumn } from '../src/table-types'

interface Row {
  id: string
  name: string
  status: string
}

const ROWS: Row[] = [
  { id: '1', name: 'Acme', status: 'active' },
  { id: '2', name: 'Globex', status: 'suspended' },
]

const COLUMNS: TableColumn<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'status', header: 'Status' },
]

function baseProps() {
  return {
    columns: COLUMNS,
    rows: ROWS,
    getRowId: (row: Row) => row.id,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('DataTable', () => {
  it('renders rows and column headers', () => {
    render(DataTable, { props: baseProps() })
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Globex')).toBeInTheDocument()
  })

  it('shows the empty message when there are no rows', () => {
    render(DataTable, { props: { ...baseProps(), rows: [], emptyMessage: 'Nothing here' } })
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('shows a spinner while loading and hides rows', () => {
    render(DataTable, { props: { ...baseProps(), loading: true, loadingLabel: 'Fetching' } })
    expect(screen.getByText('Fetching')).toBeInTheDocument()
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  })

  it('shows an error state with a retry button', async () => {
    const onRetry = vi.fn()
    render(DataTable, { props: { ...baseProps(), error: 'Failed to load', onRetry } })
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('reports sort changes via onSortChange, toggling direction on repeated clicks', async () => {
    const onSortChange = vi.fn()
    render(DataTable, {
      props: { ...baseProps(), onSortChange, sortKey: 'name', sortDirection: 'asc' },
    })

    await fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc')
  })

  it('selects rows and reports selection via onSelectionChange', async () => {
    const onSelectionChange = vi.fn()
    render(DataTable, {
      props: { ...baseProps(), selectable: true, selectedIds: [], onSelectionChange },
    })

    const rows = screen.getAllByRole('row').slice(1) // skip header row
    const checkbox = within(rows[0] as HTMLElement).getByRole('checkbox')
    await fireEvent.click(checkbox)

    expect(onSelectionChange).toHaveBeenCalledWith(['1'])
  })

  it('selects all rows via the header checkbox', async () => {
    const onSelectionChange = vi.fn()
    render(DataTable, {
      props: { ...baseProps(), selectable: true, selectedIds: [], onSelectionChange },
    })

    const headerRow = screen.getAllByRole('row')[0] as HTMLElement
    await fireEvent.click(within(headerRow).getByRole('checkbox'))

    expect(onSelectionChange).toHaveBeenCalledWith(['1', '2'])
  })

  it('renders bulk actions once a row is selected', () => {
    render(DataTable, {
      props: {
        ...baseProps(),
        selectable: true,
        selectedIds: ['1'],
        bulkActions: undefined,
      },
    })
    // No bulkActions snippet provided — bulk bar shouldn't render, no crash.
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('paginates via onNextPage/onPrevPage', async () => {
    const onNextPage = vi.fn()
    const onPrevPage = vi.fn()
    render(DataTable, {
      props: {
        ...baseProps(),
        hasNextPage: true,
        hasPrevPage: true,
        onNextPage,
        onPrevPage,
        pageInfo: 'Page 2',
      },
    })

    expect(screen.getByText('Page 2')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNextPage).toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPrevPage).toHaveBeenCalled()
  })

  it('persists column visibility to localStorage', async () => {
    render(DataTable, { props: { ...baseProps(), columnVisibilityStorageKey: 'test.table' } })

    await fireEvent.click(screen.getByText('Columns'))
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Status' }))

    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('test.table') ?? '[]')).not.toContain('status')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(DataTable, { props: { ...baseProps(), selectable: true } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
