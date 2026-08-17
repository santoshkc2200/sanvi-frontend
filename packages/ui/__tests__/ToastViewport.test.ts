import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import ToastViewport from '../src/ToastViewport.svelte'
import { dismissToast, getToasts, showToast } from '../src/toast.svelte'

afterEach(() => {
  for (const toast of getToasts()) dismissToast(toast.id)
})

describe('toast store + ToastViewport', () => {
  it('renders a toast pushed via showToast', async () => {
    render(ToastViewport)
    showToast({ title: 'Saved', description: 'Your changes were saved.' })
    // showToast mutates the store from outside a component event handler —
    // fireEvent auto-flushes pending effects, a plain function call doesn't.
    await tick()

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Your changes were saved.')).toBeInTheDocument()
  })

  it('removes a toast when its dismiss button is activated', async () => {
    render(ToastViewport)
    showToast({ title: 'Saved', durationMs: 0 })
    await tick()

    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('replaces a toast reusing the same id instead of stacking a duplicate', async () => {
    render(ToastViewport)
    showToast({ id: 'upload', title: 'Uploading…', durationMs: 0 })
    showToast({ id: 'upload', title: 'Upload complete', durationMs: 0 })
    await tick()

    expect(screen.queryByText('Uploading…')).not.toBeInTheDocument()
    expect(screen.getAllByText('Upload complete')).toHaveLength(1)
  })

  it('has no accessibility violations with a toast visible', async () => {
    const { container } = render(ToastViewport)
    showToast({ title: 'Saved', variant: 'success', durationMs: 0 })
    await tick()
    expect(await axe(container)).toHaveNoViolations()
  })
})
