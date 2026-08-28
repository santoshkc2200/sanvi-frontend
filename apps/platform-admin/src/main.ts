import { bootSession, startSessionAutoRefresh } from '@sanvi/auth'
import { mount } from 'svelte'
import '@sanvi/ui/styles.css'
import { apiClient } from './lib/api'
import App from './App.svelte'

function resolveTarget(): HTMLElement {
  const target = document.getElementById('app')
  if (!target) throw new Error('#app root element not found')
  return target
}

const target = resolveTarget()

// Session must be known before the router resolves its first route — see
// `@sanvi/admin`'s identical `main.ts` comment. `hydrateSession` rethrows
// network/5xx failures; without a session no route can resolve (every screen
// is behind `requireAal2`), so surface a retryable failure instead of leaving
// a blank, never-mounted page.
const BOOT_FAILURE = {
  message: 'Could not reach the server. Check your connection and try again.',
  retry: 'Retry',
}

function renderBootFailure(): void {
  const message = document.createElement('p')
  message.textContent = BOOT_FAILURE.message
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = BOOT_FAILURE.retry
  retry.onclick = () => window.location.reload()
  target.replaceChildren(message, retry)
}

async function boot(): Promise<void> {
  try {
    await bootSession(apiClient)
  } catch {
    renderBootFailure()
    return
  }

  // Keeps the store true for the tab's lifetime (revocation/step-up made
  // elsewhere), on top of the `onUnauthorized` hook that covers changes made
  // *in* this tab.
  startSessionAutoRefresh(apiClient)

  mount(App, { target })
}

void boot()
