import { bootSession, startSessionAutoRefresh } from '@sanvi/auth'
import { currentLocale, initI18n, t } from '@sanvi/i18n'
import { registerPlatformAdminSurface } from '@sanvi/i18n/surfaces/platform-admin'
import {
  buildDiagnosticsPaste,
  errorTraceId,
  recentBreadcrumbs,
} from '@sanvi/telemetry/diagnostics'
import { mount } from 'svelte'
import '@sanvi/ui/styles.css'
import { apiClient } from './lib/api'
import { initPlatformAdminTelemetry } from './lib/telemetry'
import App from './App.svelte'

function resolveTarget(): HTMLElement {
  const target = document.getElementById('app')
  if (!target) throw new Error('#app root element not found')
  return target
}

const target = resolveTarget()

// TASK-032: this app's catalog shards before the first `t()` — platform
// plus common/errors only; the two former `admin.*` boot/nav keys it shared
// with the tenant console moved to `common` precisely so no `admin` shard
// ships here.
registerPlatformAdminSurface()

// Phase 06: negotiate the locale *before* anything renders — device cookie
// (already seeded by the runtime) then `navigator.languages`. The account
// preference leg joins after `bootSession` (below), so even the boot-failure
// screen is in the right language.
initI18n({ acceptLanguages: typeof navigator !== 'undefined' ? [...navigator.languages] : [] })

// Session must be known before the router resolves its first route — see
// `@sanvi/admin`'s identical `main.ts` comment. `hydrateSession` rethrows
// network/5xx failures; without a session no route can resolve (every screen
// is behind `requireAal2`), so surface a retryable failure instead of leaving
// a blank, never-mounted page. The failure screen is an error screen like
// any other (FR-1106): the ApiError's trace id is shown and the one-paste
// copy-diagnostics action is offered.
function renderBootFailure(error: unknown): void {
  const traceId = errorTraceId(error)
  const outage = document.createElement('div')
  // The per-route outage matrix (TASK-023 step 5) reads this marker: the
  // boot failure is a terminal designed state, not an infinite spinner.
  outage.setAttribute('data-async-state', 'error')
  const message = document.createElement('p')
  message.textContent = t['common.boot.failureMessage']()

  const children: HTMLElement[] = [message]
  if (traceId) {
    const traceLine = document.createElement('p')
    traceLine.textContent = t['errors.traceId']({ id: traceId })
    children.push(traceLine)

    const copy = document.createElement('button')
    copy.type = 'button'
    copy.textContent = t['errors.diagnostics.copy']()
    copy.onclick = () => {
      void navigator.clipboard
        ?.writeText(
          buildDiagnosticsPaste({
            release: __APP_BUILD__,
            route: 'boot',
            tenantId: null,
            locale: currentLocale(),
            traceId,
            breadcrumbs: recentBreadcrumbs(),
          }),
        )
        .then(() => {
          copy.textContent = t['errors.diagnostics.copied']()
        })
        .catch(() => {})
    }
    children.push(copy)
  }

  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = t['common.retry']()
  retry.onclick = () => window.location.reload()
  children.push(retry)

  outage.append(...children)
  target.replaceChildren(outage)
}

async function boot(): Promise<void> {
  try {
    const session = await bootSession(apiClient)
    // The account preference applies only when no device cookie exists —
    // `initI18n`'s leg order encodes that; a no-op when the cookie decided.
    initI18n({ sessionLocale: session?.locale })
  } catch (error) {
    renderBootFailure(error)
    return
  }

  // Keeps the store true for the tab's lifetime (revocation/step-up made
  // elsewhere), on top of the `onUnauthorized` hook that covers changes made
  // *in* this tab.
  startSessionAutoRefresh(apiClient)

  // RUM collection — wired but disabled (see `./lib/telemetry` for why).
  initPlatformAdminTelemetry()

  mount(App, { target })
}

void boot()
