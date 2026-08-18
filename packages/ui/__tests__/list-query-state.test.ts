import { beforeEach, describe, expect, it } from 'vitest'
import { createListQueryState } from '../src/list-query-state.svelte'

interface Filters {
  status: string | undefined
  q: string | undefined
}

function resetLocation(path = '/tenants'): void {
  window.history.replaceState({}, '', path)
}

beforeEach(() => {
  localStorage.clear()
  resetLocation()
})

describe('ListQueryState', () => {
  it('starts from defaults when the URL has no matching params', () => {
    const state = createListQueryState<Filters>({
      storageKey: 'test.tenants',
      defaultFilters: { status: undefined, q: undefined },
    })
    expect(state.filters).toEqual({ status: undefined, q: undefined })
    expect(state.cursor).toBeUndefined()
    expect(state.hasPrevPage).toBe(false)
  })

  it('hydrates filters, sort, and cursor from the URL on construction', () => {
    resetLocation('/tenants?status=active&sort=name&dir=desc&after=cursor-2')
    const state = createListQueryState<Filters>({
      storageKey: 'test.tenants',
      defaultFilters: { status: undefined, q: undefined },
    })
    expect(state.filters.status).toBe('active')
    expect(state.sortKey).toBe('name')
    expect(state.sortDirection).toBe('desc')
    expect(state.cursor).toBe('cursor-2')
  })

  it('setFilters updates the URL and resets pagination', () => {
    const state = createListQueryState<Filters>({
      storageKey: 'test.tenants',
      defaultFilters: { status: undefined, q: undefined },
    })
    state.nextPage('cursor-1')
    expect(state.cursor).toBe('cursor-1')

    state.setFilters({ status: 'active' })
    expect(state.cursor).toBeUndefined()
    expect(window.location.search).toContain('status=active')
    expect(window.location.search).not.toContain('after=')
  })

  it('nextPage/prevPage walk the cursor stack', () => {
    const state = createListQueryState<Filters>({
      storageKey: 'test.tenants',
      defaultFilters: { status: undefined, q: undefined },
    })
    state.nextPage('a')
    state.nextPage('b')
    expect(state.cursor).toBe('b')
    expect(state.hasPrevPage).toBe(true)

    state.prevPage()
    expect(state.cursor).toBe('a')
    state.prevPage()
    expect(state.cursor).toBeUndefined()
    expect(state.hasPrevPage).toBe(false)
  })

  it('setSort resets the cursor and updates the URL', () => {
    const state = createListQueryState<Filters>({
      storageKey: 'test.tenants',
      defaultFilters: { status: undefined, q: undefined },
    })
    state.nextPage('a')
    state.setSort('name', 'desc')
    expect(state.cursor).toBeUndefined()
    expect(window.location.search).toContain('sort=name')
    expect(window.location.search).toContain('dir=desc')
  })

  it('saves, applies, and deletes views in localStorage, scoped by storageKey', () => {
    const state = createListQueryState<Filters>({
      storageKey: 'test.tenants',
      defaultFilters: { status: undefined, q: undefined },
    })
    state.setFilters({ status: 'suspended' })
    state.saveView('Suspended tenants')
    expect(state.savedViews).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('test.tenants.views') ?? '[]')).toHaveLength(1)

    state.clearFilters()
    expect(state.filters.status).toBeUndefined()

    state.applyView(state.savedViews[0]!.id)
    expect(state.filters.status).toBe('suspended')

    state.deleteView(state.savedViews[0]!.id)
    expect(state.savedViews).toHaveLength(0)
  })

  it('keeps saved views scoped to their storageKey', () => {
    const tenants = createListQueryState<Filters>({
      storageKey: 'test.tenants',
      defaultFilters: { status: undefined, q: undefined },
    })
    tenants.saveView('A view')

    const other = createListQueryState<Filters>({
      storageKey: 'test.other',
      defaultFilters: { status: undefined, q: undefined },
    })
    expect(other.savedViews).toHaveLength(0)
  })
})
