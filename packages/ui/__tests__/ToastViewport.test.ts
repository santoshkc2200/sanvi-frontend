import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('toast urgency + pause (TASK-027)', () => {
  it.each(['info', 'error'] as const)(
    'keeps a %s toast paused until both hover and focus end',
    async (variant) => {
      vi.useFakeTimers()
      try {
        render(ToastViewport)
        showToast({ title: 'Reading', variant, durationMs: 5_000 })
        await tick()
        const toast = screen.getByRole(variant === 'error' ? 'alert' : 'status')
        const dismiss = screen.getByRole('button', { name: 'Dismiss' })
        await fireEvent.pointerEnter(toast)
        await fireEvent.focusIn(dismiss)
        await fireEvent.pointerLeave(toast)
        vi.advanceTimersByTime(6_000)
        await tick()
        expect(screen.getByText('Reading')).toBeInTheDocument()
        await fireEvent.pointerEnter(toast)
        await fireEvent.focusOut(dismiss)
        vi.advanceTimersByTime(6_000)
        await tick()
        expect(screen.getByText('Reading')).toBeInTheDocument()
        await fireEvent.pointerLeave(toast)
        vi.advanceTimersByTime(5_000)
        await tick()
        expect(screen.queryByText('Reading')).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    },
  )

  it('renders an error toast as role=alert in the assertive region, success as role=status', async () => {
    render(ToastViewport)
    showToast({ title: 'Save failed', variant: 'error', durationMs: 0 })
    showToast({ title: 'Saved', variant: 'success', durationMs: 0 })
    await tick()

    expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('pauses auto-dismiss while hovered and resumes on leave', async () => {
    vi.useFakeTimers()
    try {
      render(ToastViewport)
      showToast({ title: 'Retrying', variant: 'warning', durationMs: 5_000 })
      await tick()

      const toast = screen.getByRole('alert')
      vi.advanceTimersByTime(4_000)
      await tick()
      await fireEvent.pointerEnter(toast)
      vi.advanceTimersByTime(6_000)
      await tick()
      expect(screen.getByRole('alert')).toBeInTheDocument()
      await fireEvent.pointerLeave(toast)
      vi.advanceTimersByTime(5_000)
      await tick()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('pauses auto-dismiss while focus is inside the toast', async () => {
    vi.useFakeTimers()
    try {
      render(ToastViewport)
      showToast({ title: 'Retrying', variant: 'warning', durationMs: 5_000 })
      await tick()

      const toast = screen.getByRole('alert')
      vi.advanceTimersByTime(4_000)
      await tick()
      await fireEvent.focusIn(toast)
      vi.advanceTimersByTime(6_000)
      await tick()
      expect(screen.getByRole('alert')).toBeInTheDocument()
      await fireEvent.focusOut(toast)
      vi.advanceTimersByTime(5_000)
      await tick()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
