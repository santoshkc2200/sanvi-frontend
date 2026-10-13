export interface ToastOptions {
  id?: string
  title: string
  description?: string
  variant?: 'info' | 'success' | 'warning' | 'error'
  /** 0 disables auto-dismiss. */
  durationMs?: number
}

export interface ToastItem {
  id: string
  title: string
  description: string
  variant: 'info' | 'success' | 'warning' | 'error'
  /** The auto-dismiss duration, retained so a paused toast can resume. */
  durationMs: number
}

let toasts = $state<ToastItem[]>([])
const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Read from a `ToastViewport` (or any component) to render the current queue. */
export function getToasts(): ToastItem[] {
  return toasts
}

export function showToast(options: ToastOptions): string {
  const id = options.id ?? crypto.randomUUID()
  const durationMs = options.durationMs ?? 5_000

  toasts = [
    ...toasts.filter((t) => t.id !== id),
    {
      id,
      title: options.title,
      description: options.description ?? '',
      variant: options.variant ?? 'info',
      durationMs,
    },
  ]

  armTimer(id, durationMs)

  return id
}

function armTimer(id: string, durationMs: number): void {
  const existingTimer = timers.get(id)
  if (existingTimer) clearTimeout(existingTimer)
  if (durationMs > 0) {
    timers.set(id, setTimeout(() => dismissToast(id), durationMs))
  } else {
    timers.delete(id)
  }
}

/**
 * Freezes a toast's auto-dismiss while the user is reading it — hovered or
 * keyboard-focused (TASK-027). WCAG 2.2.1: anything that disappears on a
 * timer must be extendable; hover/focus is the pause gesture.
 */
export function pauseToast(id: string): void {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

/** Resumes a paused toast with its full original duration. */
export function resumeToast(id: string): void {
  const toast = toasts.find((t) => t.id === id)
  if (toast && toast.durationMs > 0 && !timers.has(id)) {
    armTimer(id, toast.durationMs)
  }
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id)
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}
