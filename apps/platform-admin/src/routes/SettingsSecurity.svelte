<script lang="ts">
import { KratosForm, getFlow, logout, startFlow, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { listSessions, revokeSession } from '@sanvi/api-client'
import { Alert, Button, Container, Spinner, Stack } from '@sanvi/ui'
import { apiClient, kratosClient } from '../lib/api'

const COPY = {
  title: 'Security',
  loading: 'Loading',
  genericError: 'Something went wrong. Try again in a moment.',
  saved: 'Saved.',
  sessionsTitle: 'Sessions',
  currentSessionLabel: (methods: string[]) =>
    `Signed in via ${methods.join(', ') || 'unknown method'}`,
  revoke: 'Sign out this session',
  signOutEverywhere: 'Sign out everywhere',
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
  listSessions(apiClient).then((result) => {
    sessions = result
  })
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
    error = COPY.genericError
  } finally {
    submitting = false
  }
}

async function handleRevoke(sessionId: string): Promise<void> {
  revokingId = sessionId
  try {
    await revokeSession(apiClient, sessionId)
    sessions = sessions.filter((session) => session.session_id !== sessionId)
  } finally {
    revokingId = undefined
  }
}

async function handleSignOutEverywhere(): Promise<void> {
  await logout(kratosClient)
}
</script>

<Container size="sm" padding="6">
  <Stack gap="8">
    <div>
      <h1>{COPY.title}</h1>
      {#if error}
        <Alert variant="error">{error}</Alert>
      {:else if flow?.state === 'success'}
        <Alert variant="success">{COPY.saved}</Alert>
      {/if}
      {#if flow}
        <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
      {:else}
        <Spinner label={COPY.loading} />
      {/if}
    </div>

    <div>
      <h2>{COPY.sessionsTitle}</h2>
      <Stack gap="3">
        {#each sessions as session (session.session_id)}
          <div class="sanvi-session-row">
            <span>{COPY.currentSessionLabel(session.methods)}</span>
            <Button
              variant="ghost"
              size="sm"
              loading={revokingId === session.session_id}
              onclick={() => handleRevoke(session.session_id)}
            >
              {COPY.revoke}
            </Button>
          </div>
        {/each}
      </Stack>
      <Button variant="secondary" onclick={handleSignOutEverywhere}>{COPY.signOutEverywhere}</Button>
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
