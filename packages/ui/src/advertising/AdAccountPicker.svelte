<script lang="ts">
import Alert from '../Alert.svelte'
import Button from '../Button.svelte'
import Field from '../Field.svelte'
import Input from '../Input.svelte'
import Radio from '../Radio.svelte'
import Stack from '../layout/Stack.svelte'

/**
 * The advertising account picker (phase 10, TASK-011) — the step between
 * the OAuth round-trip and a live connection. Searchable, one radio per ad
 * account the platform credentials can see, showing the account's name and
 * external id.
 *
 * The chosen account's **currency** (ISO-4217 alpha-3) and **timezone**
 * (IANA name) are declared here, at selection time: the platform reports
 * every number in that currency and that "today", so the values are
 * demanded explicitly — with the timezone's consequence stated right where
 * the choice happens — instead of defaulted and mis-read later on the
 * dashboard. Validation mirrors the backend's (`finalize`): three ASCII
 * letters, non-empty timezone.
 *
 * The accounts arrive from the OAuth callback's `PendingConnectionView` —
 * a cross-platform identity list (`external_id` + `display_name`), so
 * currency and timezone are declarations, not fields the platform handed
 * us. Labels come in as data, per this package's no-i18n rule.
 */
export interface AdAccountOption {
  external_id: string
  display_name: string
}

export interface AdPickerLabels {
  searchLabel: string
  searchPlaceholder: string
  accountsGroupLabel: string
  /** Announced when the search matches nothing. */
  noMatches: string
  currencyLabel: string
  currencyHint: string
  currencyPlaceholder: string
  timezoneLabel: string
  timezoneHint: string
  timezonePlaceholder: string
  timezoneConsequence: string
  confirmLabel: string
  cancelLabel: string
}

interface Props {
  accounts: AdAccountOption[]
  labels: AdPickerLabels
  submitting?: boolean
  errorMessage?: string
  onConfirm: (choice: {
    externalAccountId: string
    displayName: string
    currency: string
    timezone: string
  }) => void
  onCancel?: () => void
  class?: string
}

let {
  accounts,
  labels,
  submitting = false,
  errorMessage,
  onConfirm,
  onCancel,
  class: className = '',
}: Props = $props()

let search = $state('')
let selectedId = $state('')
let currency = $state('')
let timezone = $state('')
let currencyTouched = $state(false)

const selected = $derived(accounts.find((account) => account.external_id === selectedId))
const matches = $derived.by(() => {
  const query = search.trim().toLowerCase()
  if (!query) return accounts
  return accounts.filter(
    (account) =>
      account.display_name.toLowerCase().includes(query) ||
      account.external_id.toLowerCase().includes(query),
  )
})

const currencyValid = $derived(/^[A-Za-z]{3}$/.test(currency.trim()))
const timezoneValid = $derived(timezone.trim().length > 0)
const canConfirm = $derived(selected !== undefined && currencyValid && timezoneValid && !submitting)

function handleConfirm(): void {
  if (!canConfirm || !selected) return
  onConfirm({
    externalAccountId: selected.external_id,
    displayName: selected.display_name,
    currency: currency.trim().toUpperCase(),
    timezone: timezone.trim(),
  })
}

function handleCancel(): void {
  onCancel?.()
}
</script>

<Stack gap="4" class={className}>
  {#if errorMessage}
    <Alert variant="error">{errorMessage}</Alert>
  {/if}

  <Field label={labels.searchLabel}>
    {#snippet children({ id })}
      <Input
        {id}
        type="search"
        bind:value={search}
        placeholder={labels.searchPlaceholder}
        autocomplete="off"
      />
    {/snippet}
  </Field>

  <!-- A radio group, not a listbox: the choice is a single visible,
       keyboard-native selection the confirm button below acts on. -->
  <fieldset class="sanvi-ad-picker__accounts">
    <legend>{labels.accountsGroupLabel}</legend>
    <Stack gap="2">
      {#if matches.length === 0}
        <p class="sanvi-ad-picker__empty" role="status">{labels.noMatches}</p>
      {:else}
        {#each matches as account (account.external_id)}
          <Radio
            name="sanvi-ad-picker__account"
            value={account.external_id}
            bind:group={selectedId}
            disabled={submitting}
          >
            <span class="sanvi-ad-picker__account-name">{account.display_name}</span>
            <span class="sanvi-ad-picker__account-id">{account.external_id}</span>
          </Radio>
        {/each}
      {/if}
    </Stack>
  </fieldset>

  {#if selected}
    <Stack gap="3">
      <p class="sanvi-ad-picker__chosen" role="status">
        {selected.display_name}
        <span class="sanvi-ad-picker__account-id">{selected.external_id}</span>
      </p>
      <Field label="{labels.currencyLabel} ({selected.display_name})" required>
        {#snippet children({ id })}
          <Input
            {id}
            bind:value={currency}
            oninput={() => (currencyTouched = true)}
            onblur={() => {
              currency = currency.trim().toUpperCase()
            }}
            placeholder={labels.currencyPlaceholder}
            inputmode="text"
            autocomplete="off"
            invalid={currencyTouched && currency.trim() !== '' && !currencyValid}
            describedBy="sanvi-ad-picker__currency-hint"
            disabled={submitting}
          />
          <p id="sanvi-ad-picker__currency-hint" class="sanvi-ad-picker__hint">
            {labels.currencyHint}
          </p>
        {/snippet}
      </Field>
      <Field label="{labels.timezoneLabel} ({selected.display_name})" required>
        {#snippet children({ id })}
          <Input
            {id}
            bind:value={timezone}
            placeholder={labels.timezonePlaceholder}
            autocomplete="off"
            describedBy="sanvi-ad-picker__timezone-hint"
            disabled={submitting}
          />
          <p id="sanvi-ad-picker__timezone-hint" class="sanvi-ad-picker__hint">
            {labels.timezoneHint}
          </p>
        {/snippet}
      </Field>
      <Alert variant="info">{labels.timezoneConsequence}</Alert>
    </Stack>
  {/if}

  <div class="sanvi-ad-picker__actions">
    <Button variant="ghost" onclick={handleCancel} disabled={submitting}>
      {labels.cancelLabel}
    </Button>
    <Button variant="primary" disabled={!canConfirm} loading={submitting} onclick={handleConfirm}>
      {labels.confirmLabel}
    </Button>
  </div>
</Stack>

<style>
  .sanvi-ad-picker__accounts {
    margin: 0;
    padding: 0;
    border: none;
    max-block-size: var(--sanvi-spacing-32);
    overflow-block: auto;
  }

  .sanvi-ad-picker__accounts legend {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
    padding: 0;
    margin-block-end: var(--sanvi-spacing-2);
  }

  .sanvi-ad-picker__account-name {
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-ad-picker__account-id {
    display: block;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-picker__chosen {
    margin: 0;
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-picker__hint {
    margin: var(--sanvi-spacing-1) 0 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-picker__empty {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-picker__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sanvi-spacing-3);
  }
</style>
