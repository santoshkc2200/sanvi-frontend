<script lang="ts">
import {
  Alert,
  Button,
  Cluster,
  ConsentPreferences,
  Container,
  EmptyState,
  Stack,
  type PreferenceRow,
} from '@sanvi/ui'
import type { ProcessingPurpose } from '@sanvi/consent'
import { consentState, getConsent } from '$lib/consent.svelte'
import { consentablePurposeCopy } from '$lib/purpose-copy'
import type { PageData } from './$types'

/**
 * The preference centre. One row per purpose with its consequence and
 * source; the control's polarity comes from the store's consent model
 * (which the backend resolved) — this page has no jurisdiction branches.
 * Changes take effect immediately through the store; there is no separate
 * save step, because withdrawal must be as easy as granting.
 */
export const ssr = false

let { data }: { data: PageData } = $props()

const COPY = {
  title: 'Your privacy choices',
  intro:
    'Every purpose below is a separate decision. Turning one off takes effect immediately, here and on other devices after your next sign-in.',
  sensitiveTitle: 'Sensitive personal information',
  recordNote:
    'Changes are recorded together with the notice version and your jurisdiction, so your choices can be proven later.',
  unavailableTitle: 'Choices unavailable',
  unavailableBody:
    'The privacy service did not answer, so no preferences can be shown. Nothing non-essential is running while this page is like this.',
  backLink: 'Back to your privacy overview',
  gpcNote:
    'A browser privacy signal (Global Privacy Control) was detected and applied. It holds the affected purposes down until you explicitly override it below.',
  sourceYourChoice: 'Your choice',
  sourceBrowserSignal: 'Browser signal',
  lockedNote: 'Held by your browser privacy signal.',
  overrideLabel: 'Override signal',
  overrideTitle: 'Override your browser privacy signal?',
  overrideBody:
    'Your browser asked us not to sell or share your information. Overriding replaces that signal with your own explicit choice.',
  overrideConfirm: 'Override',
  overrideCancel: 'Keep signal',
}

const privacy = $derived(data.privacy)

let overrideKey = $state<ProcessingPurpose | null>(null)
// Bumped when the store returns 'gpc-confirmation-required' to force rows to
// re-derive from actual store state (no #emit fires on that path, so
// consentState.version doesn't change, but we still need the checkbox to sync).
let localVersion = $state(0)

// Reads the shared bridge's version (bumped by the store's own mutations
// and by the root layout once the store exists), so this page reacts to
// the singleton being created after this component's own effects ran.
const consent = $derived.by(() => {
  void consentState.version
  void consentState.ready
  return getConsent()
})

function sourceText(source: string | undefined): string | undefined {
  if (!source || source === 'default') return undefined
  if (source === 'signal') return COPY.sourceBrowserSignal
  return COPY.sourceYourChoice
}

const rows = $derived.by<PreferenceRow[]>(() => {
  void localVersion
  const active = consent
  if (!active) return []
  return consentablePurposeCopy()
    .filter(({ purpose }) => purpose !== 'sensitive_pi_use')
    .map(({ purpose, copy }) => {
      const decision = active.decision(purpose)
      const heldBySignal = decision.source === 'signal' && active.gpcApplied
      return {
        key: purpose,
        label: copy.label,
        description: copy.description,
        consequence: copy.consequence,
        allowed: decision.state === 'allowed',
        source: sourceText(decision.source),
        locked: heldBySignal,
        lockedNote: heldBySignal ? COPY.lockedNote : undefined,
      }
    })
})

const sensitiveRows = $derived.by<PreferenceRow[]>(() => {
  void localVersion
  const active = consent
  if (!active) return []
  return consentablePurposeCopy()
    .filter(({ purpose }) => purpose === 'sensitive_pi_use')
    .map(({ purpose, copy }) => {
      const decision = active.decision(purpose)
      return {
        key: purpose,
        label: copy.label,
        description: copy.description,
        consequence: copy.consequence,
        allowed: decision.state === 'allowed',
        source: sourceText(decision.source),
      }
    })
})

function change(key: string, allowed: boolean): void {
  const active = consent
  if (!active) return
  const result = active.setDecision(key as ProcessingPurpose, allowed)
  if (result === 'gpc-confirmation-required') {
    overrideKey = key as ProcessingPurpose
    // No #emit fires on this path, so force rows to re-sync with store state.
    localVersion += 1
  }
}

function confirmOverride(): void {
  const active = consent
  if (active && overrideKey) active.setDecision(overrideKey, true, { overrideGpc: true })
  overrideKey = null
}

const overrideOpen = $derived(overrideKey !== null)
function setOverrideOpen(open: boolean): void {
  if (!open) overrideKey = null
}
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>

    {#if !consent || !privacy}
      <EmptyState title={COPY.unavailableTitle} description={COPY.unavailableBody} />
      <a href="/privacy">{COPY.backLink}</a>
    {:else}
      <ConsentPreferences
        label={COPY.title}
        {rows}
        sensitiveTitle={COPY.sensitiveTitle}
        {sensitiveRows}
        gpcNote={consent.gpcApplied ? COPY.gpcNote : undefined}
        overrideLabel={COPY.overrideLabel}
        onchange={change}
        onOverride={(key) => (overrideKey = key as ProcessingPurpose)}
      />
      <Alert variant="info">{COPY.recordNote}</Alert>

      {#if overrideOpen}
        <section aria-labelledby="sanvi-override" class="sanvi-override">
          <h2 id="sanvi-override">{COPY.overrideTitle}</h2>
          <p>{COPY.overrideBody}</p>
          <Cluster>
            <Button variant="secondary" onclick={() => setOverrideOpen(false)}>
              {COPY.overrideCancel}
            </Button>
            <Button variant="primary" onclick={confirmOverride}>{COPY.overrideConfirm}</Button>
          </Cluster>
        </section>
      {/if}
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-override {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thick) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-override h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-override p {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
  }
</style>
