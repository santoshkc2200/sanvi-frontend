import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import { cacheKey, clearCache, setCacheEntry } from '../src/cache'
import QueryDevtools from '../src/devtools/QueryDevtools.svelte'

beforeEach(() => {
  clearCache()
})

describe('QueryDevtools', () => {
  it('shows the empty state when the cache has nothing in it', () => {
    render(QueryDevtools)
    expect(screen.getByText('No cached entries')).toBeInTheDocument()
  })

  it('lists a populated cache entry with its key and tags', () => {
    setCacheEntry(cacheKey('acme', 'members'), ['row'], ['members', 'roster'])
    render(QueryDevtools)

    expect(screen.getByText('acme:members')).toBeInTheDocument()
    expect(screen.getByText('members, roster')).toBeInTheDocument()
  })
})
