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

export function handleLinkClick(event: MouseEvent, href: string): void {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate(href)
}
