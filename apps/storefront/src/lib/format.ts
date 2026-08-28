/**
 * Shared date formatting for privacy surfaces. ISO strings come from the
 * backend; users see them in the request locale with a short format —
 * enough to read a deadline, no ambiguity about time zone (the backend
 * speaks UTC ISO strings and the label stays silent about it).
 */
const formatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
})

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return formatter.format(date)
}

/** Whole days until the deadline, clamped at zero — for SLA countdown labels. */
export function daysUntil(iso: string, now: number = Date.now()): number {
  const diff = new Date(iso).getTime() - now
  return Math.max(0, Math.floor(diff / 86_400_000))
}
