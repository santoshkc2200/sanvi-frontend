<script lang="ts">
import { getTenantThemeDraft, uploadBrandAsset } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Button, Cluster, Container, Field, showToast, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'
import ThemeShell from '../lib/theme/ThemeShell.svelte'

type ThemeDraft = components['schemas']['TenantThemeDraftView']

let draft = $state<ThemeDraft | null>(null)
let loading = $state(true)
let error = $state<string | undefined>(undefined)
let uploadingKind = $state<string | null>(null)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const res = await getTenantThemeDraft(apiClient)
    if (seq !== loadSeq) return
    draft = res
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

const ASSET_KINDS: Array<{
  kind: 'logo' | 'favicon' | 'og_image'
  labelKey: 'admin.theme.brand.logo' | 'admin.theme.brand.favicon' | 'admin.theme.brand.ogImage'
  accept: string
}> = [
  {
    kind: 'logo',
    labelKey: 'admin.theme.brand.logo',
    accept: 'image/png,image/jpeg,image/svg+xml,image/webp',
  },
  {
    kind: 'favicon',
    labelKey: 'admin.theme.brand.favicon',
    accept: 'image/x-icon,image/png,image/svg+xml',
  },
  {
    kind: 'og_image',
    labelKey: 'admin.theme.brand.ogImage',
    accept: 'image/png,image/jpeg,image/webp',
  },
]

async function handleFileSelect(
  kind: 'logo' | 'favicon' | 'og_image',
  event: Event,
): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingKind = kind

  try {
    const base64 = await readFileAsBase64(file)
    const updated = await uploadBrandAsset(apiClient, {
      kind,
      data_base64: base64,
      content_type: file.type || 'image/png',
    })

    if (draft) {
      draft = {
        ...draft,
        theme: updated,
      }
    }
    showToast({ variant: 'success', title: t['admin.theme.brand.uploadSuccess']() })
  } catch {
    showToast({ variant: 'error', title: t['admin.theme.brand.uploadError']() })
  } finally {
    uploadingKind = null
    input.value = ''
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip data URL prefix (e.g. data:image/png;base64,)
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
</script>

<svelte:head>
  <title>{t['admin.theme.brand.title']()}</title>
</svelte:head>

<ThemeShell activeTab="brand">
  <Container size="md" padding="6">
    <Stack gap="6">
      <h2>{t['admin.theme.brand.title']()}</h2>
      <p class="sanvi-brand-desc">{t['admin.theme.brand.description']()}</p>

      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={t['admin.theme.gallery.loading']()} />
      {:else if draft}
        <Stack gap="6">
          {#each ASSET_KINDS as { kind, labelKey, accept } (kind)}
            {@const asset = draft.theme.assets?.[kind]}
            <div class="sanvi-asset-card">
              <Stack gap="3">
                <Cluster justify="space-between" align="center">
                  <h3 class="sanvi-asset-title">{t[labelKey]()}</h3>
                  {#if asset}
                    <span class="sanvi-asset-status">{asset.mime} ({asset.ext})</span>
                  {/if}
                </Cluster>

                <Field label={t[labelKey]()}>
                  {#snippet children({ id })}
                    <input
                      {id}
                      type="file"
                      {accept}
                      disabled={uploadingKind !== null}
                      onchange={(e) => void handleFileSelect(kind, e)}
                    />
                  {/snippet}
                </Field>
              </Stack>
            </div>
          {/each}
        </Stack>
      {/if}
    </Stack>
  </Container>
</ThemeShell>

<style>
  .sanvi-brand-desc {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
  }

  .sanvi-asset-card {
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    background: var(--color-background-primary);
  }

  .sanvi-asset-title {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
  }

  .sanvi-asset-status {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
</style>
