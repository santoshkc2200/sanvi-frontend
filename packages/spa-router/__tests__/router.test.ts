import type { Component } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, handleLinkClick, navigate } from '../src/router.svelte'

// Real Svelte components compile to functions, not plain objects — `$state`
// only deep-proxies objects/arrays/Map/Set, so functions keep their identity
// across a `$state` field. Plain-object stand-ins would silently lose
// `toBe` identity here (Svelte wraps them in a reactivity proxy), so these
// fixtures are functions specifically to match real component semantics.
const DashboardComponent = (() => {}) as unknown as Component
const TenantDetailComponent = (() => {}) as unknown as Component
const NotFoundComponent = (() => {}) as unknown as Component

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function setPath(path: string): void {
  window.history.pushState({}, '', path)
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Router', () => {
  it('matches a static route and loads its component', async () => {
    setPath('/dashboard')
    const router = createRouter({
      routes: [{ path: 'dashboard', load: async () => ({ default: DashboardComponent }) }],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.component).toBe(DashboardComponent))
    expect(router.loading).toBe(false)
    expect(router.error).toBeNull()
  })

  it('matches a nested, parametrized route and extracts params', async () => {
    setPath('/tenants/acme-1')
    const router = createRouter({
      routes: [
        {
          path: 'tenants',
          load: async () => ({ default: DashboardComponent }),
          children: [{ path: ':id', load: async () => ({ default: TenantDetailComponent }) }],
        },
      ],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.component).toBe(TenantDetailComponent))
    expect(router.params).toEqual({ id: 'acme-1' })
    expect(router.pattern).toBe('/tenants/:id')
  })

  it('pattern is the route shape, not the visited path — including for a guard-rejected route', async () => {
    setPath('/admin-only')
    const router = createRouter({
      routes: [
        {
          path: 'admin-only',
          guard: async () => false,
          load: async () => ({ default: DashboardComponent }),
        },
      ],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.guardRejected).toBe(true))
    expect(router.pattern).toBe('/admin-only')
  })

  it('pattern is null while nothing is matched and after a not-found navigation, set again on a real match', async () => {
    setPath('/does-not-exist')
    const router = createRouter({
      routes: [{ path: 'dashboard', load: async () => ({ default: DashboardComponent }) }],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.component).toBe(NotFoundComponent))
    expect(router.pattern).toBeNull()

    router.navigate('/dashboard')
    await vi.waitFor(() => expect(router.component).toBe(DashboardComponent))
    expect(router.pattern).toBe('/dashboard')
  })

  it('the root route collapses to "/"', async () => {
    setPath('/')
    const router = createRouter({
      routes: [{ path: '', load: async () => ({ default: DashboardComponent }) }],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.component).toBe(DashboardComponent))
    expect(router.pattern).toBe('/')
  })

  it('falls back to notFound() when nothing matches', async () => {
    setPath('/does-not-exist')
    const router = createRouter({
      routes: [{ path: 'dashboard', load: async () => ({ default: DashboardComponent }) }],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.component).toBe(NotFoundComponent))
  })

  it('sets guardRejected without loading when the route guard returns false', async () => {
    setPath('/admin-only')
    const load = vi.fn(async () => ({ default: DashboardComponent }))
    const router = createRouter({
      routes: [{ path: 'admin-only', guard: async () => false, load }],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.guardRejected).toBe(true))
    expect(router.component).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })

  it('loads the route when the guard returns true', async () => {
    setPath('/admin-only')
    const router = createRouter({
      routes: [
        {
          path: 'admin-only',
          guard: async () => true,
          load: async () => ({ default: DashboardComponent }),
        },
      ],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.component).toBe(DashboardComponent))
    expect(router.guardRejected).toBe(false)
  })

  it('surfaces a loader error via .error rather than throwing', async () => {
    setPath('/broken')
    const router = createRouter({
      routes: [
        {
          path: 'broken',
          load: async () => {
            throw new Error('chunk failed to load')
          },
        },
      ],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    await vi.waitFor(() => expect(router.error).not.toBeNull())
    expect((router.error as Error).message).toBe('chunk failed to load')
    expect(router.component).toBeNull()
  })

  it('navigate() pushes history state and resolves the new route', async () => {
    const router = createRouter({
      routes: [{ path: 'settings', load: async () => ({ default: DashboardComponent }) }],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    router.navigate('/settings')

    expect(window.location.pathname).toBe('/settings')
    await vi.waitFor(() => expect(router.component).toBe(DashboardComponent))
  })

  it('a later navigation is never clobbered by an earlier, slower-resolving one', async () => {
    const router = createRouter({
      routes: [
        {
          path: 'slow',
          load: async () => {
            await sleep(30)
            return { default: DashboardComponent }
          },
        },
        { path: 'fast', load: async () => ({ default: TenantDetailComponent }) },
      ],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    router.navigate('/slow')
    router.navigate('/fast')

    await vi.waitFor(() => expect(router.component).toBe(TenantDetailComponent))
    await sleep(50) // let the slow loader's promise settle
    expect(router.component).toBe(TenantDetailComponent) // must not have been overwritten
  })

  it('handleLinkClick prevents the default navigation and routes in-app for a plain left click', () => {
    const router = createRouter({
      routes: [{ path: 'settings', load: async () => ({ default: DashboardComponent }) }],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    const event = new MouseEvent('click', { button: 0, bubbles: true, cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    router.handleLinkClick(event, '/settings')

    expect(preventDefault).toHaveBeenCalled()
    expect(window.location.pathname).toBe('/settings')
  })

  it('handleLinkClick lets a modified click (e.g. cmd+click) fall through to the browser', () => {
    const router = createRouter({
      routes: [{ path: 'settings', load: async () => ({ default: DashboardComponent }) }],
      notFound: async () => ({ default: NotFoundComponent }),
    })
    window.history.pushState({}, '', '/')

    const event = new MouseEvent('click', {
      button: 0,
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    router.handleLinkClick(event, '/settings')

    expect(preventDefault).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/')
  })
})

describe('standalone navigate/handleLinkClick', () => {
  it('navigate() pushes history state and resyncs every listening Router via popstate', async () => {
    const router = createRouter({
      routes: [{ path: 'tenants/:id', load: async () => ({ default: TenantDetailComponent }) }],
      notFound: async () => ({ default: NotFoundComponent }),
    })

    navigate('/tenants/acme')

    expect(window.location.pathname).toBe('/tenants/acme')
    await vi.waitFor(() => expect(router.component).toBe(TenantDetailComponent))
    expect(router.params).toEqual({ id: 'acme' })
  })

  it('handleLinkClick prevents default and calls navigate() for a plain left click', () => {
    const event = new MouseEvent('click', { button: 0, bubbles: true, cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    handleLinkClick(event, '/settings')

    expect(preventDefault).toHaveBeenCalled()
    expect(window.location.pathname).toBe('/settings')
  })

  it('handleLinkClick lets a modified click fall through to the browser', () => {
    window.history.pushState({}, '', '/')
    const event = new MouseEvent('click', {
      button: 0,
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    handleLinkClick(event, '/settings')

    expect(preventDefault).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/')
  })
})
