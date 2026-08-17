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
    },
  ]

  const existingTimer = timers.get(id)
  if (existingTimer) clearTimeout(existingTimer)
  if (durationMs > 0) {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), durationMs),
    )
  }

  return id
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id)
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}
