<script lang="ts">
import { KratosForm, KratosRequestError, safeReturnTo, startFlow, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, Spinner, Stack } from '@sanvi/ui'
import { kratosClient } from '../lib/api'

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
      // An error from the flow itself (expired/consumed/rate-limited) is
      // NOT "no authenticator enrolled" — restart fresh, per the phase-02
      // expired-flow policy, before concluding anything about enrolment.
      try {
        flow = await startFlow(kratosClient, 'login', { aal: 'aal2', returnTo })
        notEnrolled = !flow.ui.nodes.some((node) => node.group === 'totp')
      } catch {
        error = t['platform.stepUp.genericError']()
      }
      return
    }
    error = t['platform.stepUp.genericError']()
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
    error = t['platform.stepUp.genericError']()
  } finally {
    submitting = false
  }
}
</script>

<svelte:head>
  <title>{t['platform.stepUp.title']()}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <h1>{t['platform.stepUp.title']()}</h1>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if notEnrolled}
      <Alert variant="info">{t['platform.stepUp.notEnrolled']()}</Alert>
      <a href="/settings/security">{t['platform.stepUp.enroll']()}</a>
    {:else if flow}
      <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
    {:else if error}
      <!-- TASK-023: the error state existed in code but was never rendered —
           a backend outage spun forever. Failure named, retry offered. -->
      <Alert variant="error" title={error}>
        <Button variant="secondary" onclick={() => void loadStepUpFlow()}>
          {t['common.retry']()}
        </Button>
      </Alert>
    {:else}
      <Spinner label={t['common.loading']()} />
    {/if}
  </Stack>
</Container>
