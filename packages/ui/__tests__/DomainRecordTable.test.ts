import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DomainRecordTable from '../src/DomainRecordTable.svelte'

describe('DomainRecordTable', () => {
  const records = [
    {
      type: 'TXT',
      name: '_sanvi-challenge.example.com',
      expected: 'sanvi-verification=abcdef123456',
      observed: 'matched' as const,
    },
    {
      type: 'CNAME',
      name: 'shop.example.com',
      expected: 'edge.sanvi.app',
      observed: 'pending' as const,
    },
    {
      type: 'A',
      name: '@',
      expected: '192.0.2.1',
      observed: 'mismatch' as const,
    },
    {
      type: 'A',
      name: 'fail.example.com',
      expected: '192.0.2.2',
      observed: 'not_found' as const,
    },
  ]

  it('renders records with headers, type pills, values, and status badges', () => {
    render(DomainRecordTable, { props: { records } })

    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Host / Name')).toBeInTheDocument()
    expect(screen.getByText('Value / Target')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()

    expect(screen.getByText('TXT')).toBeInTheDocument()
    expect(screen.getByText('_sanvi-challenge.example.com')).toBeInTheDocument()
    expect(screen.getByText('sanvi-verification=abcdef123456')).toBeInTheDocument()
    expect(screen.getByText('Configured')).toBeInTheDocument()

    expect(screen.getByText('CNAME')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()

    expect(screen.getByText('Wrong value')).toBeInTheDocument()
    expect(screen.getByText('Not found')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Copy all records' })).toBeInTheDocument()
  })

  it('renders empty message when no records exist', () => {
    render(DomainRecordTable, {
      props: {
        records: [],
        emptyMessage: 'No records needed for this domain',
      },
    })
    expect(screen.getByText('No records needed for this domain')).toBeInTheDocument()
  })

  it('has no accessibility violations — populated table', async () => {
    const { container } = render(DomainRecordTable, { props: { records } })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations — empty table', async () => {
    const { container } = render(DomainRecordTable, { props: { records: [] } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
