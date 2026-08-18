import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import StepUpGate from '../src/StepUpGate.svelte'

function slot(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))
}

describe('StepUpGate', () => {
  it('renders children when fresh', () => {
    render(StepUpGate, {
      props: { fresh: true, onStepUp: vi.fn(), children: slot('Protected content') },
    })
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('renders a re-authenticate prompt instead of children when not fresh', () => {
    render(StepUpGate, {
      props: { fresh: false, onStepUp: vi.fn(), children: slot('Protected content') },
    })
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByText('Re-authentication required')).toBeInTheDocument()
  })

  it('calls onStepUp when the action is triggered', async () => {
    const onStepUp = vi.fn()
    render(StepUpGate, { props: { fresh: false, onStepUp, children: slot('Protected content') } })
    await fireEvent.click(screen.getByRole('button', { name: 'Re-authenticate' }))
    expect(onStepUp).toHaveBeenCalled()
  })

  it('has no accessibility violations when not fresh', async () => {
    const { container } = render(StepUpGate, {
      props: { fresh: false, onStepUp: vi.fn(), children: slot('Protected content') },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
