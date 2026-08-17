/**
 * Minimal client router: tracks `location.pathname` as Svelte 5 state and
 * exposes `navigate`. Route tables map a path to a dynamic `import()` for
 * route-level code splitting — no router library dependency for a two-route
 * placeholder shell; a real router is a call for whichever phase adds
 * enough routes to need nested/parametrized matching.
 */
export const routerState = $state({ pathname: browserPathname() })

function browserPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

export function navigate(path: string): void {
  if (typeof window === 'undefined') return
  window.history.pushState({}, '', path)
  routerState.pathname = path
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    routerState.pathname = browserPathname()
  })
}

/** Attach to an `<a>`'s `onclick` to route in-app instead of a full navigation. */
export function handleLinkClick(event: MouseEvent, href: string): void {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate(href)
}
