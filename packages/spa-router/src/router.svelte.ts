import type { Component } from 'svelte'

export type RouteParams = Record<string, string>

export interface RouteDefinition {
  /** A path segment, e.g. `'tenants'` or `':id'`. Not a full path — nesting comes from `children`. */
  path: string
  /** No-op until phase 02 wires real auth; `undefined` means "always allowed." Return `false` to reject without loading the route. */
  guard?: (params: RouteParams) => boolean | Promise<boolean>
  load: () => Promise<{ default: Component }>
  children?: RouteDefinition[]
}

export interface RouterConfig {
  routes: RouteDefinition[]
  notFound: () => Promise<{ default: Component }>
}

interface FlatRoute {
  segments: string[]
  guard: RouteDefinition['guard']
  load: RouteDefinition['load']
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function flatten(routes: RouteDefinition[], prefix: string[] = []): FlatRoute[] {
  const flat: FlatRoute[] = []
  for (const route of routes) {
    const segments = [...prefix, ...splitPath(route.path)]
    flat.push({ segments, guard: route.guard, load: route.load })
    if (route.children) flat.push(...flatten(route.children, segments))
  }
  return flat
}

/** `null` when the segment counts differ or a static segment doesn't match; otherwise the extracted `:param` values. */
function matchSegments(routeSegments: string[], pathSegments: string[]): RouteParams | null {
  if (routeSegments.length !== pathSegments.length) return null

  const params: RouteParams = {}
  for (let i = 0; i < routeSegments.length; i += 1) {
    const routeSegment = routeSegments[i] as string
    const pathSegment = pathSegments[i] as string
    if (routeSegment.startsWith(':')) {
      params[routeSegment.slice(1)] = decodeURIComponent(pathSegment)
    } else if (routeSegment !== pathSegment) {
      return null
    }
  }
  return params
}

function browserPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

/**
 * One instance per app (created in `main.ts`/`App.svelte`, not a module
 * singleton) — `admin` and `platform-admin` each get their own route table.
 * Rune state lives on private class fields so the instance can cross module
 * boundaries and still stay reactive, the same shape Svelte 5 recommends for
 * shareable stateful classes.
 */
export class Router {
  #routes: FlatRoute[]
  #notFound: RouterConfig['notFound']

  #pathname = $state(browserPathname())
  #params: RouteParams = $state({})
  #component: Component | null = $state(null)
  #loading = $state(false)
  #error: unknown = $state(null)
  #guardRejected = $state(false)

  constructor(config: RouterConfig) {
    this.#routes = flatten(config.routes)
    this.#notFound = config.notFound

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => this.#syncFromLocation())
    }
    this.#syncFromLocation()
  }

  get pathname(): string {
    return this.#pathname
  }

  get params(): RouteParams {
    return this.#params
  }

  get component(): Component | null {
    return this.#component
  }

  get loading(): boolean {
    return this.#loading
  }

  /** The loader's (or guard's) thrown error, for the app to render via its own error view. `null` once a navigation resolves cleanly. */
  get error(): unknown {
    return this.#error
  }

  /** `true` when the matched route's guard rejected — distinct from `error`, since it isn't a failure to render as a stack trace. */
  get guardRejected(): boolean {
    return this.#guardRejected
  }

  navigate(path: string): void {
    if (typeof window === 'undefined') return
    window.history.pushState({}, '', path)
    this.#syncFromLocation()
  }

  /** Attach to an `<a>`'s `onclick` to route in-app instead of a full navigation. */
  handleLinkClick = (event: MouseEvent, href: string): void => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    this.navigate(href)
  }

  #syncFromLocation(): void {
    const pathname = browserPathname()
    this.#pathname = pathname
    void this.#resolve(pathname)
  }

  async #resolve(pathname: string): Promise<void> {
    const pathSegments = splitPath(pathname)
    const matched = this.#routes
      .map((route) => ({ route, params: matchSegments(route.segments, pathSegments) }))
      .find(
        (candidate): candidate is { route: FlatRoute; params: RouteParams } =>
          candidate.params !== null,
      )

    this.#loading = true
    this.#error = null
    this.#guardRejected = false

    try {
      if (!matched) {
        const mod = await this.#notFound()
        if (this.#pathname !== pathname) return // superseded by a newer navigation
        this.#component = mod.default
        this.#params = {}
        return
      }

      if (matched.route.guard) {
        const allowed = await matched.route.guard(matched.params)
        if (this.#pathname !== pathname) return
        if (!allowed) {
          this.#guardRejected = true
          this.#component = null
          return
        }
      }

      const mod = await matched.route.load()
      if (this.#pathname !== pathname) return
      this.#component = mod.default
      this.#params = matched.params
    } catch (error) {
      if (this.#pathname !== pathname) return
      this.#error = error
      this.#component = null
    } finally {
      if (this.#pathname === pathname) this.#loading = false
    }
  }
}

export function createRouter(config: RouterConfig): Router {
  return new Router(config)
}
