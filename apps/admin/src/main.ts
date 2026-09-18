import { bootSession, startSessionAutoRefresh } from '@sanvi/auth'
import { initI18n, t } from '@sanvi/i18n'
import { mount } from 'svelte'
import '@sanvi/ui/styles.css'
import { apiClient } from './lib/api'
import { initAdminTelemetry } from './lib/telemetry'
import App from './App.svelte'

function resolveTarget(): HTMLElement {
  const target = document.getElementById('app')
  if (!target) throw new Error('#app root element not found')
  return target
}

const target = resolveTarget()

// Phase 06: negotiate the locale *before* anything renders — device cookie
// (already seeded by the runtime) then `navigator.languages`. The account
// preference leg joins after `bootSession` (below), so even the boot-failure
// screen is in the right language.
initI18n({ acceptLanguages: typeof navigator !== 'undefined' ? [...navigator.languages] : [] })

// Session must be known before the router resolves its first route — the
// guards in `App.svelte` assume `bootSession` has already settled (see
// `@sanvi/auth`'s `guards.ts`), so mounting waits on it rather than racing.
// `hydrateSession` rethrows network/5xx failures; without a session the app
// can't resolve any route, so surface a retryable failure instead of leaving
// a blank, never-mounted page.
function renderBootFailure(): void {
  const message = document.createElement('p')
  message.textContent = t['admin.boot.failureMessage']()
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = t['common.retry']()
  retry.onclick = () => window.location.reload()
  target.replaceChildren(message, retry)
}

async function boot(): Promise<void> {
  try {
    const session = await bootSession(apiClient)
    // The account preference applies only when no device cookie exists —
    // `initI18n`'s leg order encodes that; a no-op when the cookie decided.
    initI18n({ sessionLocale: session?.locale })
  } catch {
    renderBootFailure()
    return
  }

  // Keeps the store true for the tab's lifetime (revocation/step-up made
  // elsewhere), on top of the `onUnauthorized` hook that covers changes made
  // *in* this tab.
  startSessionAutoRefresh(apiClient)

  // RUM collection — wired but disabled (see `./lib/telemetry` for why).
  initAdminTelemetry()

  mount(App, { target })
}

void boot()
