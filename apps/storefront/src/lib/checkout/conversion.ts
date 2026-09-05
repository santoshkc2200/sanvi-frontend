const memoryReportedEvents = new Set<string>()
const inFlightEvents = new Set<string>()
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
  reporter?: (id: string) => void | Promise<void>,
): boolean {
  if (!conversionEventId || !reporter) return false

  if (
    memoryReportedEvents.has(conversionEventId) ||
    isReportedInStorage(conversionEventId) ||
    inFlightEvents.has(conversionEventId)
  ) {
    return false
  }

  inFlightEvents.add(conversionEventId)

  try {
    const result = reporter(conversionEventId)
    if (result && typeof (result as Promise<void>).then === 'function') {
      ;(result as Promise<void>)
        .then(() => {
          memoryReportedEvents.add(conversionEventId)
          markReportedInStorage(conversionEventId)
        })
        .catch((error) => {
          console.error('Failed to report conversion event:', error)
        })
        .finally(() => {
          inFlightEvents.delete(conversionEventId)
        })
      return true
    }

    memoryReportedEvents.add(conversionEventId)
    markReportedInStorage(conversionEventId)
    inFlightEvents.delete(conversionEventId)
    return true
  } catch (error) {
    inFlightEvents.delete(conversionEventId)
    console.error('Failed to report conversion event:', error)
    return false
  }
}

export function resetConversionTrackerForTesting(): void {
  memoryReportedEvents.clear()
  inFlightEvents.clear()
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage) {
        const keysToRemove: string[] = []
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i)
          if (key?.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(key)
          }
        }
        for (const key of keysToRemove) {
          window.sessionStorage.removeItem(key)
        }
      }
    } catch {
      // Ignore
    }
  }
}
