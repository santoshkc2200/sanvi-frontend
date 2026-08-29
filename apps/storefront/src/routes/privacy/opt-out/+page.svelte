<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, EmptyState, Stack } from '@sanvi/ui'
import { consentState, getConsent } from '$lib/consent.svelte'
import { localePath } from '$lib/links'
import type { PageData } from './$types'

/**
 * The statutory one-click opt-out. Deliberately shaped against every
 * anti-pattern the plan lists: no login, no verification, no confirmation
 * dialog that discourages completion — one press, then the effective date.
 */
export const ssr = false

let { data }: { data: PageData } = $props()

const COPY = $derived({
  title: t['privacy.optOut.title'](),
  intro: t['privacy.optOut.intro'](),
  button: t['privacy.optOut.button'](),
  busy: t['privacy.optOut.busy'](),
  doneTitle: t['privacy.optOut.doneTitle'](),
  doneBody: t['privacy.optOut.doneBody'](),
  alreadyTitle: t['privacy.optOut.alreadyTitle'](),
  alreadyBody: t['privacy.optOut.alreadyBody'](),
  unavailableTitle: t['privacy.optOut.unavailableTitle'](),
  unavailableBody: t['privacy.optOut.unavailableBody'](),
  backLink: t['privacy.overview.backLink'](),
  errorBody: t['privacy.optOut.errorBody'](),
})

const privacy = $derived(data.privacy)

// Follow the choices page pattern: read consentState.version/ready so this
// derivation re-runs once the store is created by the root layout's effect.
const consent = $derived.by(() => {
  void consentState.version
  void consentState.ready
  return getConsent()
})

let submitting = $state(false)
let done = $state(false)
let failed = $state(false)

const alreadyOptedOut = $derived(
  consent?.decision('sale_or_share').state === 'denied' &&
    ['opt_out', 'signal'].includes(consent?.decision('sale_or_share').source ?? ''),
)

const effectiveDays = $derived(privacy?.noticeAtCollection?.opt_out_effective_business_days ?? null)

async function optOut(): Promise<void> {
  if (submitting) return
  submitting = true
  failed = false
  try {
    const store = getConsent()
    if (!store) throw new Error('Consent store unavailable')
    await store.optOut('ui')
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
      <a href={localePath('/privacy')}>{COPY.backLink}</a>
    {:else if done}
      <Alert variant="success" title={COPY.doneTitle}>{COPY.doneBody}</Alert>
    {:else if alreadyOptedOut}
      <Alert variant="info" title={COPY.alreadyTitle}>{COPY.alreadyBody}</Alert>
    {:else}
      <div>
        <Button onclick={optOut} disabled={submitting}>
          {submitting ? COPY.busy : COPY.button}
        </Button>
      </div>
      {#if failed}
        <Alert variant="error">{COPY.errorBody}</Alert>
      {/if}
      {#if effectiveDays !== null}
        <p>{t['privacy.optOut.effectiveDays']({ count: effectiveDays })}</p>
      {/if}
    {/if}
    <a href={localePath('/privacy')}>{COPY.backLink}</a>
  </Stack>
</Container>
