<script lang="ts">
import { Alert, Button, Container, EmptyState, Stack } from '@sanvi/ui'
import { OPT_OUT_PURPOSES, getOrCreateDeviceRef } from '@sanvi/consent'
import { recordOptOut } from '@sanvi/api-client'
import { getConsent } from '$lib/consent.svelte'
import { apiClient } from '$lib/auth'
import type { PageData } from './$types'

/**
 * The statutory one-click opt-out. Deliberately shaped against every
 * anti-pattern the plan lists: no login, no verification, no confirmation
 * dialog that discourages completion — one press, then the effective date.
 */
export const ssr = false

let { data }: { data: PageData } = $props()

const COPY = {
  title: 'Do Not Sell or Share My Personal Information',
  intro:
    'Press once to stop the sale or sharing of your personal information and to opt out of targeted advertising and profiling. You do not need an account, and no verification is required.',
  button: 'Opt out now',
  busy: 'Opting out…',
  doneTitle: 'Opt-out recorded',
  doneBody:
    'Your opt-out is recorded and takes effect at the source, not just on this screen. Processing covered by the opt-out stops for this browser immediately and stays stopped.',
  effectiveDaysPrefix: 'Opt-outs on this storefront take effect within',
  effectiveDaysSuffix: 'business days.',
  alreadyTitle: 'Already opted out',
  alreadyBody:
    'This browser already has an opt-out (your choice or a browser privacy signal). Nothing more to do — but pressing again changes nothing.',
  unavailableTitle: 'Privacy service unavailable',
  unavailableBody: 'The opt-out service did not answer. Nothing is being shared while it is down.',
  backLink: 'Back to your privacy overview',
  errorBody: 'The opt-out could not be recorded. Please try again in a moment.',
}

const privacy = $derived(data.privacy)
const consent = $derived(getConsent())

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
    await recordOptOut(apiClient, {
      purposes: [...OPT_OUT_PURPOSES],
      source: 'ui',
      device_ref: getOrCreateDeviceRef(document),
    })
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
      <a href="/privacy">{COPY.backLink}</a>
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
        <p>
          {COPY.effectiveDaysPrefix}
          {effectiveDays}
          {COPY.effectiveDaysSuffix}
        </p>
      {/if}
    {/if}
    <a href="/privacy">{COPY.backLink}</a>
  </Stack>
</Container>
