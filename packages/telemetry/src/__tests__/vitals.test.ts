import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RawObservation } from '../types'
import { timingSource } from '../vitals'

type FakeNavigationEntry = {
  entryType: 'navigation'
  domContentLoadedEventEnd: number
  loadEventEnd: number
}

const FINISHED: FakeNavigationEntry = {
  entryType: 'navigation',
  domContentLoadedEventEnd: 342,
  loadEventEnd: 812,
}
const UNFINISHED: FakeNavigationEntry = {
  ...FINISHED,
  domContentLoadedEventEnd: 0,
  loadEventEnd: 0,
}

/**
 * Node ships a real `PerformanceObserver` that knows no navigation entries —
 * stand in a fake that replays `buffered` entries at observe() time, which is
 * the behaviour under test, and record the load listeners the source attaches.
 */
function harness(replay: FakeNavigationEntry[], postLoadEntry: FakeNavigationEntry[]) {
  let observerCallback: PerformanceObserverCallback = () => {}
  class FakePerformanceObserver {
    #observes = 0
    constructor(callback: PerformanceObserverCallback) {
      observerCallback = callback
    }
    observe(): void {
      // `buffered` replays per type: only the navigation observe() sees the
      // navigation entries, never the resource one.
      this.#observes += 1
      if (this.#observes === 1 && replay.length > 0) {
        observerCallback(
          {
            getEntries: () => replay as unknown as PerformanceEntry[],
          } as unknown as PerformanceObserverEntryList,
          this as unknown as PerformanceObserver,
        )
      }
    }
    disconnect(): void {}
  }
  const loadListeners = new Set<EventListener>()
  vi.stubGlobal('PerformanceObserver', FakePerformanceObserver)
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: EventListener) => {
      if (type === 'load') loadListeners.add(listener)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      if (type === 'load') loadListeners.delete(listener)
    },
  })
  vi.stubGlobal('performance', {
    getEntriesByType: (type: string) => (type === 'navigation' ? postLoadEntry : []),
  })

  const events: RawObservation[] = []
  const stop = timingSource().start((event) => events.push(event))
  return {
    events,
    stop,
    fireLoad: () => {
      for (const listener of [...loadListeners]) listener(new Event('load'))
    },
  }
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('timingSource navigation rows', () => {
  it('emits both rows immediately when the buffered entry is already finished — a start after load', () => {
    const { events } = harness([FINISHED], [FINISHED])
    expect(events).toEqual([
      { kind: 'navigation', name: 'dom-content-loaded', value: 342 },
      { kind: 'navigation', name: 'load', value: 812 },
    ])
  })

  it('a mid-load start emits nothing from the replay and once when the load event lands', async () => {
    const { events, fireLoad } = harness([UNFINISHED], [FINISHED])
    expect(events).toEqual([])

    fireLoad()
    await tick()
    expect(events).toEqual([
      { kind: 'navigation', name: 'dom-content-loaded', value: 342 },
      { kind: 'navigation', name: 'load', value: 812 },
    ])
  })

  it('stopping before load removes the listener — the load is never observed', async () => {
    const { events, stop, fireLoad } = harness([UNFINISHED], [FINISHED])
    stop()
    fireLoad()
    await tick()
    expect(events).toEqual([])
  })

  it('a load whose entry never appears in the buffer emits nothing', async () => {
    const { events, fireLoad } = harness([], [])
    fireLoad()
    await tick()
    expect(events).toEqual([])
  })
})
