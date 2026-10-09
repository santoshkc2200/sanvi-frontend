<script lang="ts">
import { KratosForm, KratosRequestError, safeReturnTo, startFlow, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, Spinner, Stack } from '@sanvi/ui'
import { kratosClient } from '../lib/api'

/**
 * The admin console's step-up screen (phase 10, TASK-011). Money-adjacent
 * actions — advertising connection changes among them — need a fresh aal2
 * confirmation; destructive controls route here with `return_to` pointing
 * back at the action, and a successful re-authentication returns the
 * operator to exactly where they were. Mirrors the platform console's
 * step-up route (phase 03) against the tenant session.
 */
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
        error = t['admin.stepUp.genericError']()
      }
      return
    }
    error = t['admin.stepUp.genericError']()
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
    error = t['admin.stepUp.genericError']()
  } finally {
    submitting = false
  }
}
</script>

<svelte:head>
  <title>{t['admin.stepUp.title']()}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <h1>{t['admin.stepUp.title']()}</h1>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if notEnrolled}
      <Alert variant="info">{t['admin.stepUp.notEnrolled']()}</Alert>
      <a href="/settings/security">{t['admin.stepUp.enroll']()}</a>
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
