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
import { apiClient } from '../lib/api'

type FeatureRow = components['schemas']['FeatureView']

const COPY = {
  title: 'Feature catalog',
  description:
    'Every optional capability the platform can gate — commercial defaults, not rollout flags.',
  keyHeader: 'Key',
  nameHeader: 'Name',
  kindHeader: 'Kind',
  defaultEnabledHeader: 'Default',
  defaultLimitHeader: 'Default limit',
  visibilityHeader: 'Visibility',
  deprecatedHeader: 'Deprecated',
  emptyMessage: 'No features defined yet.',
  errorMessage: 'Could not load the feature catalog.',
  retry: 'Try again',
  newFeature: 'Define feature',
  edit: 'Edit',
  deprecate: 'Deprecate',
  createTitle: 'Define a feature',
  editTitle: (name: string) => `Edit ${name}`,
  keyLabel: 'Key',
  keyPlaceholder: 'advertising.google_ads',
  keyHint: 'Convention: <context>.<capability>. Cannot be changed after creation.',
  nameLabel: 'Name',
  kindLabel: 'Kind',
  defaultEnabledLabel: 'Enabled by default',
  defaultLimitLabel: 'Default limit',
  defaultLimitPlaceholder: '100',
  defaultLimitInvalid: 'The default limit must be a non-negative whole number.',
  visibilityLabel: 'Visibility',
  cancel: 'Cancel',
  save: 'Save',
  create: 'Define',
  deprecateTitle: (key: string) => `Deprecate ${key}`,
  deprecateConsequence:
    'Existing entitlement grants for this feature keep working, but it drops out of catalogs and pickers for new grants. This cannot be undone from here.',
  saved: (name: string) => `${name} saved.`,
  deprecated: (key: string) => `${key} deprecated.`,
  saveError: 'Could not save this feature.',
  deprecateError: 'Could not deprecate this feature.',
  enabledYes: 'Enabled',
  enabledNo: 'Disabled',
  publicLabel: 'Public',
  hiddenLabel: 'Hidden',
}

const KIND_OPTIONS = [
  { value: 'boolean', label: 'Boolean' },
  { value: 'quota', label: 'Quota' },
]

const VISIBILITY_OPTIONS = [
  { value: 'public', label: COPY.publicLabel },
  { value: 'hidden', label: COPY.hiddenLabel },
]

let features = $state<FeatureRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

async function load(): Promise<void> {
  loading = true
  error = undefined
  try {
    features = await listFeatures(apiClient)
  } catch {
    error = COPY.errorMessage
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
    showToast({ variant: 'success', title: COPY.saved(formName) })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.saveError,
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
    showToast({ variant: 'success', title: COPY.deprecated(deprecateTarget.key) })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.deprecateError,
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
    {row.default_enabled ? COPY.enabledYes : COPY.enabledNo}
  </Badge>
{/snippet}

{#snippet visibilityCell(row: FeatureRow)}
  <Badge variant={row.visibility === 'public' ? 'info' : 'neutral'}>
    {row.visibility === 'public' ? COPY.publicLabel : COPY.hiddenLabel}
  </Badge>
{/snippet}

{#snippet actionsCell(row: FeatureRow)}
  <Stack gap="2" align="end">
    <Button variant="ghost" size="sm" onclick={() => openEdit(row)}>{COPY.edit}</Button>
    {#if !row.deprecated_at}
      <Button variant="ghost" size="sm" onclick={() => openDeprecate(row)}>{COPY.deprecate}</Button>
    {/if}
  </Stack>
{/snippet}

<Stack gap="4">
  <div class="sanvi-features__header">
    <div>
      <h1>{COPY.title}</h1>
      <p>{COPY.description}</p>
    </div>
    <Button onclick={openCreate}>{COPY.newFeature}</Button>
  </div>

  <DataTable
    columns={[
      { key: 'key', header: COPY.keyHeader, alwaysVisible: true },
      { key: 'name', header: COPY.nameHeader, alwaysVisible: true },
      { key: 'kind', header: COPY.kindHeader, cell: kindCell },
      { key: 'default_enabled', header: COPY.defaultEnabledHeader, cell: defaultEnabledCell },
      { key: 'default_limit', header: COPY.defaultLimitHeader, align: 'end' },
      { key: 'visibility', header: COPY.visibilityHeader, cell: visibilityCell },
      { key: 'deprecated_at', header: COPY.deprecatedHeader },
      { key: 'actions', header: '', align: 'end', cell: actionsCell, alwaysVisible: true },
    ]}
    rows={features}
    getRowId={(row) => row.key}
    {loading}
    {error}
    onRetry={load}
    retryLabel={COPY.retry}
    emptyMessage={COPY.emptyMessage}
    columnVisibilityStorageKey="platform-admin.features.columns"
  />
</Stack>

<Dialog bind:open={formOpen} titleText={editing ? COPY.editTitle(editing.name) : COPY.createTitle}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={COPY.keyLabel} hint={editing ? undefined : COPY.keyHint} required>
        {#snippet children({ id })}
          <Input {id} bind:value={formKey} placeholder={COPY.keyPlaceholder} disabled={Boolean(editing)} required />
        {/snippet}
      </Field>
      <Field label={COPY.nameLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={formName} required />
        {/snippet}
      </Field>
      <Field label={COPY.kindLabel} required>
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
        <span>{COPY.defaultEnabledLabel}</span>
      </label>
      {#if formKind === 'quota'}
        <Field label={COPY.defaultLimitLabel}>
          {#snippet children({ id })}
            <Input {id} bind:value={formDefaultLimit} placeholder={COPY.defaultLimitPlaceholder} />
          {/snippet}
        </Field>
        {#if formDefaultLimitInvalid}
          <Alert variant="error">{COPY.defaultLimitInvalid}</Alert>
        {/if}
      {/if}
      <Field label={COPY.visibilityLabel} required>
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
    <Button variant="ghost" onclick={() => (formOpen = false)}>{COPY.cancel}</Button>
    <Button
      disabled={!formKey.trim() || !formName.trim() || formDefaultLimitInvalid}
      loading={saving}
      onclick={handleSave}
    >
      {editing ? COPY.save : COPY.create}
    </Button>
  {/snippet}
</Dialog>

{#if deprecateTarget}
  <DangerousAction
    bind:open={deprecateOpen}
    titleText={COPY.deprecateTitle(deprecateTarget.key)}
    consequence={COPY.deprecateConsequence}
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
