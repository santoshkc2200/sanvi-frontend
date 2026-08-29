<script lang="ts">
import { getTenantThemeDraft } from '@sanvi/api-client'
import type { components, TokenValue } from '@sanvi/api-client'
import { currentLocale, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Container, Field, Select, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'
import { getDraft, initDraftStore, themeDraft, updateTokenOverride } from '../lib/theme/draft-store'
import ThemeShell from '../lib/theme/ThemeShell.svelte'

type ThemeDraft = components['schemas']['TenantThemeDraftView']

let loading = $state(true)
let error = $state<string | undefined>(undefined)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const res = await getTenantThemeDraft(apiClient)
    if (seq !== loadSeq) return
    initDraftStore(res)
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

const availableFonts = $derived($themeDraft?.spec?.fonts ?? [])

const fontOptions = $derived(
  availableFonts.map((f) => ({
    value: f.family,
    label: f.family,
  })),
)

function getFontValue(path: string): string {
  const override = $themeDraft?.theme.token_overrides?.[path]
  if (override && typeof override.$value === 'string') {
    return override.$value
  }
  return availableFonts[0]?.family ?? 'sans-serif'
}

function handleFontChange(path: string, family: string): void {
  const token: TokenValue = {
    $value: family,
    $type: 'fontFamily',
  }
  updateTokenOverride(path, token)
}

function fontSupportsJapanese(family: string): boolean {
  const fontSpec = availableFonts.find((f) => f.family === family)
  if (!fontSpec) return false
  return (
    fontSpec.subsets.includes('ja') ||
    fontSpec.subsets.includes('japanese') ||
    fontSpec.subsets.includes('JP')
  )
}

const baseFont = $derived(getFontValue('font.family.base'))
const headingFont = $derived(getFontValue('font.family.heading'))

const isJapanese = $derived(currentLocale() === 'ja')
const baseFontMissingJa = $derived(
  isJapanese && Boolean(baseFont) && !fontSupportsJapanese(baseFont),
)
const headingFontMissingJa = $derived(
  isJapanese && Boolean(headingFont) && !fontSupportsJapanese(headingFont),
)
</script>

<svelte:head>
  <title>{t['admin.theme.typography.title']()}</title>
</svelte:head>

<ThemeShell activeTab="typography">
  <Container size="md" padding="6">
    <Stack gap="6">
      <h2>{t['admin.theme.typography.title']()}</h2>
      <p class="sanvi-typography-desc">{t['admin.theme.typography.description']()}</p>

      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={t['admin.theme.gallery.loading']()} />
      {:else if $themeDraft}
        {#if baseFontMissingJa || headingFontMissingJa}
          <Alert variant="warning">
            {t['admin.theme.typography.japaneseWarning']()}
          </Alert>
        {/if}

        <Stack gap="6">
          <Field label={t['admin.theme.typography.baseFont']()}>
            {#snippet children({ id })}
              <Select
                {id}
                options={fontOptions}
                value={baseFont}
                onchange={(e) => handleFontChange('font.family.base', e.currentTarget.value)}
              />
            {/snippet}
          </Field>

          <Field label={t['admin.theme.typography.headingFont']()}>
            {#snippet children({ id })}
              <Select
                {id}
                options={fontOptions}
                value={headingFont}
                onchange={(e) => handleFontChange('font.family.heading', e.currentTarget.value)}
              />
            {/snippet}
          </Field>
        </Stack>
      {/if}
    </Stack>
  </Container>
</ThemeShell>

<style>
  .sanvi-typography-desc {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
  }
</style>
