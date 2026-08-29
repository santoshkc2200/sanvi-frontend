<script lang="ts">
import { Alert, Button, Container, EmptyState, Stack } from '@sanvi/ui'
import { getConsent } from '$lib/consent.svelte'
import type { PageData } from './$types'

/**
 * CPRA "Limit the Use of My Sensitive Personal Information" — same
 * one-click, no-verification shape as the opt-out.
 */
export const ssr = false

let { data }: { data: PageData } = $props()

const COPY = {
  title: 'Limit the Use of My Sensitive Personal Information',
  intro:
    'Press once to limit how your sensitive personal information is used. You do not need an account, and no verification is required.',
  button: 'Limit use now',
  busy: 'Recording…',
  doneTitle: 'Limitation recorded',
  doneBody:
    'Sensitive personal information is now limited to what the service strictly requires — you will not see this change, but the restriction is enforced at the source.',
  unavailableTitle: 'Privacy service unavailable',
  unavailableBody:
    'The privacy service did not answer. Nothing beyond the service requirements happens with sensitive data while it is down.',
  backLink: 'Back to your privacy overview',
  errorBody: 'The limitation could not be recorded. Please try again in a moment.',
}

const privacy = $derived(data.privacy)

let submitting = $state(false)
let done = $state(false)
let failed = $state(false)

async function limit(): Promise<void> {
  if (submitting) return
  submitting = true
  failed = false
  try {
    const store = getConsent()
    if (!store) throw new Error('Consent store unavailable')
    await store.limitSensitive('ui')
    done = true
  } catch {
    failed = true
  } finally {
    submitting = false
  }
}
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>

    {#if !privacy}
      <EmptyState title={COPY.unavailableTitle} description={COPY.unavailableBody} />
    {:else if done}
      <Alert variant="success" title={COPY.doneTitle}>{COPY.doneBody}</Alert>
    {:else}
      <div>
        <Button onclick={limit} disabled={submitting}>
          {submitting ? COPY.busy : COPY.button}
        </Button>
      </div>
      {#if failed}
        <Alert variant="error">{COPY.errorBody}</Alert>
      {/if}
    {/if}
    <a href="/privacy">{COPY.backLink}</a>
  </Stack>
</Container>
