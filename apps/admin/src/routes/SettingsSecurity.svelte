<script lang="ts">
import { KratosForm, getFlow, logout, startFlow, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { listSessions, revokeSession } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, Spinner, Stack } from '@sanvi/ui'
import { apiClient, kratosClient } from '../lib/api'

/** Locale-rendered at call time from the template, so a switch re-renders. */
function currentSessionLabel(methods: string[]): string {
  return t['admin.settingsSecurity.currentSessionLabel']({
    methods: methods.join(', ') || t['admin.settingsSecurity.unknownMethod'](),
  })
}

let flow = $state<KratosFlow | undefined>(undefined)
let submitting = $state(false)
let error = $state<string | undefined>(undefined)
let sessions = $state<Awaited<ReturnType<typeof listSessions>>>([])
let revokingId = $state<string | undefined>(undefined)

async function loadSettingsFlow(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  const flowId = params.get('flow')
  flow = flowId
    ? await getFlow(kratosClient, 'settings', flowId)
    : await startFlow(kratosClient, 'settings')
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
    error = t['admin.settingsSecurity.genericError']()
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
    error = t['admin.settingsSecurity.genericError']()
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
    error = t['admin.settingsSecurity.genericError']()
  }
}
</script>

<Container size="sm" padding="6">
  <Stack gap="8">
    <div>
      <h1>{t['admin.settingsSecurity.title']()}</h1>
      {#if error}
        <Alert variant="error">{error}</Alert>
      {:else if flow?.state === 'success'}
        <Alert variant="success">{t['admin.settingsSecurity.saved']()}</Alert>
      {/if}
      {#if flow}
        <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
      {:else}
        <Spinner label={t['admin.settingsSecurity.loading']()} />
      {/if}
    </div>

    <div>
      <h2>{t['admin.settingsSecurity.sessionsTitle']()}</h2>
      <Stack gap="3">
        {#each sessions as session (session.session_id)}
          <div class="sanvi-session-row">
            <span>{currentSessionLabel(session.methods)}</span>
            <Button
              variant="ghost"
              size="sm"
              loading={revokingId === session.session_id}
              onclick={() => handleRevoke(session.session_id)}
            >
              {t['admin.settingsSecurity.revoke']()}
            </Button>
          </div>
        {/each}
      </Stack>
      <Button variant="secondary" onclick={handleSignOutEverywhere}>
        {t['admin.settingsSecurity.signOutEverywhere']()}
      </Button>
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
