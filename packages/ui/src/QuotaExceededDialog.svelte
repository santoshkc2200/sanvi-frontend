<script lang="ts">
import Button from './Button.svelte'
import Dialog from './Dialog.svelte'
import Stack from './layout/Stack.svelte'

interface Props {
  open?: boolean
  feature: string
  currentUsage?: number
  limit?: number
  titleText?: string
  descriptionText?: string
  upgradeCtaLabel?: string
  closeLabel?: string
  cancelLabel?: string
  upgradeHref?: string
  onClose?: () => void
  onUpgrade?: () => void
  class?: string
}

let {
  open = $bindable(false),
  feature,
  currentUsage,
  limit,
  titleText,
  descriptionText,
  upgradeCtaLabel,
  closeLabel,
  cancelLabel,
  upgradeHref = '/billing',
  onClose,
  onUpgrade,
  class: className = '',
}: Props = $props()

const COPY = {
  defaultTitle: 'Plan limit reached',
  defaultDescription: (feat: string, usage?: number, lim?: number) => {
    if (usage !== undefined && lim !== undefined) {
      return `You have reached your limit of ${usage}/${lim} for ${feat}. Upgrade your plan to increase this limit.`
    }
    return `You have reached the maximum allowed limit for "${feat}". Upgrade your plan to unlock higher capacity.`
  },
  defaultUpgradeCta: 'Upgrade plan',
  defaultClose: 'Close',
  defaultCancel: 'Cancel',
}

const displayTitle = $derived(titleText ?? COPY.defaultTitle)
const displayDescription = $derived(
  descriptionText ?? COPY.defaultDescription(feature, currentUsage, limit),
)
const displayUpgradeCta = $derived(upgradeCtaLabel ?? COPY.defaultUpgradeCta)
const displayClose = $derived(closeLabel ?? COPY.defaultClose)
const displayCancel = $derived(cancelLabel ?? COPY.defaultCancel)

let prevOpen = open
$effect(() => {
  if (prevOpen && !open) {
    onClose?.()
  }
  prevOpen = open
})

function handleClose(): void {
  open = false
}
</script>

<Dialog
  bind:open
  titleText={displayTitle}
  closeLabel={displayClose}
  class={className}
>
  <Stack gap="4">
    <p class="sanvi-quota-dialog__description">{displayDescription}</p>
  </Stack>

  {#snippet footer()}
    <Button variant="secondary" onclick={handleClose}>
      {displayCancel}
    </Button>
    {#if onUpgrade}
      <Button variant="primary" onclick={onUpgrade}>
        {displayUpgradeCta}
      </Button>
    {:else}
      <a class="sanvi-quota-dialog__upgrade-link" href={upgradeHref}>
        {displayUpgradeCta}
      </a>
    {/if}
  {/snippet}
</Dialog>

<style>
  .sanvi-quota-dialog__description {
    margin: 0;
    font-size: var(--sanvi-font-size-base);
    color: var(--sanvi-color-text-secondary);
    line-height: var(--sanvi-line-height-base);
  }

  .sanvi-quota-dialog__upgrade-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-quota-dialog__upgrade-link:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }
</style>
