<script lang="ts">
import { getTenantThemeDraft } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { currentLocale, localeOptions, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Badge, Button, Cluster, Container, Field, Select, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'
import ThemeShell from '../lib/theme/ThemeShell.svelte'

type ThemeDraft = components['schemas']['TenantThemeDraftView']

let draft = $state<ThemeDraft | null>(null)
let loading = $state(true)
let error = $state<string | undefined>(undefined)

let deviceMode = $state<'desktop' | 'mobile' | 'side-by-side'>('side-by-side')
let themeMode = $state<'light' | 'dark'>('light')
let selectedLocale = $state<string>(currentLocale() ?? 'en')

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

const previewToken = $derived(
  draft?.theme?.theme_key
    ? `draft-${draft.theme.theme_key}-${draft.theme.revision}`
    : 'draft-preview',
)

// Storefront origin (defaulting to port 4174 preview server)
const storefrontOrigin = 'http://localhost:4174'

const previewUrl = $derived(
  `${storefrontOrigin}/_theme-preview?token=${encodeURIComponent(previewToken)}&locale=${encodeURIComponent(selectedLocale)}&mode=${encodeURIComponent(themeMode)}`,
)

const localeSelectOptions = $derived(
  localeOptions().map((opt) => ({
    value: opt.code,
    label: opt.label,
  })),
)
</script>

<svelte:head>
  <title>{t['admin.theme.preview.title']()}</title>
</svelte:head>

<ThemeShell activeTab="preview">
  <Container size="xl" padding="6">
    <Stack gap="6">
      <Cluster justify="space-between" align="center">
        <div>
          <h2>{t['admin.theme.preview.title']()}</h2>
          <p class="sanvi-preview-desc">{t['admin.theme.preview.description']()}</p>
        </div>
        {#if draft}
          <Badge variant="info">
            {t['admin.theme.preview.tokenNotice']()}
          </Badge>
        {/if}
      </Cluster>

      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={t['admin.theme.gallery.loading']()} />
      {:else}
        <!-- Controls Toolbar -->
        <div class="sanvi-preview-toolbar">
          <Cluster justify="space-between" align="center" gap="4">
            <Cluster gap="3" align="center">
              <Cluster gap="1" align="center">
                <Button
                  variant={deviceMode === 'desktop' ? 'primary' : 'secondary'}
                  onclick={() => {
                    deviceMode = 'desktop'
                  }}
                >
                  {t['admin.theme.preview.desktop']()}
                </Button>
                <Button
                  variant={deviceMode === 'mobile' ? 'primary' : 'secondary'}
                  onclick={() => {
                    deviceMode = 'mobile'
                  }}
                >
                  {t['admin.theme.preview.mobile']()}
                </Button>
                <Button
                  variant={deviceMode === 'side-by-side' ? 'primary' : 'secondary'}
                  onclick={() => {
                    deviceMode = 'side-by-side'
                  }}
                >
                  {t['admin.theme.preview.sideBySide']()}
                </Button>
              </Cluster>

              <Cluster gap="1" align="center">
                <Button
                  variant={themeMode === 'light' ? 'primary' : 'secondary'}
                  onclick={() => {
                    themeMode = 'light'
                  }}
                >
                  {t['admin.theme.preview.light']()}
                </Button>
                <Button
                  variant={themeMode === 'dark' ? 'primary' : 'secondary'}
                  onclick={() => {
                    themeMode = 'dark'
                  }}
                >
                  {t['admin.theme.preview.dark']()}
                </Button>
              </Cluster>
            </Cluster>

            <div class="sanvi-preview-locale">
              <Field label={t['admin.theme.preview.locale']()} htmlFor="preview-locale-select">
                <Select
                  id="preview-locale-select"
                  options={localeSelectOptions}
                  value={selectedLocale}
                  onchange={(e) => {
                    selectedLocale = (e.target as HTMLSelectElement).value
                  }}
                />
              </Field>
            </div>
          </Cluster>
        </div>

        <!-- Frame Container -->
        <div class="sanvi-preview-frames sanvi-preview-frames--{deviceMode}">
          {#if deviceMode === 'desktop' || deviceMode === 'side-by-side'}
            <div class="sanvi-device-frame sanvi-device-frame--desktop">
              <div class="sanvi-device-frame__header">
                <div class="sanvi-device-frame__dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div class="sanvi-device-frame__address">
                  {previewUrl}
                </div>
              </div>
              <iframe
                title={t['admin.theme.preview.desktopFrame']()}
                src={previewUrl}
                class="sanvi-device-frame__iframe sanvi-device-frame__iframe--desktop"
              ></iframe>
            </div>
          {/if}

          {#if deviceMode === 'mobile' || deviceMode === 'side-by-side'}
            <div class="sanvi-device-frame sanvi-device-frame--mobile">
              <div class="sanvi-device-frame__notch"></div>
              <iframe
                title={t['admin.theme.preview.mobileFrame']()}
                src={previewUrl}
                class="sanvi-device-frame__iframe sanvi-device-frame__iframe--mobile"
              ></iframe>
            </div>
          {/if}
        </div>
      {/if}
    </Stack>
  </Container>
</ThemeShell>

<style>
  .sanvi-preview-desc {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-preview-toolbar {
    padding: var(--sanvi-spacing-4);
    background: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
  }

  .sanvi-preview-locale {
    min-width: 160px; /* sanvi-tokens-ignore */
  }

  .sanvi-preview-frames {
    display: flex;
    gap: var(--sanvi-spacing-6);
    justify-content: center;
    align-items: flex-start;
    overflow-x: auto;
    padding-bottom: var(--sanvi-spacing-6);
  }

  .sanvi-preview-frames--desktop .sanvi-device-frame--desktop {
    width: 100%;
    max-width: 1200px; /* sanvi-tokens-ignore */
  }

  .sanvi-device-frame {
    display: flex;
    flex-direction: column;
    background: var(--sanvi-color-background-primary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); /* sanvi-tokens-ignore */
    overflow: hidden;
  }

  .sanvi-device-frame--desktop {
    flex: 1 1 600px; /* sanvi-tokens-ignore */
    min-width: 480px; /* sanvi-tokens-ignore */
  }

  .sanvi-device-frame__header {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    background: var(--sanvi-color-background-secondary);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-device-frame__dots {
    display: flex;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-device-frame__dots span {
    width: 10px; /* sanvi-tokens-ignore */
    height: 10px; /* sanvi-tokens-ignore */
    border-radius: 50%; /* sanvi-tokens-ignore */
    background: var(--sanvi-color-border-default);
  }

  .sanvi-device-frame__address {
    flex: 1;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-primary);
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-sm);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sanvi-device-frame--mobile {
    flex: 0 0 375px; /* sanvi-tokens-ignore */
    width: 375px; /* sanvi-tokens-ignore */
    border: 8px solid var(--sanvi-color-gray-800); /* sanvi-tokens-ignore */
    border-radius: 36px; /* sanvi-tokens-ignore */
    position: relative;
  }

  .sanvi-device-frame__notch {
    width: 120px; /* sanvi-tokens-ignore */
    height: 18px; /* sanvi-tokens-ignore */
    background: var(--sanvi-color-gray-800);
    border-radius: 0 0 12px 12px; /* sanvi-tokens-ignore */
    margin: 0 auto;
  }

  .sanvi-device-frame__iframe {
    border: none;
    width: 100%;
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-device-frame__iframe--desktop {
    height: 640px; /* sanvi-tokens-ignore */
  }

  .sanvi-device-frame__iframe--mobile {
    height: 667px; /* sanvi-tokens-ignore */
  }
</style>
