<script lang="ts">
import { Can } from '@sanvi/auth'
import { getTenantContext, getTenantSettings, updateTenantSettings } from '@sanvi/api-client'
import { Alert, Button, Container, Field, Select, showToast, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'

const COPY = {
  title: 'Settings',
  identityTitle: 'Tenant',
  nameLabel: 'Name',
  slugLabel: 'Slug',
  regionLabel: 'Region',
  localeLabel: 'Default locale',
  localeHint: 'Changing your default locale is coming in a future release.',
  brandingNote: 'Branding — coming in a future release.',
  timezoneLabel: 'Timezone',
  save: 'Save',
  saved: 'Settings saved.',
  loading: 'Loading',
  genericError: 'Something went wrong. Try again in a moment.',
}

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New York' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
]

let tenant = $state<Awaited<ReturnType<typeof getTenantContext>> | undefined>(undefined)
let timezone = $state('UTC')
let loading = $state(true)
let error = $state<string | undefined>(undefined)
let saving = $state(false)

async function load(): Promise<void> {
  loading = true
  error = undefined
  try {
    const [tenantResult, settingsResult] = await Promise.all([
      getTenantContext(apiClient),
      getTenantSettings(apiClient),
    ])
    tenant = tenantResult
    const storedTimezone = settingsResult.settings['timezone']
    timezone = typeof storedTimezone === 'string' && storedTimezone ? storedTimezone : 'UTC'
  } catch {
    error = COPY.genericError
  } finally {
    loading = false
  }
}

$effect(() => {
  void load()
})

async function handleSave(): Promise<void> {
  saving = true
  try {
    await updateTenantSettings(apiClient, { timezone })
    showToast({ variant: 'success', title: COPY.saved })
  } catch {
    showToast({ variant: 'error', title: COPY.genericError })
  } finally {
    saving = false
  }
}
</script>

<Container size="sm" padding="6">
  <Stack gap="6">
    <h1>{COPY.title}</h1>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={COPY.loading} />
    {:else if tenant}
      {@const t = tenant}
      <div>
        <h2>{COPY.identityTitle}</h2>
        <Stack gap="3">
          <Field label={COPY.nameLabel}>
            {#snippet children({ id })}
              <p id={id}>{t.display_name}</p>
            {/snippet}
          </Field>
          <Field label={COPY.slugLabel}>
            {#snippet children({ id })}
              <p id={id}>{t.slug}</p>
            {/snippet}
          </Field>
          <Field label={COPY.regionLabel}>
            {#snippet children({ id })}
              <p id={id}>{t.region}</p>
            {/snippet}
          </Field>
          <Field label={COPY.localeLabel} hint={COPY.localeHint}>
            {#snippet children({ id })}
              <p id={id}>{t.default_locale}</p>
            {/snippet}
          </Field>
        </Stack>
      </div>

      <Can permission="tenancy.settings.update">
        {#snippet children()}
          <div>
            <h2>{COPY.timezoneLabel}</h2>
            <Stack gap="3">
              <Field label={COPY.timezoneLabel}>
                {#snippet children({ id })}
                  <Select {id} bind:value={timezone} options={TIMEZONE_OPTIONS} />
                {/snippet}
              </Field>
              <Button loading={saving} onclick={handleSave}>{COPY.save}</Button>
            </Stack>
          </div>
        {/snippet}
      </Can>

      <p class="sanvi-settings__branding-note">{COPY.brandingNote}</p>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-settings__branding-note {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }
</style>
