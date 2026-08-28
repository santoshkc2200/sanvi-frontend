<script lang="ts">
import { getSubscription } from '@sanvi/api-client'
import { Alert, Button, Container, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'

const COPY = {
  title: 'Setting up your workspace',
  description:
    'We are activating your subscription and provisioning your workspace features. This usually takes just a few seconds.',
  successTitle: 'Workspace ready!',
  successDescription: 'Your subscription is active. Taking you to your dashboard...',
  timeoutTitle: 'Activation is taking a bit longer than usual',
  timeoutDescription:
    'Your payment was received, but our webhook confirmation is still processing in the background. You can refresh the status or continue to your dashboard.',
  retryButton: 'Check again',
  dashboardButton: 'Go to Dashboard',
  supportPrompt: 'Need help?',
  supportLink: 'Contact support',
}

let status = $state<'polling' | 'success' | 'timeout'>('polling')
let attempts = $state(0)
let error = $state<string | undefined>(undefined)

const MAX_ATTEMPTS = 20
let cancelled = false
let abortController: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let redirectTimer: ReturnType<typeof setTimeout> | undefined

async function pollStatus(): Promise<void> {
  if (cancelled) return

  if (abortController) {
    abortController.abort()
    abortController = undefined
  }
  const controller = new AbortController()
  abortController = controller

  try {
    const sub = await getSubscription(apiClient, controller.signal)
    if (cancelled) return
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
      status = 'success'
      redirectTimer = setTimeout(() => {
        if (!cancelled) {
          window.location.href = '/'
        }
      }, 1500)
      return
    }
  } catch {
    if (cancelled) return
    // Keep polling through transient errors
  } finally {
    if (abortController === controller) {
      abortController = undefined
    }
  }

  if (cancelled) return
  attempts += 1
  if (attempts >= MAX_ATTEMPTS) {
    status = 'timeout'
    return
  }

  // Progressive backoff: 2s for first 10 attempts, 4s after
  const interval = attempts < 10 ? 2000 : 4000
  timer = setTimeout(pollStatus, interval)
}

$effect(() => {
  cancelled = false
  pollStatus()
  return () => {
    cancelled = true
    if (timer) clearTimeout(timer)
    if (redirectTimer) clearTimeout(redirectTimer)
    if (abortController) {
      abortController.abort()
      abortController = undefined
    }
  }
})

function manualRetry(): void {
  attempts = 0
  status = 'polling'
  pollStatus()
}

function goToDashboard(): void {
  window.location.href = '/'
}
</script>

<svelte:head>
  <title>{COPY.title}</title>
</svelte:head>

<Container size="sm" padding="6">
  <div class="sanvi-activating">
    {#if status === 'polling'}
      <Stack gap="6" align="center">
        <Spinner label={COPY.title} />
        <Stack gap="2" align="center">
          <h1 class="sanvi-activating__title">{COPY.title}</h1>
          <p class="sanvi-activating__description">{COPY.description}</p>
        </Stack>
      </Stack>
    {:else if status === 'success'}
      <Stack gap="4" align="center">
        <div class="sanvi-activating__badge sanvi-activating__badge--success" aria-hidden="true">
          ✓
        </div>
        <h1 class="sanvi-activating__title">{COPY.successTitle}</h1>
        <p class="sanvi-activating__description">{COPY.successDescription}</p>
      </Stack>
    {:else if status === 'timeout'}
      <Stack gap="6" align="center">
        <div class="sanvi-activating__badge sanvi-activating__badge--warning" aria-hidden="true">
          !
        </div>
        <Stack gap="2" align="center">
          <h1 class="sanvi-activating__title">{COPY.timeoutTitle}</h1>
          <p class="sanvi-activating__description">{COPY.timeoutDescription}</p>
        </Stack>

        <Stack gap="3" align="center">
          <Button variant="primary" onclick={manualRetry}>
            {COPY.retryButton}
          </Button>
          <Button variant="secondary" onclick={goToDashboard}>
            {COPY.dashboardButton}
          </Button>
        </Stack>

        <div class="sanvi-activating__support">
          <span>{COPY.supportPrompt}</span>
          <a class="sanvi-activating__link" href="mailto:support@sanvi.app">
            {COPY.supportLink}
          </a>
        </div>
      </Stack>
    {/if}
  </div>
</Container>

<style>
  .sanvi-activating {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-10) var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-xl);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
    text-align: center;
    margin-block-start: var(--sanvi-spacing-12);
  }

  .sanvi-activating__title {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-activating__description {
    margin: 0;
    font-size: var(--sanvi-font-size-base);
    color: var(--sanvi-color-text-secondary);
    line-height: var(--sanvi-line-height-base);
  }

  .sanvi-activating__badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--sanvi-spacing-12);
    height: var(--sanvi-spacing-12);
    border-radius: var(--sanvi-radius-full);
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-activating__badge--success {
    background: var(--sanvi-color-status-success);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-activating__badge--warning {
    background: var(--sanvi-color-status-warning);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-activating__support {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-activating__link {
    color: var(--sanvi-color-link-primary);
    text-decoration: underline;
  }
</style>
