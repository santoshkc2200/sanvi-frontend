<script lang="ts">
import { KratosForm, logout, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { listSessions, revokeSession } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, Stack } from '@sanvi/ui'
import { untrack } from 'svelte'
import { apiClient, kratosClient } from '$lib/auth'
import { loadFlow } from '$lib/load-flow'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

let flow = $state<KratosFlow>(untrack(() => data.flow))
let submitting = $state(false)
let error = $state<string | undefined>(undefined)
let sessions = $state<Awaited<ReturnType<typeof listSessions>>>([])
let revokingId = $state<string | undefined>(undefined)

const COPY = $derived({
  title: t['settings.security.title'](),
  genericError: t['settings.security.genericError'](),
  saved: t['settings.security.saved'](),
  sessionsTitle: t['settings.security.sessionsTitle'](),
  // The backend's `SessionView` (phase 02) reports only session id, aal,
  // methods, and authenticated_at — no device/IP/location yet, so this
  // section shows exactly that rather than fabricating fields the API
  // doesn't return.
  currentSessionLabel: (methods: string[]) =>
    t['settings.security.currentSession']({
      methods: methods.join(', ') || t['settings.security.unknownMethod'](),
    }),
  revoke: t['settings.security.revoke'](),
  signOutEverywhere: t['settings.security.signOutEverywhere'](),
})

$effect(() => {
  // Best-effort: a failed sessions list (network blip) shouldn't error the
  // whole page — it just shows fewer rows until the next visit.
  listSessions(apiClient)
    .then((result) => {
      sessions = result
    })
    .catch(() => {})
})

async function handleSubmit(node: UiNode, values: Record<string, string | boolean>): Promise<void> {
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
    const resumed = await loadFlow('settings', new URL(window.location.href))
    flow = resumed.flow
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
  } catch {
    // Revoking the current session 401s by design (the cookie is now dead);
    // anything else is a transient failure — either way, say so.
    error = COPY.genericError
  } finally {
    revokingId = undefined
  }
}

async function handleSignOutEverywhere(): Promise<void> {
  await logout(kratosClient)
}
</script>

<svelte:head>
  <title>{COPY.title}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="8">
    <div>
      <h1>{COPY.title}</h1>
      {#if error}
        <Alert variant="error">{error}</Alert>
      {:else if flow.state === 'success'}
        <Alert variant="success">{COPY.saved}</Alert>
      {/if}
      <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
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
