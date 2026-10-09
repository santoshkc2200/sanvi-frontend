<script lang="ts">
import { KratosForm, getFlow, safeReturnTo, startFlow, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, Spinner, Stack } from '@sanvi/ui'
import { kratosClient } from '../lib/api'

let flow = $state<KratosFlow | undefined>(undefined)
let submitting = $state(false)
let error = $state<string | undefined>(undefined)
// TASK-023: the flow *load* failing is distinct from a submit failing — a
// dead backend must render this error state INSTEAD of the loading spinner,
// never a spinner next to an error (and never a spinner alone).
let flowError = $state<string | undefined>(undefined)

const params = new URLSearchParams(window.location.search)
const returnTo = safeReturnTo(params.get('return_to'))
const flowId = params.get('flow')

async function loadLoginFlow(): Promise<void> {
  flowError = undefined
  try {
    flow = flowId
      ? await getFlow(kratosClient, 'login', flowId)
      : await startFlow(kratosClient, 'login', { returnTo })
  } catch {
    // A `?flow=` id that can't be resumed (expired, already consumed — e.g.
    // back-navigation after signing in) must not dead-end the page: restart
    // fresh, per the phase-02 expired-flow policy.
    flow = await startFlow(kratosClient, 'login', { returnTo })
  }
}

function retryLoad(): void {
  loadLoginFlow().catch(() => {
    flowError = t['admin.login.genericError']()
  })
}

$effect(() => {
  retryLoad()
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
      // A full navigation, not client-side routing — `main.ts` awaits
      // `bootSession` before mounting, so this is also how the app picks up
      // the now-signed-in session.
      window.location.href = returnTo ?? '/'
      return
    }
    if (result.kind === 'validation_error') {
      flow = result.flow
      return
    }
    await loadLoginFlow()
  } catch {
    error = t['admin.login.genericError']()
  } finally {
    submitting = false
  }
}
</script>

<svelte:head>
  <title>{t['admin.login.title']()}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <h1>{t['admin.login.title']()}</h1>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if flow}
      <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
    {:else if flowError}
      <!-- TASK-023: the outage terminal state — the failure named, a
           recovery action, never a spinner that outlives its request. -->
      <Alert variant="error" title={flowError}>
        <Button variant="secondary" onclick={retryLoad}>
          {t['common.retry']()}
        </Button>
      </Alert>
    {:else}
      <Spinner label={t['admin.login.loading']()} />
    {/if}
  </Stack>
</Container>
