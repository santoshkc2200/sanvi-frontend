<script lang="ts">
import { getTenantThemeDraft } from '@sanvi/api-client'
import type { components, TokenValue } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Checkbox, Cluster, Container, Field, Input, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'
import { checkContrast } from '../lib/theme/contrast'
import type { ContrastViolation } from '../lib/theme/contrast'
import { getDraft, initDraftStore, themeDraft, updateTokenOverride } from '../lib/theme/draft-store'
import ThemeShell from '../lib/theme/ThemeShell.svelte'

type ThemeDraft = components['schemas']['TenantThemeDraftView']

let loading = $state(true)
let error = $state<string | undefined>(undefined)
let overrideAllowed = $state(false)

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

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function isValidHex(val: string): boolean {
  return HEX_REGEX.test(val.trim())
}

const COLOR_FIELDS: Array<{
  path: string
  labelKey: keyof typeof t
  defaultValue: string
}> = [
  {
    path: 'color.brand.primary',
    labelKey: 'admin.theme.colors.brandPrimary',
    defaultValue: '#2563eb',
  },
  { path: 'color.brand.hover', labelKey: 'admin.theme.colors.brandHover', defaultValue: '#1d4ed8' },
  {
    path: 'color.brand.contrast',
    labelKey: 'admin.theme.colors.brandContrast',
    defaultValue: '#ffffff',
  },
  {
    path: 'color.text.primary',
    labelKey: 'admin.theme.colors.textPrimary',
    defaultValue: '#1a1d23',
  },
  {
    path: 'color.text.secondary',
    labelKey: 'admin.theme.colors.textSecondary',
    defaultValue: '#4a505c',
  },
  {
    path: 'color.text.inverse',
    labelKey: 'admin.theme.colors.textInverse',
    defaultValue: '#ffffff',
  },
  {
    path: 'color.background.primary',
    labelKey: 'admin.theme.colors.backgroundPrimary',
    defaultValue: '#ffffff',
  },
  {
    path: 'color.background.inverse',
    labelKey: 'admin.theme.colors.backgroundInverse',
    defaultValue: '#1a1d23',
  },
  { path: 'color.focus.ring', labelKey: 'admin.theme.colors.focusRing', defaultValue: '#1d4ed8' },
]

function getColorValue(path: string, defaultValue: string): string {
  const override = $themeDraft?.theme.token_overrides?.[path]
  if (override && typeof override.$value === 'string') {
    return override.$value
  }
  return defaultValue
}

function handleColorChange(path: string, value: string): void {
  const token: TokenValue = {
    $value: value,
    $type: 'color',
  }
  updateTokenOverride(path, token)
}

const currentTokens = $derived.by(() => {
  const map: Record<string, string> = {}
  for (const field of COLOR_FIELDS) {
    map[field.path] = getColorValue(field.path, field.defaultValue)
  }
  return map
})

const violations = $derived<ContrastViolation[]>(checkContrast(currentTokens))
</script>

<svelte:head>
  <title>{t['admin.theme.colors.title']()}</title>
</svelte:head>

<ThemeShell activeTab="colors">
  <Container size="md" padding="6">
    <Stack gap="6">
      <h2>{t['admin.theme.colors.title']()}</h2>
      <p class="sanvi-colors-desc">{t['admin.theme.colors.description']()}</p>

      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={t['admin.theme.gallery.loading']()} />
      {:else if $themeDraft}
        <!-- Contrast Banner -->
        {#if violations.length > 0}
          <Alert variant="warning">
            <Stack gap="2">
              {#each violations as v}
                <p>
                  {t['admin.theme.colors.contrastWarning']({
                    ratio: v.ratio,
                    min: v.minimum,
                  })}
                  {t['admin.theme.colors.contrastPair']({
                    foreground: v.foreground,
                    background: v.background,
                  })}
                </p>
              {/each}
              <Checkbox
                checked={overrideAllowed}
                onchange={(e) => {
                  overrideAllowed = e.currentTarget.checked
                }}
              >
                {t['admin.theme.colors.overrideCheckbox']()}
              </Checkbox>
            </Stack>
          </Alert>
        {:else}
          <Alert variant="success">
            {t['admin.theme.colors.contrastPass']({
              ratio: 4.5,
            })}
          </Alert>
        {/if}

        <Stack gap="4">
          {#each COLOR_FIELDS as field (field.path)}
            {@const value = getColorValue(field.path, field.defaultValue)}
            {@const label = t[field.labelKey]()}
            <Field {label}>
              {#snippet children({ id })}
                <Cluster gap="3" align="center">
                  <input
                    type="color"
                    aria-label={t['admin.theme.colors.pickerAriaLabel']({ label })}
                    {value}
                    onchange={(e) => handleColorChange(field.path, (e.target as HTMLInputElement).value)}
                  />
                  <Input
                    {id}
                    {value}
                    oninput={(e) => {
                      const val = e.currentTarget.value
                      if (isValidHex(val)) {
                        handleColorChange(field.path, val)
                      }
                    }}
                  />
                </Cluster>
              {/snippet}
            </Field>
          {/each}
        </Stack>
      {/if}
    </Stack>
  </Container>
</ThemeShell>

<style>
  .sanvi-colors-desc {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    color: var(--sanvi-color-text-secondary);
  }
</style>
