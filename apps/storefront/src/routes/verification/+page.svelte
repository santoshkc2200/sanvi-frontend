<script lang="ts">
import { KratosForm, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { Alert, Container, Stack } from '@sanvi/ui'
import { untrack } from 'svelte'
import { kratosClient } from '$lib/auth'
import { loadFlow } from '$lib/load-flow'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

let flow = $state<KratosFlow>(untrack(() => data.flow))
let submitting = $state(false)
let error = $state<string | undefined>(undefined)

const COPY = $derived({
  title: t['auth.verification.title'](),
  genericError: t['auth.verification.genericError'](),
  emailSent: t['auth.verification.emailSent'](),
  complete: t['auth.verification.complete'](),
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
    const resumed = await loadFlow('verification', new URL(window.location.href))
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

    {#if flow.state === 'sent_email'}
      <Alert variant="info">{COPY.emailSent}</Alert>
    {:else if flow.state === 'passed_challenge'}
      <Alert variant="success">{COPY.complete}</Alert>
    {/if}

    <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
  </Stack>
</Container>
