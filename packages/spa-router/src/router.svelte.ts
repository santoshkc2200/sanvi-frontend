import type { Component } from 'svelte'

export type RouteParams = Record<string, string>

export interface RouteDefinition {
  /** A path segment, e.g. `'tenants'` or `':id'`. Not a full path — nesting comes from `children`. */
  path: string
  /** No-op until phase 02 wires real auth; `undefined` means "always allowed." Return `false` to reject without loading the route. */
  guard?: (params: RouteParams) => boolean | Promise<boolean>
  /**
   * `Component<any>`, not the no-props default `Component<{}>` — a matched
   * route's params (always `RouteParams`, i.e. strings) are spread onto the
   * loaded component as props (`<Page {...router.params} />`), so a route
   * like `tenants/:id` legitimately loads a component that declares a
   * required `id: string` prop. The app's own template is what actually
   * connects params to props; this type only needs to not reject that.
   */
  // biome-ignore lint/suspicious/noExplicitAny: a route's props shape can't be known generically here — see comment above.
  load: () => Promise<{ default: Component<any> }>
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

/** The route's own shape with a leading slash (`/tenants/:id`); the root route collapses to `/`. */
function patternOf(route: FlatRoute): string {
  return route.segments.length === 0 ? '/' : `/${route.segments.join('/')}`
}

/**
 * Programmatic navigation for components that don't hold the `Router`
 * instance (it's constructed once inside each app's `App.svelte`, not
 * threaded through every child route) — a table row's "open detail" handler,
 * for instance. `pushState` alone doesn't fire `popstate`, so every `Router`
 * listens for it and re-resolves; this is the same two-step `Router#navigate`
 * does internally, exposed standalone.
 */
export function navigate(path: string): void {
  if (typeof window === 'undefined') return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** `true` for a plain, unmodified left click — the case that should be intercepted and routed in-app rather than left to the browser. */
function shouldHandleLinkClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
}

/** `onclick` for an `<a href>` that should route in-app — same semantics as `Router#handleLinkClick` (respects modifier keys and non-primary clicks), usable without a `Router` instance. */
export function handleLinkClick(event: MouseEvent, href: string): void {
  if (!shouldHandleLinkClick(event)) return
  event.preventDefault()
  navigate(href)
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
  #pattern: string | null = $state(null)
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

  /**
   * The matched route's pattern (`/tenants/:id`), or `null` when nothing
   * matched (not-found). What cardinality-safe consumers — telemetry
   * segmentation above all — read instead of {@linkcode pathname}: a raw
   * path embeds ids, and every visit then becomes its own bucket.
   */
  get pattern(): string | null {
    return this.#pattern
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

  /**
   * Same two-step as the standalone {@link navigate} (`pushState` then
   * resync), but resyncs `this` directly instead of round-tripping through a
   * `popstate` event — this instance doesn't need to wait for its own
   * listener to fire.
   */
  navigate(path: string): void {
    if (typeof window === 'undefined') return
    window.history.pushState({}, '', path)
    this.#syncFromLocation()
  }

  /** Attach to an `<a>`'s `onclick` to route in-app instead of a full navigation. */
  handleLinkClick = (event: MouseEvent, href: string): void => {
    if (!shouldHandleLinkClick(event)) return
    event.preventDefault()
    this.navigate(href)
  }

  /**
   * The loader a path would navigate to, or `null` when no route matches —
   * what intent-based prefetch (`@sanvi/ui`'s `prefetchOnIntent`) warms.
   * Deliberately *not* guarded: guards run at navigation, never at prefetch,
   * so an unauthorized hover warms a chunk it cannot render — a few KB of
   * code, not a privilege check moved client-side.
   */
  loaderFor(pathname: string): RouteDefinition['load'] | null {
    const pathSegments = splitPath(pathname)
    const matched = this.#routes.find(
      (route) => matchSegments(route.segments, pathSegments) !== null,
    )
    return matched?.load ?? null
  }

  /**
   * Warm a path's route code for a likely navigation (TASK-022). The
   * connection-class / Save-Data decision belongs to the caller's prefetch
   * primitive (`@sanvi/ui`'s `shouldPrefetch`), so this method stays a pure
   * "resolve and load" and the guard is testable against a fake connection.
   */
  prefetch(pathname: string): void {
    this.loaderFor(pathname)?.().catch(() => {
      // A failed warm is a navigation that will fail with a real error
      // surface; prefetch must never raise on its own.
    })
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
        this.#pattern = null
        return
      }

      if (matched.route.guard) {
        const allowed = await matched.route.guard(matched.params)
        if (this.#pathname !== pathname) return
        if (!allowed) {
          this.#guardRejected = true
          this.#pattern = patternOf(matched.route)
          this.#component = null
          return
        }
      }

      const mod = await matched.route.load()
      if (this.#pathname !== pathname) return
      this.#component = mod.default
      this.#params = matched.params
      this.#pattern = patternOf(matched.route)
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
