import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ErrorSummaryHost from './fixtures/ErrorSummaryHost.svelte'

const ITEMS = [
  { id: 'field-name', label: 'Campaign name', message: 'Campaign name is required.' },
  { id: 'field-objective', label: 'Objective', message: 'Choose an objective.' },
]

describe('ErrorSummary', () => {
  it('renders nothing when there are no items', () => {
    render(ErrorSummaryHost, { props: { items: [] } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('links every offending field, in the order given', () => {
    // Order is the caller's contract (the backend pins field-issue order) —
    // the summary renders it verbatim so a resubmit lists identically.
    render(ErrorSummaryHost, { props: { items: ITEMS } })
    const links = screen.getAllByRole('listitem')
    expect(links).toHaveLength(2)
    const anchors = links.map((li) => li.querySelector('a'))
    expect(anchors.map((a) => a?.getAttribute('href'))).toEqual(['#field-name', '#field-objective'])
    expect(anchors[0]).toHaveTextContent('Campaign name is required.')
    expect(anchors[1]).toHaveTextContent('Choose an objective.')
  })

  it('keeps list order stable across a re-render with the same items', async () => {
    const { rerender } = render(ErrorSummaryHost, { props: { items: ITEMS } })
    const first = screen
      .getAllByRole('listitem')
      .map((li) => li.querySelector('a')?.getAttribute('href'))
    await rerender({ props: { items: [...ITEMS] } })
    const second = screen
      .getAllByRole('listitem')
      .map((li) => li.querySelector('a')?.getAttribute('href'))
    expect(second).toEqual(first)
  })

  it('moves focus to the offending control when its link is activated', async () => {
    render(ErrorSummaryHost, { props: { items: ITEMS } })
    await fireEvent.click(screen.getAllByRole('link')[1])
    expect(document.getElementById('field-objective')).toHaveFocus()
  })

  it('exposes focus() so a form can move focus to the summary on a failed submit', () => {
    const { component } = render(ErrorSummaryHost, { props: { items: ITEMS } })
    component.focusSummary()
    expect(screen.getByRole('alert')).toHaveFocus()
  })

  it('announces itself as an alert with a heading', () => {
    render(ErrorSummaryHost, { props: { items: ITEMS, title: 'Fix the following' } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Fix the following')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(ErrorSummaryHost, { props: { items: ITEMS } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
