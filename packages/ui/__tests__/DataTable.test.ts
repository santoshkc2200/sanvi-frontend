import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DataTable from '../src/DataTable.svelte'
import type { DataTableBulkActionArgs, TableColumn } from '../src/table-types'

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

  it('renders bulk actions and announces the selection once a row is selected', () => {
    const bulkActions = createRawSnippet<[DataTableBulkActionArgs]>(() => ({
      render: () => '<button type="button">Clear selection</button>',
    }))
    render(DataTable, {
      props: {
        ...baseProps(),
        selectable: true,
        selectedIds: ['1'],
        bulkActions,
      },
    })
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
    expect(screen.getByText('Clear selection')).toBeInTheDocument()
    // Screen readers must hear selection changes (plan a11y requirement).
    expect(screen.getByRole('status')).toHaveTextContent('1 row selected')
  })

  it('does not render a toolbar without bulk actions even when rows are selected', () => {
    render(DataTable, {
      props: {
        ...baseProps(),
        selectable: true,
        selectedIds: ['1'],
        bulkActions: undefined,
      },
    })
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
    const stored = JSON.parse(localStorage.getItem('test.table') ?? '{}') as {
      known: string[]
      visible: string[]
    }
    expect(stored.visible).not.toContain('status')
    // The column still exists — recording it keeps a later-added column
    // distinguishable from a deliberately hidden one.
    expect(stored.known).toContain('status')
  })

  it('shows columns added after visibility was stored and never hides alwaysVisible columns', () => {
    // A stored state from an older release: name and status existed, the user
    // hid status; the region/actions columns didn't exist yet.
    localStorage.setItem(
      'test.table',
      JSON.stringify({ known: ['name', 'status'], visible: ['name'] }),
    )
    const columns: TableColumn<Row>[] = [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'status', header: 'Status' },
      { key: 'region', header: 'Region' }, // added after the state was stored
      { key: 'actions', header: 'Actions', alwaysVisible: true },
    ]
    render(DataTable, {
      props: {
        columns,
        rows: ROWS,
        getRowId: (row: Row) => row.id,
        columnVisibilityStorageKey: 'test.table',
      },
    })

    // Stored choice honoured for known columns…
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
    // …while never-known columns default to visible, and alwaysVisible
    // columns are restored even when the stored state hides them.
    expect(screen.getByRole('columnheader', { name: 'Region' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
  })

  it('defaults legacy bare-array storage to visible for columns added since', () => {
    localStorage.setItem('test.table', JSON.stringify(['name']))
    render(DataTable, { props: { ...baseProps(), columnVisibilityStorageKey: 'test.table' } })

    // Legacy data carried no record of "status" ever existing, so the
    // sensible migration is visible — the pre-fix behaviour hid it forever.
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(DataTable, { props: { ...baseProps(), selectable: true } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
