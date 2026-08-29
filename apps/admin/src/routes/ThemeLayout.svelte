<script lang="ts">
import { getTenantThemeDraft } from '@sanvi/api-client'
import type { components, LayoutOverride } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { LOCKED_LAYOUT_NAMES } from '@sanvi/theme-runtime'
import { Alert, Badge, Button, Cluster, Container, Field, Select, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'
import { initDraftStore, themeDraft, updateLayoutOverride } from '../lib/theme/draft-store'
import ThemeShell from '../lib/theme/ThemeShell.svelte'

type ThemeDraft = components['schemas']['TenantThemeDraftView']

let loading = $state(true)
let error = $state<string | undefined>(undefined)
let selectedLayout = $state<string>('storefront.home')

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const res = await getTenantThemeDraft(apiClient)
    if (seq !== loadSeq) return
    initDraftStore(res)
    const layouts = Object.keys(res.spec.layouts ?? {})
    if (layouts.length > 0 && !layouts.includes(selectedLayout)) {
      selectedLayout = layouts[0] ?? 'storefront.home'
    }
  } catch {
    if (seq !== loadSeq) return
    error = t['admin.theme.gallery.error']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})

const layoutOptions = $derived(
  Object.keys($themeDraft?.spec?.layouts ?? {}).map((key) => ({
    value: key,
    label: key,
  })),
)

const currentLayoutSpec = $derived($themeDraft?.spec?.layouts?.[selectedLayout])

const isLocked = $derived(
  LOCKED_LAYOUT_NAMES.has(selectedLayout) || Boolean(currentLayoutSpec?.locked),
)

const hiddenSlots = $derived(
  $themeDraft?.theme?.layout_overrides?.[selectedLayout]?.hidden_slots ?? [],
)

function isSlotHidden(slot: string): boolean {
  return hiddenSlots.includes(slot)
}

function toggleSlot(slot: string): void {
  if (isLocked) return

  let nextHidden: string[]
  if (isSlotHidden(slot)) {
    nextHidden = hiddenSlots.filter((s) => s !== slot)
  } else {
    nextHidden = [...hiddenSlots, slot]
  }

  const override: LayoutOverride = {
    hidden_slots: nextHidden,
  }
  updateLayoutOverride(selectedLayout, override)
}
</script>

<svelte:head>
  <title>{t['admin.theme.layout.title']()}</title>
</svelte:head>

<ThemeShell activeTab="layout">
  <Container size="md" padding="6">
    <Stack gap="6">
      <h2>{t['admin.theme.layout.title']()}</h2>
      <p class="sanvi-layout-desc">{t['admin.theme.layout.description']()}</p>

      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={t['admin.theme.gallery.loading']()} />
      {:else if $themeDraft}
        <Field label={t['admin.theme.layout.title']()}>
          {#snippet children({ id })}
            <Select
              {id}
              options={layoutOptions}
              value={selectedLayout}
              onchange={(e) => {
                selectedLayout = e.currentTarget.value
              }}
            />
          {/snippet}
        </Field>

        {#if isLocked}
          <Alert variant="info">
            {t['admin.theme.layout.lockedNotice']()}
          </Alert>
        {/if}

        <div class="sanvi-slots-section">
          <Stack gap="4">
            <h3 class="sanvi-slots-heading">{t['admin.theme.layout.slotsTitle']()}</h3>

            {#if currentLayoutSpec?.slots}
              <Stack gap="3">
                {#each currentLayoutSpec.slots as slot (slot)}
                  {@const hidden = isSlotHidden(slot)}
                  <div class="sanvi-slot-item">
                    <Cluster justify="space-between" align="center">
                      <Cluster gap="2" align="center">
                        <span class="sanvi-slot-name" class:sanvi-slot-name--hidden={hidden}>
                          {slot}
                        </span>
                        {#if hidden}
                          <Badge variant="neutral">Hidden</Badge>
                        {/if}
                        {#if isLocked}
                          <Badge variant="warning">Locked</Badge>
                        {/if}
                      </Cluster>

                      {#if !isLocked}
                        <Button
                          variant="secondary"
                          onclick={() => toggleSlot(slot)}
                        >
                          {hidden
                            ? t['admin.theme.layout.showSlot']()
                            : t['admin.theme.layout.hideSlot']()}
                        </Button>
                      {/if}
                    </Cluster>
                  </div>
                {/each}
              </Stack>
            {/if}
          </Stack>
        </div>
      {/if}
    </Stack>
  </Container>
</ThemeShell>

<style>
  .sanvi-layout-desc {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
  }

  .sanvi-slots-section {
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    background: var(--color-background-primary);
  }

  .sanvi-slots-heading {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
  }

  .sanvi-slot-item {
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    padding: var(--space-3) var(--space-4);
    background: var(--color-background-secondary);
  }

  .sanvi-slot-name {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .sanvi-slot-name--hidden {
    text-decoration: line-through;
    color: var(--color-text-secondary);
  }
</style>
