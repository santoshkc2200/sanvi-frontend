<script lang="ts">
import Badge from '../Badge.svelte'
import Button from '../Button.svelte'
import Stack from '../layout/Stack.svelte'
import {
  AD_HEALTH_TONES,
  adHealthState,
  type AdConnectionHealthData,
  type AdHealthState,
} from './health'

/**
 * One advertising connection's health, rendered from server-computed fields
 * (phase 10, TASK-011). The derivation lives in {@link adHealthState}; this
 * component is deliberately presentational — the caller supplies the
 * localized message and the one fixing action for the derived state, the
 * same labels-as-data rule `AdPlatformCard` follows.
 *
 * No state is conveyed by colour alone: every state renders its own badge
 * text and message, and the message carries the details (last sync time,
 * error text, missing scopes, expiry date) that distinguish it from its
 * neighbours even for a colour-blind reader or a screen reader.
 */
export interface AdHealthLabels {
  badge: string
  message: string
  /** The single action that fixes this state; omitted for `healthy`/`disconnected` (where the card's Connect/Disconnect buttons own the flow). */
  actionLabel?: string
}

interface Props {
  status: string
  health: AdConnectionHealthData
  labels: AdHealthLabels
  /** Derived-state override — lets a caller pin the state it already derived (tests, previews). */
  state?: AdHealthState
  onAction?: () => void
  class?: string
}

let { status, health, labels, state, onAction, class: className = '' }: Props = $props()

const resolvedState: AdHealthState = $derived(state ?? adHealthState(status, health))
const tone = $derived(AD_HEALTH_TONES[resolvedState])
</script>

<div class="sanvi-ad-health {className}" data-health-state={resolvedState}>
  <Stack gap="2">
    <div class="sanvi-ad-health__row">
      <Badge variant={tone}>
        {#snippet children()}
          {labels.badge}
        {/snippet}
      </Badge>
      <p class="sanvi-ad-health__message">{labels.message}</p>
    </div>
    {#if labels.actionLabel && onAction}
      <Button variant="secondary" onclick={onAction}>{labels.actionLabel}</Button>
    {/if}
  </Stack>
</div>

<style>
  .sanvi-ad-health__row {
    display: flex;
    align-items: baseline;
    gap: var(--sanvi-spacing-3);
    flex-wrap: wrap;
  }

  .sanvi-ad-health__message {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
  }
</style>
