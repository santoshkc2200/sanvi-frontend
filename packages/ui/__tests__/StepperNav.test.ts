import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import StepperNav from '../src/forms/StepperNav.svelte'

const STEPS = [
  { id: 'basics', label: 'Name & objective' },
  { id: 'targeting', label: 'Targeting' },
  { id: 'budget', label: 'Budget & schedule' },
  { id: 'review', label: 'Review' },
]

describe('StepperNav', () => {
  it('marks the current step with aria-current and renders every step', () => {
    render(StepperNav, { steps: STEPS, current: 'targeting' })
    expect(screen.getByText('Name & objective')).toBeInTheDocument()
    expect(screen.getByText('Targeting')).toBeInTheDocument()
    expect(screen.getByText('Budget & schedule')).toBeInTheDocument()
    const current = screen.getByText('Targeting').closest('li')
    expect(current).toHaveAttribute('aria-current', 'step')
  })

  it('never conveys state by colour alone — every step shows a state word', () => {
    render(StepperNav, { steps: STEPS, current: 'budget' })
    // Upcoming, current, and completed steps all carry a visible word.
    const words = screen.getAllByText(
      /Complete|Current step|Not started|Done|You are here|Upcoming/,
    )
    expect(words.length).toBeGreaterThanOrEqual(STEPS.length)
  })

  it('completed steps are links back; future steps are inert', () => {
    const onStepSelect = vi.fn()
    render(StepperNav, { steps: STEPS, current: 'review', onStepSelect })
    fireEvent.click(screen.getByText('Name & objective'))
    expect(onStepSelect).toHaveBeenCalledWith('basics')
  })

  it('upcoming steps never fire onStepSelect', () => {
    const onStepSelect = vi.fn()
    render(StepperNav, { steps: STEPS, current: 'basics', onStepSelect })
    fireEvent.click(screen.getByText('Review'))
    expect(onStepSelect).not.toHaveBeenCalled()
  })

  it('has no axe violations with a mid-flow step', async () => {
    const { container } = render(StepperNav, { steps: STEPS, current: 'targeting' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
