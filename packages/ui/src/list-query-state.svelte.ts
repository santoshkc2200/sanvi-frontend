/**
 * Server-driven list state (filters, sort, cursor pagination) shared by
 * every `DataTable` + `FilterBar` screen in both consoles — one instance per
 * call site (same shape as `@sanvi/query`'s `Query`). Reads its initial
 * state from `window.location.search` and writes every change back with
 * `history.replaceState` (not `pushState`: a filter keystroke isn't a new
 * back-stack entry, but the URL a user copies always reflects exactly what
 * they're looking at — the phase-03 plan's "every table view is shareable
 * by URL and restores exactly").
 *
 * Saved views persist to `localStorage` under `{storageKey}.views`, scoped
 * per table by the caller-provided `storageKey` (e.g. `"platform-admin.tenants"`).
 */

export interface SavedView<F> {
  id: string
  label: string
  filters: F
  sortKey: string | undefined
  sortDirection: 'asc' | 'desc'
}

export interface ListQueryStateOptions<F extends Record<string, string | undefined>> {
  storageKey: string
  defaultFilters: F
  defaultSort?: { key: string; direction: 'asc' | 'desc' }
}

function readSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function writeSearchParams(params: URLSearchParams): void {
  if (typeof window === 'undefined') return
  const search = params.toString()
  const next = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  window.history.replaceState(window.history.state, '', next)
}

function readSavedViews<F>(storageKey: string): SavedView<F>[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${storageKey}.views`)
    return raw ? (JSON.parse(raw) as SavedView<F>[]) : []
  } catch {
    return []
  }
}

function writeSavedViews<F>(storageKey: string, views: SavedView<F>[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(`${storageKey}.views`, JSON.stringify(views))
}

/** One instance per call site — construct fresh whenever `storageKey` changes (e.g. a new screen). */
export class ListQueryState<F extends Record<string, string | undefined>> {
  #storageKey: string
  #defaultFilters: F

  filters: F = $state({} as F)
  sortKey: string | undefined = $state(undefined)
  sortDirection: 'asc' | 'desc' = $state('asc')
  /** The cursor stack visited so far — `cursor` is always the top; `prevPage` pops it. */
  #cursorStack: (string | undefined)[] = $state([undefined])
  savedViews: SavedView<F>[] = $state([])

  constructor(options: ListQueryStateOptions<F>) {
    this.#storageKey = options.storageKey
    this.#defaultFilters = options.defaultFilters
    this.savedViews = readSavedViews<F>(options.storageKey)

    const params = readSearchParams()
    const filters = { ...options.defaultFilters }
    for (const key of Object.keys(options.defaultFilters)) {
      const value = params.get(key)
      if (value !== null) (filters as Record<string, string>)[key] = value
    }
    this.filters = filters

    this.sortKey = params.get('sort') ?? options.defaultSort?.key
    const direction = params.get('dir')
    this.sortDirection =
      direction === 'asc' || direction === 'desc'
        ? direction
        : (options.defaultSort?.direction ?? 'asc')

    const cursor = params.get('after')
    this.#cursorStack = cursor ? [undefined, cursor] : [undefined]

    this.#sync()
  }

  get cursor(): string | undefined {
    return this.#cursorStack[this.#cursorStack.length - 1]
  }

  get hasPrevPage(): boolean {
    return this.#cursorStack.length > 1
  }

  #sync(): void {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(this.filters)) {
      if (value !== undefined && value !== '' && value !== this.#defaultFilters[key]) {
        params.set(key, String(value))
      }
    }
    if (this.sortKey) params.set('sort', this.sortKey)
    if (this.sortDirection !== 'asc') params.set('dir', this.sortDirection)
    if (this.cursor) params.set('after', this.cursor)
    writeSearchParams(params)
  }

  setFilters(next: Partial<F>): void {
    this.filters = { ...this.filters, ...next }
    this.#cursorStack = [undefined]
    this.#sync()
  }

  clearFilters(): void {
    this.filters = { ...this.#defaultFilters }
    this.#cursorStack = [undefined]
    this.#sync()
  }

  setSort(key: string, direction: 'asc' | 'desc'): void {
    this.sortKey = key
    this.sortDirection = direction
    this.#cursorStack = [undefined]
    this.#sync()
  }

  nextPage(nextCursor: string): void {
    this.#cursorStack = [...this.#cursorStack, nextCursor]
    this.#sync()
  }

  prevPage(): void {
    if (this.#cursorStack.length <= 1) return
    this.#cursorStack = this.#cursorStack.slice(0, -1)
    this.#sync()
  }

  saveView(label: string): void {
    const view: SavedView<F> = {
      id: crypto.randomUUID(),
      label,
      filters: { ...this.filters },
      sortKey: this.sortKey,
      sortDirection: this.sortDirection,
    }
    this.savedViews = [...this.savedViews, view]
    writeSavedViews(this.#storageKey, this.savedViews)
  }

  applyView(id: string): void {
    const view = this.savedViews.find((candidate) => candidate.id === id)
    if (!view) return
    this.filters = { ...view.filters }
    this.sortKey = view.sortKey
    this.sortDirection = view.sortDirection
    this.#cursorStack = [undefined]
    this.#sync()
  }

  deleteView(id: string): void {
    this.savedViews = this.savedViews.filter((view) => view.id !== id)
    writeSavedViews(this.#storageKey, this.savedViews)
  }
}

export function createListQueryState<F extends Record<string, string | undefined>>(
  options: ListQueryStateOptions<F>,
): ListQueryState<F> {
  return new ListQueryState(options)
}
