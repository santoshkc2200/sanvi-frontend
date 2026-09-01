const memoryReportedEvents = new Set<string>()
const STORAGE_PREFIX = 'sanvi_conversion_reported_'

function isReportedInStorage(id: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage?.getItem(`${STORAGE_PREFIX}${id}`) === '1'
  } catch {
    return false
  }
}

function markReportedInStorage(id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.setItem(`${STORAGE_PREFIX}${id}`, '1')
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

/**
 * Ensures a conversion event ID is reported exactly once across page refreshes,
 * navigation replays, or stale success URLs.
 *
 * Returns `true` if the event was recorded for the first time, or `false` if it
 * has already been reported.
 */
export function recordConversionOnce(
  conversionEventId: string | undefined | null,
  reporter?: (id: string) => void,
): boolean {
  if (!conversionEventId) return false

  if (memoryReportedEvents.has(conversionEventId) || isReportedInStorage(conversionEventId)) {
    return false
  }

  memoryReportedEvents.add(conversionEventId)
  markReportedInStorage(conversionEventId)

  try {
    reporter?.(conversionEventId)
  } catch (error) {
    console.error('Failed to report conversion event:', error)
  }

  return true
}

export function resetConversionTrackerForTesting(): void {
  memoryReportedEvents.clear()
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.clear()
    } catch {
      // Ignore
    }
  }
}
