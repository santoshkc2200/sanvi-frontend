<script lang="ts">
import { Can } from '@sanvi/auth'
import { getTenantContext, getTenantSettings, updateTenantSettings } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Button, Container, Field, Select, showToast, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'

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

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const [tenantResult, settingsResult] = await Promise.all([
      getTenantContext(apiClient),
      getTenantSettings(apiClient),
    ])
    if (seq !== loadSeq) return
    tenant = tenantResult
    const storedTimezone = settingsResult.settings['timezone']
    timezone = typeof storedTimezone === 'string' && storedTimezone ? storedTimezone : 'UTC'
  } catch {
    if (seq !== loadSeq) return
    error = t['admin.settings.genericError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void load()
})

async function handleSave(): Promise<void> {
  saving = true
  try {
    await updateTenantSettings(apiClient, { timezone })
    showToast({ variant: 'success', title: t['admin.settings.saved']() })
  } catch {
    showToast({ variant: 'error', title: t['admin.settings.genericError']() })
  } finally {
    saving = false
  }
}
</script>

<Container size="sm" padding="6">
  <Stack gap="6">
    <h1>{t['admin.settings.title']()}</h1>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.settings.loading']()} />
    {:else if tenant}
      {@const tenantView = tenant}
      <div>
        <h2>{t['admin.settings.identityTitle']()}</h2>
        <Stack gap="3">
          <Field label={t['admin.settings.nameLabel']()}>
            {#snippet children({ id })}
              <p id={id}>{tenantView.display_name}</p>
            {/snippet}
          </Field>
          <Field label={t['admin.settings.slugLabel']()}>
            {#snippet children({ id })}
              <p id={id}>{tenantView.slug}</p>
            {/snippet}
          </Field>
          <Field label={t['admin.settings.regionLabel']()}>
            {#snippet children({ id })}
              <p id={id}>{tenantView.region}</p>
            {/snippet}
          </Field>
          <Field label={t['admin.settings.localeLabel']()} hint={t['admin.settings.localeHint']()}>
            {#snippet children({ id })}
              <p id={id}>{tenantView.default_locale}</p>
            {/snippet}
          </Field>
        </Stack>
      </div>

      <Can tenantId={getActiveTenantId()} permission="tenancy.settings.update">
        {#snippet children()}
          <div>
            <h2>{t['admin.settings.timezoneLabel']()}</h2>
            <Stack gap="3">
              <Field label={t['admin.settings.timezoneLabel']()}>
                {#snippet children({ id })}
                  <Select {id} bind:value={timezone} options={TIMEZONE_OPTIONS} />
                {/snippet}
              </Field>
              <Button loading={saving} onclick={handleSave}>{t['admin.settings.save']()}</Button>
            </Stack>
          </div>
        {/snippet}
      </Can>

      <p class="sanvi-settings__branding-note">{t['admin.settings.brandingNote']()}</p>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-settings__branding-note {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }
</style>
