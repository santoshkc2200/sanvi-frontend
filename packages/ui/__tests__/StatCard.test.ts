import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import StatCard from '../src/StatCard.svelte'

describe('StatCard', () => {
  it('renders label, value, and description', () => {
    render(StatCard, {
      props: { label: 'Active tenants', value: '128', description: 'Up 4% this week' },
    })
    expect(screen.getByText('Active tenants')).toBeInTheDocument()
    expect(screen.getByText('128')).toBeInTheDocument()
    expect(screen.getByText('Up 4% this week')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(StatCard, { props: { label: 'Active tenants', value: '128' } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
