<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, EmptyState, Stack } from '@sanvi/ui'
import { getConsent } from '$lib/consent.svelte'
import { localePath } from '$lib/links'
import type { PageData } from './$types'

/**
 * CPRA "Limit the Use of My Sensitive Personal Information" — same
 * one-click, no-verification shape as the opt-out.
 */
export const ssr = false

let { data }: { data: PageData } = $props()

const COPY = $derived({
  title: t['privacy.limitSensitive.title'](),
  intro: t['privacy.limitSensitive.intro'](),
  button: t['privacy.limitSensitive.button'](),
  busy: t['privacy.limitSensitive.busy'](),
  doneTitle: t['privacy.limitSensitive.doneTitle'](),
  doneBody: t['privacy.limitSensitive.doneBody'](),
  unavailableTitle: t['privacy.limitSensitive.unavailableTitle'](),
  unavailableBody: t['privacy.limitSensitive.unavailableBody'](),
  backLink: t['privacy.overview.backLink'](),
  errorBody: t['privacy.limitSensitive.errorBody'](),
})

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
    <a href={localePath('/privacy')}>{COPY.backLink}</a>
  </Stack>
</Container>
