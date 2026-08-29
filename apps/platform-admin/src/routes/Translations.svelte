<script lang="ts">
import { ApiError, getPlatformTranslations, updatePlatformTranslations } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, localeOptions, t } from '@sanvi/i18n'
import { enterUnlessComposing } from '@sanvi/ui'
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  showToast,
  Spinner,
  Stack,
  Table,
  Textarea,
} from '@sanvi/ui'
import type { SelectOption } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type TranslationRow = components['schemas']['TranslationView']

// The two shipped locales; labels are native self-names from the i18n
// registry (same convention as the LocaleSwitcher), so they read correctly
// to an operator regardless of the console's current locale.
const LOCALE_SELECT_OPTIONS: SelectOption[] = localeOptions().map((option) => ({
  value: option.code,
  label: option.label,
}))

let translations = $state<TranslationRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

// Sequencing token — a slow list response must never overwrite a fresher
// refetch triggered right after an upsert.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const result = await getPlatformTranslations(apiClient)
    if (seq !== loadSeq) return
    translations = result ?? []
  } catch {
    if (seq !== loadSeq) return
    error = t['platform.translations.loadError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void load()
})

// Scope → key → locale ordering via the locale-aware collator, so operators
// scanning for a key get the same predictable order in either language.
const rows = $derived(
  [...translations].sort(
    (a, b) =>
      fmt.collator().compare(a.scope, b.scope) ||
      fmt.collator().compare(a.key, b.key) ||
      fmt.collator().compare(a.locale, b.locale),
  ),
)

let formKey = $state('')
let formLocale = $state('en')
let formValue = $state('')
let saving = $state(false)

const formInvalid = $derived(formKey.trim() === '' || formValue.trim() === '')

async function handleUpsert(): Promise<void> {
  if (formInvalid) return
  saving = true
  try {
    await updatePlatformTranslations(apiClient, [
      { key: formKey.trim(), locale: formLocale, value: formValue },
    ])
    formKey = ''
    formValue = ''
    showToast({ variant: 'success', title: t['platform.translations.saved']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.translations.saveError'](),
      description: err instanceof ApiError ? err.detail : undefined,
    })
  } finally {
    saving = false
  }
}
</script>

{#snippet valueCell(row: TranslationRow)}
  <span class="sanvi-translations__value">{row.value}</span>
{/snippet}

{#snippet updatedCell(row: TranslationRow)}
  <span>{fmt.datetime(row.updated_at)}</span>
{/snippet}

<Stack gap="6">
  <div class="sanvi-translations__header">
    <div>
      <h1>{t['platform.translations.title']()}</h1>
      <p class="sanvi-translations__muted">{t['platform.translations.description']()}</p>
    </div>
  </div>

  {#if loading}
    <Spinner label={t['common.loading']()} />
  {:else if error}
    <Alert variant="error">{error}</Alert>
    <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
  {:else}
    <Table
      columns={[
        { key: 'scope', header: t['platform.translations.colScope']() },
        { key: 'key', header: t['platform.translations.colKey']() },
        { key: 'locale', header: t['platform.translations.colLocale']() },
        { key: 'value', header: t['platform.translations.colValue'](), cell: valueCell },
        { key: 'updated_at', header: t['platform.translations.colUpdated'](), cell: updatedCell },
      ]}
      {rows}
      getRowId={(row) => `${row.scope}:${row.key}:${row.locale}`}
      caption={t['platform.translations.tableCaption']()}
      emptyMessage={t['platform.translations.empty']()}
    />
  {/if}

  <Stack gap="4">
    <div>
      <h2>{t['platform.translations.formTitle']()}</h2>
      <p class="sanvi-translations__muted">{t['platform.translations.formIntro']()}</p>
    </div>

    <Stack gap="4">
      <!-- Raw input, not `Input`: the ui component doesn't forward keyboard
           events, and Enter must submit through `enterUnlessComposing` so a
           Japanese IME's composition Enter never fires the upsert. -->
      <Field label={t['platform.translations.keyLabel']()} required>
        {#snippet children({ id })}
          <input
            {id}
            class="sanvi-translations__input"
            type="text"
            bind:value={formKey}
            placeholder={t['platform.translations.keyPlaceholder']()}
            onkeydown={enterUnlessComposing(handleUpsert)}
            required
          />
        {/snippet}
      </Field>
      <Field label={t['platform.translations.localeLabel']()} required>
        {#snippet children({ id })}
          <Select {id} bind:value={formLocale} options={LOCALE_SELECT_OPTIONS} />
        {/snippet}
      </Field>
      <Field label={t['platform.translations.valueLabel']()} required>
        {#snippet children({ id })}
          <Textarea
            {id}
            bind:value={formValue}
            rows={3}
            placeholder={t['platform.translations.valuePlaceholder']()}
            required
          />
        {/snippet}
      </Field>
      <div>
        <Button disabled={formInvalid} loading={saving} onclick={handleUpsert}>
          {t['platform.translations.submit']()}
        </Button>
      </div>
    </Stack>
  </Stack>
</Stack>

<style>
  .sanvi-translations__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-translations__muted {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  /* Same treatment as @sanvi/ui's `Input` — raw element styled with the same
     tokens (see the IME note above for why it isn't the ui component). */
  .sanvi-translations__input {
    width: 100%;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-translations__value {
    overflow-wrap: anywhere;
  }
</style>
