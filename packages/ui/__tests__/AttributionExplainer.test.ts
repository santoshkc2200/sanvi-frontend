import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AttributionExplainer from '../src/advertising/AttributionExplainer.svelte'

const PROPS = {
  title: 'Where these numbers come from',
  intro: [
    'Every ROAS on this page exists twice: once as the ad platform reports it, once as Sanvi observes it.',
    'They are shown side by side and never merged.',
  ],
  platformHeading: 'Platform-reported conversion value',
  sanviHeading: 'Sanvi-observed revenue',
  platformRows: [
    {
      key: 'a',
      platform: 'Platform A',
      attribution: 'Counted inside a 30-day click window, by the platform’s own model.',
    },
    {
      key: 'b',
      platform: 'Platform B',
      attribution: 'Counted inside a 7-day click / 1-day view window.',
    },
  ],
  sanviDescription:
    'Revenue from Sanvi’s own order records, matched to ad clicks where a click id exists.',
  whyDifferent:
    'Attribution windows and models differ, so the two numbers legitimately differ. Neither is “wrong”; they answer different questions.',
  restatement: 'Recent days are still inside the platforms’ restatement windows and may change.',
}

describe('AttributionExplainer', () => {
  it('renders the methodology: both sources, per-platform windows, the why', () => {
    render(AttributionExplainer, { props: PROPS })
    expect(screen.getByRole('heading', { name: PROPS.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: PROPS.platformHeading })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: PROPS.sanviHeading })).toBeInTheDocument()
    expect(screen.getByText('Platform A')).toBeInTheDocument()
    expect(screen.getByText(PROPS.whyDifferent)).toBeInTheDocument()
    expect(screen.getByText(PROPS.restatement!)).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(AttributionExplainer, { props: PROPS })
    expect(await axe(container)).toHaveNoViolations()
  })
})
