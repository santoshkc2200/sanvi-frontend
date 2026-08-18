<script lang="ts">
import { KratosForm, KratosRequestError, safeReturnTo, startFlow, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { Alert, Container, Spinner, Stack } from '@sanvi/ui'
import { kratosClient } from '../lib/api'

const COPY = {
  title: 'Verify it’s you',
  loading: 'Loading',
  genericError: 'Something went wrong. Try again in a moment.',
  notEnrolled:
    'Platform admin requires an authenticator app. Set one up in Settings, then come back here.',
  enroll: 'Go to settings',
}

let flow = $state<KratosFlow | undefined>(undefined)
let submitting = $state(false)
let error = $state<string | undefined>(undefined)
let notEnrolled = $state(false)

const params = new URLSearchParams(window.location.search)
const returnTo = safeReturnTo(params.get('return_to'))

async function loadStepUpFlow(): Promise<void> {
  try {
    flow = await startFlow(kratosClient, 'login', { aal: 'aal2', returnTo })
    // No totp node in an aal2-requested flow means the identity has no
    // second factor enrolled yet — there's nothing to step up *with*.
    notEnrolled = !flow.ui.nodes.some((node) => node.group === 'totp')
  } catch (err) {
    if (err instanceof KratosRequestError) {
      notEnrolled = true
      return
    }
    error = COPY.genericError
  }
}

$effect(() => {
  void loadStepUpFlow()
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
      window.location.href = returnTo ?? '/'
      return
    }
    if (result.kind === 'validation_error') {
      flow = result.flow
      return
    }
    await loadStepUpFlow()
  } catch {
    error = COPY.genericError
  } finally {
    submitting = false
  }
}
</script>

<svelte:head>
  <title>{COPY.title}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <h1>{COPY.title}</h1>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if notEnrolled}
      <Alert variant="info">{COPY.notEnrolled}</Alert>
      <a href="/settings/security">{COPY.enroll}</a>
    {:else if flow}
      <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
    {:else}
      <Spinner label={COPY.loading} />
    {/if}
  </Stack>
</Container>
