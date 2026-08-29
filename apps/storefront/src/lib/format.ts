import { fmt } from '@sanvi/i18n'

/**
 * Shared date formatting for privacy surfaces, phase-06 edition: the same
 * UTC-explicit contract as before, but the rendering locale now follows the
 * negotiated request locale instead of hardcoded `en` (the backend speaks
 * UTC ISO strings and the label stays silent about it — keeping `timeZone:
 * 'UTC'` pinned is what makes SSR output deterministic and hydration safe).
 */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return fmt.datetime(date, 'medium', { timeZone: 'UTC' })
}

/** Whole days until the deadline, clamped at zero — for SLA countdown labels. */
export function daysUntil(iso: string, now: number = Date.now()): number {
  const diff = new Date(iso).getTime() - now
  return Math.max(0, Math.floor(diff / 86_400_000))
}
