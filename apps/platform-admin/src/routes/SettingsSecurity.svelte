<script lang="ts">
import { KratosForm, getFlow, logout, startFlow, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { listSessions, revokeSession } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, Spinner, Stack } from '@sanvi/ui'
import { apiClient, kratosClient } from '../lib/api'

let flow = $state<KratosFlow | undefined>(undefined)
let flowError = $state<string | undefined>(undefined)
let submitting = $state(false)
let error = $state<string | undefined>(undefined)
let sessions = $state<Awaited<ReturnType<typeof listSessions>>>([])
let revokingId = $state<string | undefined>(undefined)

async function loadSettingsFlow(): Promise<void> {
  flowError = undefined
  const params = new URLSearchParams(window.location.search)
  const flowId = params.get('flow')
  try {
    flow = flowId
      ? await getFlow(kratosClient, 'settings', flowId)
      : await startFlow(kratosClient, 'settings')
  } catch {
    // TASK-023: a failed flow load is a terminal state — an unhandled
    // rejection under a forever-spinner is neither honest nor terminal.
    flowError = t['platform.settingsSecurity.loadError']()
  }
}

$effect(() => {
  void loadSettingsFlow()
  // Best-effort: a failed sessions list (network blip) shouldn't error the
  // whole page — it just shows fewer rows until the next visit.
  listSessions(apiClient)
    .then((result) => {
      sessions = result
    })
    .catch(() => {})
})

async function handleSubmit(node: UiNode, values: Record<string, string | boolean>): Promise<void> {
  if (!flow) return
  submitting = true
  error = undefined
  try {
    const body: Record<string, string | boolean> = { ...values }
    if (node.attributes.name && node.attributes.value !== undefined) {
      body[node.attributes.name] = String(node.attributes.value)
    }
    const result = await submitFlow(kratosClient, flow, body)

    if (result.kind === 'success') {
      if (result.flow) flow = result.flow
      return
    }
    if (result.kind === 'validation_error') {
      flow = result.flow
      return
    }
    await loadSettingsFlow()
  } catch {
    error = t['platform.settingsSecurity.genericError']()
  } finally {
    submitting = false
  }
}

async function handleRevoke(sessionId: string): Promise<void> {
  revokingId = sessionId
  try {
    await revokeSession(apiClient, sessionId)
    sessions = sessions.filter((session) => session.session_id !== sessionId)
  } catch {
    // Revoking the current session 401s by design (the cookie is now dead);
    // anything else is a transient failure — either way, say so.
    error = t['platform.settingsSecurity.genericError']()
  } finally {
    revokingId = undefined
  }
}

async function handleSignOutEverywhere(): Promise<void> {
  try {
    await logout(kratosClient)
  } catch {
    // Building the logout URL needs Kratos reachable — say so instead of
    // rejecting unhandled under the button.
    error = t['platform.settingsSecurity.genericError']()
  }
}
</script>

<Container size="sm" padding="6">
  <Stack gap="8">
    <div>
      <h1>{t['platform.settingsSecurity.title']()}</h1>
      {#if error}
        <Alert variant="error">{error}</Alert>
      {:else if flow?.state === 'success'}
        <Alert variant="success">{t['platform.settingsSecurity.saved']()}</Alert>
      {/if}
      {#if flow}
        <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
      {:else if flowError}
        <!-- TASK-023: named failure with a recovery action, not a spinner. -->
        <Alert variant="error" title={flowError}>
          <Button variant="secondary" onclick={() => void loadSettingsFlow()}>
            {t['common.retry']()}
          </Button>
        </Alert>
      {:else}
        <Spinner label={t['common.loading']()} />
      {/if}
    </div>

    <div>
      <h2>{t['platform.settingsSecurity.sessionsTitle']()}</h2>
      <Stack gap="3">
        {#each sessions as session (session.session_id)}
          <div class="sanvi-session-row">
            <span>
              {t['platform.settingsSecurity.currentSessionLabel']({
                methods:
                  session.methods.join(', ') || t['platform.settingsSecurity.unknownMethod'](),
              })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              loading={revokingId === session.session_id}
              onclick={() => handleRevoke(session.session_id)}
            >
              {t['platform.settingsSecurity.revoke']()}
            </Button>
          </div>
        {/each}
      </Stack>
      <Button variant="secondary" onclick={handleSignOutEverywhere}>{t['platform.settingsSecurity.signOutEverywhere']()}</Button>
    </div>
  </Stack>
</Container>

<style>
  .sanvi-session-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-3);
  }
</style>
