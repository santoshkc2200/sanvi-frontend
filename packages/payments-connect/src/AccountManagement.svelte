<script lang="ts">
import type { ConnectHTMLElementRecord } from '@stripe/connect-js'
import { onDestroy, onMount } from 'svelte'
import { initializePaymentsConnect } from './loader'

interface Props {
  publishableKey: string
  fetchClientSecret: () => Promise<string>
  locale?: string
  theme?: 'light' | 'dark'
  onSectionOpen?: (section: { sectionName: string }) => void
  onLoadError?: (error: { type: string; message: string }) => void
  onRetry?: () => void
  labels: {
    loading: string
    loadErrorTitle: string
    loadErrorBody: string
    sessionErrorTitle: string
    sessionErrorBody: string
    retry: string
    support: string
    /** Localized prefix marking the provider's raw message as technical detail. */
    technicalDetail: string
  }
}

let {
  publishableKey,
  fetchClientSecret,
  locale,
  theme,
  onSectionOpen,
  onLoadError,
  onRetry,
  labels,
}: Props = $props()

let container: HTMLDivElement | undefined = $state(undefined)
let viewState: 'loading' | 'ready' | 'loadError' | 'sessionError' = $state('loading')
let errorMessage: string | undefined = $state(undefined)
let connectInstance: Awaited<ReturnType<typeof initializePaymentsConnect>> | undefined
let managementEl: ConnectHTMLElementRecord['account-management'] | undefined

onMount(() => {
  let cancelled = false

  void (async () => {
    try {
      connectInstance = await initializePaymentsConnect({
        publishableKey,
        fetchClientSecret,
        locale,
        theme,
      })
      if (cancelled) return

      managementEl = connectInstance.instance.create('account-management')

      if (onSectionOpen) {
        managementEl.setOnSectionOpen((section) => onSectionOpen(section))
      }

      managementEl.setOnLoaderStart(() => {
        if (!cancelled) viewState = 'ready'
      })

      managementEl.setOnLoadError((event) => {
        if (cancelled) return
        errorMessage = event.error.message
        viewState =
          event.error.type === 'account_session_create_error' ? 'sessionError' : 'loadError'
        onLoadError?.({
          type: event.error.type,
          message: event.error.message ?? '',
        })
      })

      if (container && managementEl) {
        container.appendChild(managementEl)
      }
    } catch (err) {
      if (cancelled) return
      errorMessage = err instanceof Error ? err.message : undefined
      const msg = err instanceof Error ? err.message : ''
      const isSession =
        msg.includes('client_secret') ||
        msg.includes('session') ||
        msg.includes('create_payment_connection_session')
      viewState = isSession ? 'sessionError' : 'loadError'
      onLoadError?.({
        type: isSession ? 'account_session_create_error' : 'api_connection_error',
        message: msg,
      })
    }
  })()

  return () => {
    cancelled = true
  }
})

onDestroy(() => {
  if (managementEl && container?.contains(managementEl)) {
    try {
      container.removeChild(managementEl)
    } catch {
      // ignore
    }
  }
  if (connectInstance) {
    try {
      connectInstance.logout()
    } catch {
      // ignore
    }
  }
  managementEl = undefined
})

function retry(): void {
  onRetry?.()
}
</script>

<div class="sanvi-payments-connect__account-management">
  {#if viewState === 'loading'}
    <div class="sanvi-payments-connect__loading" role="status" aria-live="polite">
      <span class="sanvi-payments-connect__spinner" aria-hidden="true"></span>
      <p class="sanvi-payments-connect__loading-text">{labels.loading}</p>
    </div>
  {/if}

  <div
    bind:this={container}
    class="sanvi-payments-connect__container"
    class:sanvi-payments-connect__container--hidden={viewState !== 'ready' && viewState !== 'loading'}
    aria-busy={viewState === 'loading'}
  ></div>

  {#if viewState === 'loadError' || viewState === 'sessionError'}
    <div class="sanvi-payments-connect__error" role="alert">
      <h3 class="sanvi-payments-connect__error-title">
        {viewState === 'sessionError' ? labels.sessionErrorTitle : labels.loadErrorTitle}
      </h3>
      <p class="sanvi-payments-connect__error-body">
        {viewState === 'sessionError' ? labels.sessionErrorBody : labels.loadErrorBody}
      </p>
      {#if errorMessage}
        <p class="sanvi-payments-connect__error-detail">
          {labels.technicalDetail}: {errorMessage}
        </p>
      {/if}
      <div class="sanvi-payments-connect__error-actions">
        {#if onRetry}
          <button type="button" class="sanvi-payments-connect__retry" onclick={retry}>
            {labels.retry}
          </button>
        {/if}
        <span class="sanvi-payments-connect__support">{labels.support}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .sanvi-payments-connect__account-management {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    width: 100%;
  }

  .sanvi-payments-connect__loading {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-payments-connect__spinner {
    width: var(--sanvi-spacing-6);
    height: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thick) solid var(--sanvi-color-border-default);
    border-top-color: var(--sanvi-color-primary-base);
    border-radius: var(--sanvi-radius-full);
    animation: sanvi-spin 0.8s linear infinite;
  }

  @keyframes sanvi-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .sanvi-payments-connect__loading-text {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments-connect__container {
    display: block;
    width: 100%;
    min-height: 400px;
  }

  .sanvi-payments-connect__container--hidden {
    display: none;
  }

  .sanvi-payments-connect__error {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-error);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments-connect__error-title {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments-connect__error-body {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments-connect__error-detail {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    word-break: break-word;
  }

  .sanvi-payments-connect__error-actions {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-payments-connect__retry {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-primary-base);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-primary-base);
    color: var(--sanvi-color-text-inverse);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    cursor: pointer;
  }

  .sanvi-payments-connect__retry:hover {
    background: var(--sanvi-color-primary-hover);
  }

  .sanvi-payments-connect__support {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }
</style>
