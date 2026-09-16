import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { routeSizes } from '../src/check-budget.mjs'
import { listSpaRoutes, listSvelteKitRoutes, sweepPath } from '../src/routes.mjs'

const FIXTURES = fileURLToPath(new URL('../__fixtures__/routes/', import.meta.url))

describe('listSvelteKitRoutes', () => {
  const appRoot = `${FIXTURES}sveltekit-app`

  it('enumerates page routes from the built manifest, leaf index attached', () => {
    expect(listSvelteKitRoutes(appRoot)).toEqual([
      { id: '/', leaf: 2 },
      { id: '/privacy/requests/[id]', leaf: 3 },
    ])
  })

  it('excludes endpoint-only routes — no UI to sweep or budget', () => {
    const ids = listSvelteKitRoutes(appRoot)?.map((r) => r.id) ?? []
    expect(ids).not.toContain('/health')
  })

  it('returns null when the app has not been built', () => {
    expect(listSvelteKitRoutes(`${FIXTURES}not-built-app`)).toBeNull()
  })
})

describe('listSpaRoutes', () => {
  const appRoot = `${FIXTURES}spa-app`

  it('pairs each path with its own lazy import, across comments and one-liners', () => {
    expect(listSpaRoutes(appRoot)).toEqual([
      { id: '/', leaf: null, component: 'Dashboard' },
      { id: '/payments/:id', leaf: null, component: 'PaymentDetail' },
      { id: '/login', leaf: null, component: 'Login' },
    ])
  })

  it('skips records without a load import instead of stealing the next component', () => {
    const components = listSpaRoutes(appRoot)?.map((r) => r.component) ?? []
    expect(components).not.toContain('Login2')
    expect(components).toHaveLength(3)
  })
})

describe('routeSizes', () => {
  it('maps SvelteKit leaf nodes to their client chunks', () => {
    const sizes = routeSizes(
      `${FIXTURES}sveltekit-app`,
      'sveltekit',
      `${FIXTURES}sveltekit-app/build/client`,
    )
    expect(sizes).toEqual([
      { id: '/', kb: expect.any(Number) },
      { id: '/privacy/requests/[id]', kb: expect.any(Number) },
    ])
    // node 3's fixture file has more padding than node 2's
    expect(sizes[1]?.kb ?? 0).toBeGreaterThan(sizes[0]?.kb ?? Number.MAX_SAFE_INTEGER)
  })

  it('maps SPA routes to their component chunks and ignores shared chunks', () => {
    const sizes = routeSizes(`${FIXTURES}spa-app`, 'spa', `${FIXTURES}spa-app/dist`)
    expect(sizes).toEqual([
      { id: '/', kb: expect.any(Number) },
      { id: '/payments/:id', kb: expect.any(Number) },
      { id: '/login', kb: null }, // Login.svelte has no built chunk in the fixture
    ])
  })
})

describe('sweepPath', () => {
  it('substitutes SvelteKit [param] segments', () => {
    expect(sweepPath('/privacy/requests/[id]/appeal')).toBe('/privacy/requests/probe/appeal')
  })

  it('substitutes SPA :param segments', () => {
    expect(sweepPath('/payments/:id')).toBe('/payments/probe')
  })
})
