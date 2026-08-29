<script lang="ts">
import { getTenantThemeDraft, listAvailableThemes, putTenantThemeDraft } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { currentLocale, t } from '@sanvi/i18n'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  EmptyState,
  Grid,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'
import ThemeShell from '../lib/theme/ThemeShell.svelte'

type AvailableTheme = components['schemas']['AvailableThemeView']
type ThemeDraft = components['schemas']['TenantThemeDraftView']

let themes = $state<AvailableTheme[]>([])
let draft = $state<ThemeDraft | null>(null)
let loading = $state(true)
let error = $state<string | undefined>(undefined)
let applyingKey = $state<string | null>(null)

let loadSeq = 0

async function loadGallery(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const [themesRes, draftRes] = await Promise.all([
      listAvailableThemes(apiClient),
      getTenantThemeDraft(apiClient),
    ])
    if (seq !== loadSeq) return
    themes = themesRes.themes ?? []
    draft = draftRes
  } catch {
    if (seq !== loadSeq) return
    error = t['admin.theme.gallery.error']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void loadGallery()
})

const visibleThemes = $derived(
  themes.filter((theme) => !theme.required_feature || hasFeature(theme.required_feature)),
)

const currentThemeKey = $derived(draft?.theme?.theme_key)

function getThemeName(theme: AvailableTheme): string {
  const locale = currentLocale()
  if (locale === 'ja' && theme.name?.ja) return theme.name.ja
  return theme.name?.en ?? theme.key
}

async function handleApplyTheme(themeKey: string): Promise<void> {
  applyingKey = themeKey
  try {
    const updated = await putTenantThemeDraft(apiClient, { theme_key: themeKey })
    if (draft) {
      draft = {
        ...draft,
        theme: updated,
      }
    }
  } catch {
    error = t['admin.theme.gallery.error']()
  } finally {
    applyingKey = null
  }
}
</script>

<svelte:head>
  <title>{t['admin.theme.gallery.title']()}</title>
</svelte:head>

<ThemeShell activeTab="gallery">
  <Container size="md" padding="6">
    <Stack gap="6">
      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={t['admin.theme.gallery.loading']()} />
      {:else if visibleThemes.length === 0}
        <EmptyState
          title={t['admin.theme.gallery.title']()}
          description={t['admin.theme.gallery.noThemes']()}
        />
      {:else}
        <Grid columns="2" gap="6">
          {#each visibleThemes as theme (theme.key)}
            {@const isCurrent = theme.key === currentThemeKey}
            <div class="sanvi-theme-card" data-theme-key={theme.key}>
              <Stack gap="4">
                <Cluster justify="space-between" align="center">
                  <h2 class="sanvi-theme-card__title">{getThemeName(theme)}</h2>
                  <Cluster gap="2">
                    {#if isCurrent}
                      <Badge variant="info">{t['admin.theme.gallery.current']()}</Badge>
                    {/if}
                    {#if theme.visibility === 'premium'}
                      <Badge variant="neutral">Premium</Badge>
                    {/if}
                  </Cluster>
                </Cluster>

                <p class="sanvi-theme-card__version">v{theme.version}</p>

                <Cluster justify="end" align="center">
                  {#if !isCurrent}
                    <Button
                      variant="secondary"
                      disabled={applyingKey !== null}
                      onclick={() => void handleApplyTheme(theme.key)}
                    >
                      {t['admin.theme.gallery.apply']()}
                    </Button>
                  {/if}
                </Cluster>
              </Stack>
            </div>
          {/each}
        </Grid>
      {/if}
    </Stack>
  </Container>
</ThemeShell>

<style>
  .sanvi-theme-card {
    border: 1px solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    padding: var(--sanvi-spacing-6);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-theme-card__title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-theme-card__version {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
