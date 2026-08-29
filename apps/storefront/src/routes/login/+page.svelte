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
  title: t['auth.login.title'](),
  genericError: t['auth.login.genericError'](),
  signUpPrompt: t['auth.login.signUpPrompt'](),
  signUpLink: t['auth.login.signUpLink'](),
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
      window.location.href = data.returnTo ?? '/'
      return
    }
    if (result.kind === 'validation_error') {
      flow = result.flow
      return
    }
    // Expired: transparently restart rather than dead-ending the user —
    // Kratos doesn't preserve entered values across a restart (it's a new
    // flow id), which is the correct/safe behavior for a password field.
    const resumed = await loadFlow('login', new URL(window.location.href))
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
      {COPY.signUpPrompt}
      <a href={localePath('/registration')}>{COPY.signUpLink}</a>
    </p>
  </Stack>
</Container>
