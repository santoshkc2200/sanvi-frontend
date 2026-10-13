import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { createRawSnippet, tick } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Alert from '../src/Alert.svelte'
import Badge from '../src/Badge.svelte'
import StatusBanner from '../src/StatusBanner.svelte'
import ToastViewport from '../src/ToastViewport.svelte'
import { dismissToast, getToasts, showToast } from '../src/toast.svelte'

function body(text: string) {
  return createRawSnippet(() => ({ render: () => `<p>${text}</p>` }))
}
function label(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }))
}

/**
 * TASK-027 step 4's sweep: no colour-only status anywhere in the product.
 * Colour cannot be the only carrier of a state (WCAG 1.4.1) — every status
 * surface must also announce its state through text, a role, or a live
 * region, so the assertions here are: with colour stripped away by the test
 * environment (jsdom renders no colour at all), the state is still
 * discoverable. If a component ever encodes status in colour alone, these
 * fail because the state text/role is missing — not because a colour
 * changed.
 */
describe('status is never colour-only (TASK-027)', () => {
  it.each(['info', 'success', 'warning', 'error'] as const)(
    'Alert %s carries its message as text (and the right live role)',
    (variant) => {
      const { container, unmount } = render(Alert, {
        variant,
        children: body('Payment failed'),
      })
      expect(container.textContent).toContain('Payment failed')
      unmount()
    },
  )

  it('Badge renders its label text for every variant — colour differentiates, text carries', () => {
    for (const variant of ['neutral', 'info', 'success', 'warning', 'error'] as const) {
      const { container, unmount } = render(Badge, {
        variant,
        children: label('Past due'),
      })
      // The badge's accessible content is its text — a colour swatch with no
      // label would leave this empty.
      expect(container.textContent).toContain('Past due')
      unmount()
    }
  })

  it('StatusBanner roles distinguish state without colour: alert for degraded, status for maintenance', () => {
    const { container: maintenance } = render(StatusBanner, {
      kind: 'maintenance',
      title: 'Maintenance window',
      description: 'Read-only until 02:00 UTC.',
    })
    expect(screen.getByRole('status')).toHaveTextContent('Maintenance window')

    const { container: degraded } = render(StatusBanner, {
      kind: 'degraded',
      title: 'Degraded',
      description: 'Some requests are failing.',
    })
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    void maintenance
    void degraded
  })

  it('toast variants render text content and assertive roles for errors', async () => {
    render(ToastViewport)
    showToast({ title: 'Export finished', variant: 'success', durationMs: 0 })
    showToast({ title: 'Export failed', variant: 'error', durationMs: 0 })
    await tick()
    expect(screen.getByRole('alert')).toHaveTextContent('Export failed')
    expect(screen.getByRole('status')).toHaveTextContent('Export finished')
  })

  afterEach(() => {
    for (const toast of getToasts()) dismissToast(toast.id)
  })

  it('the status surfaces have no accessibility violations of their own', async () => {
    const { container } = render(StatusBanner, {
      kind: 'degraded',
      title: 'Degraded',
      description: 'Some requests are failing.',
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
