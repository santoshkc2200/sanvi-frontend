<script lang="ts">
import { KratosForm, getFlow, safeReturnTo, startFlow, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { Alert, Container, Spinner, Stack } from '@sanvi/ui'
import { kratosClient } from '../lib/api'

let flow = $state<KratosFlow | undefined>(undefined)
let submitting = $state(false)
let error = $state<string | undefined>(undefined)

const params = new URLSearchParams(window.location.search)
const returnTo = safeReturnTo(params.get('return_to'))
const flowId = params.get('flow')

async function loadLoginFlow(): Promise<void> {
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

$effect(() => {
  loadLoginFlow().catch(() => {
    // The restart failed too (backend down, network) — show it instead of
    // leaving an unhandled rejection under a forever-spinner.
    error = t['platform.login.genericError']()
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
      // A full navigation — `main.ts` awaits `bootSession` before mounting,
      // so this is also how the app picks up the now-signed-in session
      // (and, if `aal1` only, the `requireAal2` guard routes on to `/step-up`).
      window.location.href = returnTo ?? '/'
      return
    }
    if (result.kind === 'validation_error') {
      flow = result.flow
      return
    }
    await loadLoginFlow()
  } catch {
    error = t['platform.login.genericError']()
  } finally {
    submitting = false
  }
}
</script>

<svelte:head>
  <title>{t['platform.login.title']()}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <h1>{t['platform.login.title']()}</h1>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if flow}
      <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
    {:else}
      <Spinner label={t['common.loading']()} />
    {/if}
  </Stack>
</Container>
