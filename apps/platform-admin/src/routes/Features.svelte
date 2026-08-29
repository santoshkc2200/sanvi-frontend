<script lang="ts">
import {
  ApiError,
  defineFeature,
  deprecateFeature,
  listFeatures,
  updateFeature,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import {
  Alert,
  Badge,
  Button,
  DangerousAction,
  DataTable,
  Dialog,
  Field,
  Input,
  Select,
  showToast,
  Stack,
} from '@sanvi/ui'
import { t } from '@sanvi/i18n'
import { apiClient } from '../lib/api'

type FeatureRow = components['schemas']['FeatureView']

// `$derived`, not plain consts — the labels go through `t`, so a locale
// switch has to rebuild the options the selects display.
const KIND_OPTIONS = $derived([
  { value: 'boolean', label: t['platform.features.kindBoolean']() },
  { value: 'quota', label: t['platform.features.kindQuota']() },
])

const VISIBILITY_OPTIONS = $derived([
  { value: 'public', label: t['platform.features.publicLabel']() },
  { value: 'hidden', label: t['platform.features.hiddenLabel']() },
])

let features = $state<FeatureRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

async function load(): Promise<void> {
  loading = true
  error = undefined
  try {
    features = await listFeatures(apiClient)
  } catch {
    error = t['platform.features.errorMessage']()
  } finally {
    loading = false
  }
}

$effect(() => {
  void load()
})

let formOpen = $state(false)
let editing = $state<FeatureRow | undefined>(undefined)
let formKey = $state('')
let formName = $state('')
let formKind = $state<'boolean' | 'quota'>('boolean')
let formDefaultEnabled = $state(false)
let formDefaultLimit = $state('')
let formVisibility = $state<'public' | 'hidden'>('public')
let saving = $state(false)

// `Number("abc")` is NaN and JSON.stringify serializes NaN as null — a typo
// would silently store "unlimited" as the catalog default. Validate first.
const formDefaultLimitInvalid = $derived(
  formKind === 'quota' &&
    formDefaultLimit.trim() !== '' &&
    (!/^\d+$/.test(formDefaultLimit.trim()) || !Number.isSafeInteger(Number(formDefaultLimit))),
)

function openCreate(): void {
  editing = undefined
  formKey = ''
  formName = ''
  formKind = 'boolean'
  formDefaultEnabled = false
  formDefaultLimit = ''
  formVisibility = 'public'
  formOpen = true
}

function openEdit(feature: FeatureRow): void {
  editing = feature
  formKey = feature.key
  formName = feature.name
  formKind = feature.kind
  formDefaultEnabled = feature.default_enabled
  formDefaultLimit = feature.default_limit != null ? String(feature.default_limit) : ''
  formVisibility = feature.visibility
  formOpen = true
}

async function handleSave(): Promise<void> {
  if (formDefaultLimitInvalid) return
  saving = true
  try {
    const limit = formKind === 'quota' && formDefaultLimit.trim() ? Number(formDefaultLimit) : null
    if (editing) {
      await updateFeature(apiClient, editing.key, {
        name: formName,
        default_enabled: formDefaultEnabled,
        default_limit: limit,
        visibility: formVisibility,
      })
    } else {
      await defineFeature(apiClient, {
        key: formKey,
        name: formName,
        kind: formKind,
        default_enabled: formDefaultEnabled,
        default_limit: limit,
        visibility: formVisibility,
      })
    }
    formOpen = false
    showToast({ variant: 'success', title: t['platform.features.saved']({ name: formName }) })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.features.saveError'](),
      description: err instanceof ApiError ? err.detail : undefined,
    })
  } finally {
    saving = false
  }
}

let deprecateTarget = $state<FeatureRow | undefined>(undefined)
let deprecateOpen = $state(false)
let deprecating = $state(false)

function openDeprecate(feature: FeatureRow): void {
  deprecateTarget = feature
  deprecateOpen = true
}

async function handleDeprecate(): Promise<void> {
  if (!deprecateTarget) return
  deprecating = true
  try {
    await deprecateFeature(apiClient, deprecateTarget.key)
    deprecateOpen = false
    showToast({
      variant: 'success',
      title: t['platform.features.deprecated']({ key: deprecateTarget.key }),
    })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.features.deprecateError'](),
      description: err instanceof ApiError ? err.detail : undefined,
    })
  } finally {
    deprecating = false
  }
}
</script>

{#snippet kindCell(row: FeatureRow)}
  <Badge variant={row.kind === 'quota' ? 'info' : 'neutral'}>{row.kind}</Badge>
{/snippet}

{#snippet defaultEnabledCell(row: FeatureRow)}
  <Badge variant={row.default_enabled ? 'success' : 'neutral'}>
    {row.default_enabled ? t['platform.features.enabledYes']() : t['platform.features.enabledNo']()}
  </Badge>
{/snippet}

{#snippet visibilityCell(row: FeatureRow)}
  <Badge variant={row.visibility === 'public' ? 'info' : 'neutral'}>
    {row.visibility === 'public' ? t['platform.features.publicLabel']() : t['platform.features.hiddenLabel']()}
  </Badge>
{/snippet}

{#snippet actionsCell(row: FeatureRow)}
  <Stack gap="2" align="end">
    <Button variant="ghost" size="sm" onclick={() => openEdit(row)}>{t['platform.features.edit']()}</Button>
    {#if !row.deprecated_at}
      <Button variant="ghost" size="sm" onclick={() => openDeprecate(row)}>{t['platform.features.deprecate']()}</Button>
    {/if}
  </Stack>
{/snippet}

<Stack gap="4">
  <div class="sanvi-features__header">
    <div>
      <h1>{t['platform.features.title']()}</h1>
      <p>{t['platform.features.description']()}</p>
    </div>
    <Button onclick={openCreate}>{t['platform.features.newFeature']()}</Button>
  </div>

  <DataTable
    columns={[
      { key: 'key', header: t['platform.features.keyHeader'](), alwaysVisible: true },
      { key: 'name', header: t['platform.features.nameHeader'](), alwaysVisible: true },
      { key: 'kind', header: t['platform.features.kindHeader'](), cell: kindCell },
      { key: 'default_enabled', header: t['platform.features.defaultEnabledHeader'](), cell: defaultEnabledCell },
      { key: 'default_limit', header: t['platform.features.defaultLimitHeader'](), align: 'end' },
      { key: 'visibility', header: t['platform.features.visibilityHeader'](), cell: visibilityCell },
      { key: 'deprecated_at', header: t['platform.features.deprecatedHeader']() },
      { key: 'actions', header: '', align: 'end', cell: actionsCell, alwaysVisible: true },
    ]}
    rows={features}
    getRowId={(row) => row.key}
    {loading}
    {error}
    onRetry={load}
    retryLabel={t['common.retry']()}
    emptyMessage={t['platform.features.emptyMessage']()}
    columnVisibilityStorageKey="platform-admin.features.columns"
  />
</Stack>

<Dialog bind:open={formOpen} titleText={editing ? t['platform.features.editTitle']({ name: editing.name }) : t['platform.features.createTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={t['platform.features.keyLabel']()} hint={editing ? undefined : t['platform.features.keyHint']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={formKey} placeholder={t['platform.features.keyPlaceholder']()} disabled={Boolean(editing)} required />
        {/snippet}
      </Field>
      <Field label={t['platform.features.nameLabel']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={formName} required />
        {/snippet}
      </Field>
      <Field label={t['platform.features.kindLabel']()} required>
        {#snippet children({ id })}
          <Select
            {id}
            value={formKind}
            options={KIND_OPTIONS}
            disabled={Boolean(editing)}
            onchange={(event) => (formKind = event.currentTarget.value as 'boolean' | 'quota')}
          />
        {/snippet}
      </Field>
      <label class="sanvi-features__checkbox">
        <input type="checkbox" bind:checked={formDefaultEnabled} />
        <span>{t['platform.features.defaultEnabledLabel']()}</span>
      </label>
      {#if formKind === 'quota'}
        <Field label={t['platform.features.defaultLimitLabel']()}>
          {#snippet children({ id })}
            <Input {id} bind:value={formDefaultLimit} placeholder={t['platform.features.defaultLimitPlaceholder']()} />
          {/snippet}
        </Field>
        {#if formDefaultLimitInvalid}
          <Alert variant="error">{t['platform.features.defaultLimitInvalid']()}</Alert>
        {/if}
      {/if}
      <Field label={t['platform.features.visibilityLabel']()} required>
        {#snippet children({ id })}
          <Select
            {id}
            value={formVisibility}
            options={VISIBILITY_OPTIONS}
            onchange={(event) => (formVisibility = event.currentTarget.value as 'public' | 'hidden')}
          />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (formOpen = false)}>{t['platform.features.cancel']()}</Button>
    <Button
      disabled={!formKey.trim() || !formName.trim() || formDefaultLimitInvalid}
      loading={saving}
      onclick={handleSave}
    >
      {editing ? t['platform.features.save']() : t['platform.features.create']()}
    </Button>
  {/snippet}
</Dialog>

{#if deprecateTarget}
  <DangerousAction
    bind:open={deprecateOpen}
    titleText={t['platform.features.deprecateTitle']({ key: deprecateTarget.key })}
    consequence={t['platform.features.deprecateConsequence']()}
    variant="warning"
    submitting={deprecating}
    onConfirm={handleDeprecate}
  />
{/if}

<style>
  .sanvi-features__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-features__checkbox {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
  }
</style>
