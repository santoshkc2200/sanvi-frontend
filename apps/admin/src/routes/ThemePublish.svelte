<script lang="ts">
import { getTenantThemeDraft, publishTenantTheme, rollbackTenantTheme } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { ApiError } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  Dialog,
  showToast,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'
import ThemeShell from '../lib/theme/ThemeShell.svelte'

type ThemeDraft = components['schemas']['TenantThemeDraftView']

let draft = $state<ThemeDraft | null>(null)
let loading = $state(true)
let error = $state<string | undefined>(undefined)

let publishing = $state(false)
let rollingBack = $state(false)
let showRollbackConfirm = $state(false)

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

const tokenCount = $derived(Object.keys(draft?.theme?.token_overrides ?? {}).length)
const layoutCount = $derived(Object.keys(draft?.theme?.layout_overrides ?? {}).length)
const hasCustomCss = $derived(Boolean(draft?.theme?.custom_css))

const hasChanges = $derived(
  tokenCount > 0 || layoutCount > 0 || hasCustomCss || draft?.theme?.state === 'draft',
)

async function handlePublish(): Promise<void> {
  publishing = true
  error = undefined

  try {
    const updated = await publishTenantTheme(apiClient)
    if (draft) {
      draft = {
        ...draft,
        theme: updated,
      }
    }
    showToast({
      variant: 'success',
      title: t['admin.theme.publish.publishSuccess'](),
    })
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 400) {
      error = t['admin.theme.publish.publishContrastError']()
    } else {
      error = err instanceof Error ? err.message : t['admin.theme.gallery.error']()
    }
  } finally {
    publishing = false
  }
}

async function handleRollback(): Promise<void> {
  rollingBack = true
  error = undefined

  try {
    const updated = await rollbackTenantTheme(apiClient)
    if (draft) {
      draft = {
        ...draft,
        theme: updated,
      }
    }
    showRollbackConfirm = false
    showToast({
      variant: 'success',
      title: t['admin.theme.publish.rollbackSuccess'](),
    })
  } catch (err: unknown) {
    showRollbackConfirm = false
    if (err instanceof ApiError && err.status === 409) {
      error = t['admin.theme.publish.rollbackNoRevision']()
    } else {
      error = err instanceof Error ? err.message : t['admin.theme.gallery.error']()
    }
  } finally {
    rollingBack = false
  }
}
</script>

<svelte:head>
  <title>{t['admin.theme.publish.title']()}</title>
</svelte:head>

<ThemeShell activeTab="publish">
  <Container size="md" padding="6">
    <Stack gap="6">
      <h2>{t['admin.theme.publish.title']()}</h2>
      <p class="sanvi-publish-desc">{t['admin.theme.publish.description']()}</p>

      {#if error}
        <Alert variant="error">{error}</Alert>
      {/if}

      {#if loading}
        <Spinner label={t['admin.theme.gallery.loading']()} />
      {:else if draft}
        <div class="sanvi-diff-card">
          <Stack gap="4">
            <Cluster justify="space-between" align="center">
              <h3 class="sanvi-diff-title">Draft Summary (Revision {draft.theme.revision})</h3>
              <Badge variant={draft.theme.state === 'draft' ? 'warning' : 'success'}>
                {draft.theme.state}
              </Badge>
            </Cluster>

            {#if !hasChanges}
              <p class="sanvi-diff-empty">{t['admin.theme.publish.diffNoChanges']()}</p>
            {:else}
              <ul class="sanvi-diff-list">
                {#if tokenCount > 0}
                  <li>{t['admin.theme.publish.diffTokens']({ count: tokenCount })}</li>
                {/if}
                {#if layoutCount > 0}
                  <li>{t['admin.theme.publish.diffLayouts']({ count: layoutCount })}</li>
                {/if}
                {#if hasCustomCss}
                  <li>{t['admin.theme.publish.diffCustomCss']()}</li>
                {/if}
                <li>{t['admin.theme.publish.diffThemeKey']({ themeKey: draft.theme.theme_key })}</li>
              </ul>
            {/if}

            <Cluster gap="4" align="center">
              <Button
                variant="primary"
                disabled={publishing || rollingBack}
                onclick={() => void handlePublish()}
              >
                {publishing
                  ? t['admin.theme.publish.publishing']()
                  : t['admin.theme.publish.publishButton']()}
              </Button>

              <Button
                variant="secondary"
                disabled={publishing || rollingBack}
                onclick={() => {
                  showRollbackConfirm = true
                }}
              >
                {t['admin.theme.publish.rollbackButton']()}
              </Button>
            </Cluster>
          </Stack>
        </div>
      {/if}
    </Stack>
  </Container>
</ThemeShell>

<!-- Rollback Confirmation Dialog -->
<Dialog
  bind:open={showRollbackConfirm}
  titleText={t['admin.theme.publish.rollbackConfirmTitle']()}
>
  {#snippet children()}
    <p>
      {t['admin.theme.publish.rollbackConfirmMessage']({
        updatedAt: draft?.theme.updated_at
          ? fmt.date(draft.theme.updated_at, 'medium')
          : '—',
      })}
    </p>
  {/snippet}

  {#snippet footer()}
    <Cluster justify="end" gap="3">
      <Button
        variant="secondary"
        onclick={() => {
          showRollbackConfirm = false
        }}
      >
        {t['common.cancel']()}
      </Button>
      <Button
        variant="danger"
        disabled={rollingBack}
        onclick={() => void handleRollback()}
      >
        {t['common.confirm']()}
      </Button>
    </Cluster>
  {/snippet}
</Dialog>

<style>
  .sanvi-publish-desc {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-diff-card {
    border: 1px solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    padding: var(--sanvi-spacing-6);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-diff-title {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-diff-empty {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-diff-list {
    margin: 0;
    padding-left: var(--sanvi-spacing-6);
    color: var(--sanvi-color-text-primary);
  }
</style>
