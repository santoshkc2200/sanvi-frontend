<script lang="ts">
import { KratosForm, completeLinking, startLinking, submitFlow } from '@sanvi/auth'
import type { KratosFlow, UiNode } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { Alert, Container, Stack } from '@sanvi/ui'
import { untrack } from 'svelte'
import { apiClient, kratosClient } from '$lib/auth'
import { localePath } from '$lib/links'
import { loadFlow } from '$lib/load-flow'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

let flow = $state<KratosFlow | undefined>(untrack(() => data.flow))
let submitting = $state(false)
let error = $state<string | undefined>(undefined)
let linked = $state<{ provider: string } | undefined>(undefined)

const COPY = $derived({
  title: t['auth.link.title'](),
  missingChallenge: t['auth.link.missingChallenge'](),
  explanation: (email: string) => t['auth.link.explanation']({ email }),
  genericError: t['auth.link.genericError'](),
  successBody: (provider: string) => t['auth.link.successBody']({ provider }),
  continue: t['auth.link.continue'](),
})

async function handleSubmit(node: UiNode, values: Record<string, string | boolean>): Promise<void> {
  if (!flow || !data.challenge) return
  submitting = true
  error = undefined
  try {
    const body: Record<string, string | boolean> = { ...values }
    if (node.attributes.name && node.attributes.value !== undefined) {
      body[node.attributes.name] = String(node.attributes.value)
    }
    const result = await submitFlow(kratosClient, flow, body)

    if (result.kind === 'success') {
      // The inner login just proved ownership of the *existing* account —
      // now link the challenged provider to it.
      await startLinking(apiClient, data.challenge)
      const outcome = await completeLinking(apiClient)
      linked = { provider: outcome.provider }
      return
    }
    if (result.kind === 'validation_error') {
      flow = result.flow
      return
    }
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

    {#if !data.challenge || !flow}
      <Alert variant="error">{COPY.missingChallenge}</Alert>
    {:else if linked}
      <Alert variant="success">{COPY.successBody(linked.provider)}</Alert>
      <a href={localePath('/settings/security')}>{COPY.continue}</a>
    {:else}
      <Alert variant="info">{COPY.explanation(data.challenge.email)}</Alert>
      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}
      <KratosForm {flow} onSubmit={handleSubmit} {submitting} />
    {/if}
  </Stack>
</Container>
