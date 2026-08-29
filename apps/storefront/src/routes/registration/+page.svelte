<script lang="ts">
import { KratosForm, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { Alert, Container, Stack } from '@sanvi/ui'
import { untrack } from 'svelte'
import { kratosClient } from '$lib/auth'
import { localePath } from '$lib/links'
import { loadFlow } from '$lib/load-flow'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

let flow = $state<KratosFlow>(untrack(() => data.flow))
let submitting = $state(false)
let error = $state<string | undefined>(undefined)

const COPY = $derived({
  title: t['auth.registration.title'](),
  genericError: t['auth.registration.genericError'](),
  signInPrompt: t['auth.registration.signInPrompt'](),
  signInLink: t['auth.registration.signInLink'](),
})

// Consent/opt-out UI for the account's jurisdiction (phase 05's privacy
// centre) attaches here once that phase lands — Kratos's own registration
// nodes (traits, password/code/oidc) render as-is until then.
async function handleSubmit(node: UiNode, values: Record<string, string | boolean>): Promise<void> {
  submitting = true
  error = undefined
  try {
    const body: Record<string, string | boolean> = { ...values }
    if (node.attributes.name && node.attributes.value !== undefined) {
      body[node.attributes.name] = String(node.attributes.value)
    }
    // Registration's `after.password/code/oidc.hooks` includes `session`
    // (see `sanvi-backend/configs/ory/kratos.yml`) — a successful submit
    // signs the user in immediately, same redirect as login.
    const result = await submitFlow(kratosClient, flow, body)

    if (result.kind === 'success') {
      window.location.href = data.returnTo ?? '/'
      return
    }
    if (result.kind === 'validation_error') {
      flow = result.flow
      return
    }
    const resumed = await loadFlow('registration', new URL(window.location.href))
    flow = resumed.flow
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

    <KratosForm {flow} onSubmit={handleSubmit} {submitting} />

    <p>
      {COPY.signInPrompt}
      <a href={localePath('/login')}>{COPY.signInLink}</a>
    </p>
  </Stack>
</Container>
