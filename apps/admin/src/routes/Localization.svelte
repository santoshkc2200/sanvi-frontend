<script lang="ts">
import {
  getLocalizationOverrides,
  getLocalizationSettings,
  updateLocalizationOverrides,
  updateLocalizationSettings,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, localeOptions, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Button,
  Checkbox,
  Container,
  EmptyState,
  Field,
  Input,
  Select,
  showToast,
  Spinner,
  Stack,
  Table,
  Textarea,
  enterUnlessComposing,
} from '@sanvi/ui'
import type { SelectOption } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type LocalizationSettings = components['schemas']['LocalizationSettingsView']
type OverrideRow = components['schemas']['TranslationView']

// The candidate locale set is the frontend's own configured locales (the same
// list the LocaleSwitcher offers) — a tenant enables among what the console
// can actually render today.
const LOCALE_CHOICES: SelectOption[] = localeOptions().map((option) => ({
  value: option.code,
  label: option.label,
}))

/** Native name for a known locale, the raw code as fallback for unknown ones. */
function localeLabel(code: string): string {
  return LOCALE_CHOICES.find((choice) => choice.value === code)?.label ?? code
}

let loading = $state(true)
let error = $state<string | undefined>(undefined)

let defaultLocale = $state('en')
let enabledLocales = $state<string[]>([])
let timezone = $state('UTC')
let savingSettings = $state(false)
let settingsValidationError = $state<string | undefined>(undefined)

let overrides = $state<OverrideRow[]>([])
let overridesLoading = $state(true)
let overridesError = $state<string | undefined>(undefined)

let overrideKey = $state('')
let overrideLocale = $state(localeOptions()[0]!.code)
let overrideValue = $state('')
let savingOverride = $state(false)

// Sequencing tokens — a tenant switch re-runs the load effects, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let settingsSeq = 0
let overridesSeq = 0

async function loadSettings(): Promise<void> {
  const seq = ++settingsSeq
  loading = true
  error = undefined
  settingsValidationError = undefined
  try {
    const settings: LocalizationSettings = await getLocalizationSettings(apiClient)
    if (seq !== settingsSeq) return
    defaultLocale = settings.default_locale
    enabledLocales = [...settings.enabled_locales]
    timezone = settings.timezone
  } catch {
    if (seq !== settingsSeq) return
    error = t['admin.localization.genericError']()
  } finally {
    if (seq === settingsSeq) loading = false
  }
}

async function loadOverrides(): Promise<void> {
  const seq = ++overridesSeq
  overridesLoading = true
  overridesError = undefined
  try {
    const rows = (await getLocalizationOverrides(apiClient)) ?? []
    if (seq !== overridesSeq) return
    // Key-then-locale order reads as a dictionary; locale-aware, not byte order.
    const collator = fmt.collator()
    overrides = [...rows].sort(
      (a, b) => collator.compare(a.key, b.key) || collator.compare(a.locale, b.locale),
    )
  } catch {
    if (seq !== overridesSeq) return
    overridesError = t['admin.localization.overridesLoadError']()
  } finally {
    if (seq === overridesSeq) overridesLoading = false
  }
}

$effect(() => {
  // Reading the active tenant makes the effects re-run (and refetch) on switch.
  void getActiveTenantId()
  void loadSettings()
  void loadOverrides()
})

function toggleLocale(code: string, checked: boolean): void {
  enabledLocales = checked
    ? [...enabledLocales, code]
    : enabledLocales.filter((enabled) => enabled !== code)
}

// The default locale Select can only ever offer enabled locales, so a stale
// default is a checkbox-driven state — validated here, at save time.
const defaultLocaleOptions = $derived(
  enabledLocales.map((code) => ({ value: code, label: localeLabel(code) })),
)

async function handleSaveSettings(): Promise<void> {
  if (!enabledLocales.includes(defaultLocale)) {
    settingsValidationError = t['admin.localization.defaultMustBeEnabled']()
    return
  }
  savingSettings = true
  settingsValidationError = undefined
  try {
    await updateLocalizationSettings(apiClient, {
      default_locale: defaultLocale,
      enabled_locales: [...enabledLocales],
      timezone,
    })
    showToast({ variant: 'success', title: t['admin.localization.settingsSaved']() })
    await loadSettings()
  } catch {
    showToast({ variant: 'error', title: t['admin.localization.settingsSaveError']() })
  } finally {
    savingSettings = false
  }
}

async function handleAddOverride(): Promise<void> {
  const key = overrideKey.trim()
  const value = overrideValue
  if (!key || !value.trim()) return
  savingOverride = true
  try {
    await updateLocalizationOverrides(apiClient, [{ key, locale: overrideLocale, value }])
    showToast({ variant: 'success', title: t['admin.localization.overrideSaved']() })
    overrideKey = ''
    overrideValue = ''
    await loadOverrides()
  } catch {
    showToast({ variant: 'error', title: t['admin.localization.overrideSaveError']() })
  } finally {
    savingOverride = false
  }
}
</script>

{#snippet overrideUpdatedCell(row: OverrideRow)}
  <span>{fmt.datetime(row.updated_at)}</span>
{/snippet}

<Container size="lg" padding="6">
  <Stack gap="8">
    <div>
      <h1>{t['admin.localization.title']()}</h1>
      <p>{t['admin.localization.description']()}</p>
    </div>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.localization.loading']()} />
    {:else}
      <section>
        <h2>{t['admin.localization.settingsTitle']()}</h2>
        <Stack gap="3">
          {#if settingsValidationError}
            <Alert variant="error">{settingsValidationError}</Alert>
          {/if}
          <Field label={t['admin.localization.defaultLocaleLabel']()} required>
            {#snippet children({ id })}
              <Select
                {id}
                bind:value={defaultLocale}
                options={defaultLocaleOptions}
                required
              />
            {/snippet}
          </Field>
          <fieldset>
            <legend>{t['admin.localization.enabledLocalesLabel']()}</legend>
            {#each LOCALE_CHOICES as choice (choice.value)}
              <Checkbox
                checked={enabledLocales.includes(choice.value)}
                onchange={(event) => toggleLocale(choice.value, event.currentTarget.checked)}
              >
                {choice.label}
              </Checkbox>
            {/each}
          </fieldset>
          <Field label={t['admin.localization.timezoneLabel']()} hint={t['admin.localization.timezoneHint']()} required>
            {#snippet children({ id })}
              <Input {id} type="text" bind:value={timezone} required />
            {/snippet}
          </Field>
          <div>
            <Button
              loading={savingSettings}
              disabled={enabledLocales.length === 0 || timezone.trim() === ''}
              onclick={handleSaveSettings}
            >
              {t['admin.localization.saveSettings']()}
            </Button>
          </div>
        </Stack>
      </section>

      <section>
        <h2>{t['admin.localization.overridesTitle']()}</h2>
        <p class="sanvi-localization__muted">{t['admin.localization.overridesIntro']()}</p>
        <Stack gap="4">
          {#if overridesError}
            <Alert variant="error">{overridesError}</Alert>
          {/if}

          {#if overridesLoading}
            <Spinner label={t['admin.localization.loading']()} />
          {:else if overrides.length === 0}
            <EmptyState title={t['admin.localization.noOverrides']()} />
          {:else}
            <Table
              caption={t['admin.localization.tableCaption']()}
              rows={overrides}
              getRowId={(row) => `${row.key}:${row.locale}`}
              columns={[
                { key: 'key', header: t['admin.localization.keyCol']() },
                { key: 'locale', header: t['admin.localization.localeCol']() },
                { key: 'value', header: t['admin.localization.valueCol']() },
                {
                  key: 'updated_at',
                  header: t['admin.localization.updatedCol'](),
                  cell: overrideUpdatedCell,
                },
              ]}
            />
          {/if}

          <Stack gap="3" align="start">
            <!-- Enter in the key field applies the override — gated so IME
                 composition Enter (変換) doesn't submit half-typed keys. -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="sanvi-localization__enter-scope" onkeydown={enterUnlessComposing(() => void handleAddOverride())}>
              <Field label={t['admin.localization.overrideKeyLabel']()} required>
                {#snippet children({ id })}
                  <Input {id} type="text" bind:value={overrideKey} required />
                {/snippet}
              </Field>
            </div>
            <Field label={t['admin.localization.overrideLocaleLabel']()} required>
              {#snippet children({ id })}
                <Select {id} bind:value={overrideLocale} options={LOCALE_CHOICES} required />
              {/snippet}
            </Field>
            <Field label={t['admin.localization.overrideValueLabel']()} required>
              {#snippet children({ id })}
                <Textarea
                  {id}
                  bind:value={overrideValue}
                  rows={3}
                  placeholder={t['admin.localization.overrideValuePlaceholder']()}
                  required
                />
              {/snippet}
            </Field>
            <Button
              loading={savingOverride}
              disabled={!overrideKey.trim() || !overrideValue.trim()}
              onclick={() => void handleAddOverride()}
            >
              {t['admin.localization.addOverride']()}
            </Button>
          </Stack>
        </Stack>
      </section>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-localization__muted {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-localization__enter-scope {
    width: 100%;
  }
</style>
