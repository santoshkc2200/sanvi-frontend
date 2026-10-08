<script lang="ts">
import {
  ApiError,
  createAdCreative,
  deleteAdCreative,
  getAdCreativePreviews,
  listAdConnections,
  listAdCreatives,
  listAdPlatforms,
} from '@sanvi/api-client'
import type {
  ConnectionView,
  CreativePreviewView,
  CreativeView,
  CreateCreativeRequest,
  PlatformView,
} from '@sanvi/api-client'
import { can } from '@sanvi/auth'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  AdLocaleCopyEditor,
  Alert,
  Badge,
  Button,
  campaignFormSchema,
  Cluster,
  Container,
  DataTable,
  Dialog,
  EmptyState,
  PlacementPreview,
  showToast,
  Spinner,
  Stack,
  textFieldsFor,
  type AdAssetSpec,
  type CampaignFormTextEntry,
} from '@sanvi/ui'
import type { TableColumn } from '@sanvi/ui'
import { AssetUploadController, type AssetUploadState } from '@sanvi/course-media'
import { apiClient } from '../../lib/api'
import { getAppEnv } from '../../lib/env'
import {
  buildCreateRequests,
  metadataFromUpload,
  placementsForConnection,
  placementLabel,
  requirementLines,
  specViolations,
  textsFromEntries,
  type EditorAsset,
  type PlacementSpec,
} from '../../lib/advertising/creatives'

/**
 * The creative library (phase 10, TASK-013): images and copy per placement
 * and per language, with each placement's asset rules checked the moment
 * an upload lands — a failing asset names the placement and the failing
 * dimension, and the fix is either dropping that image or dropping the
 * placement it fails, never a silent broken ad later.
 *
 * Every field, limit, and placement comes from the connection's platform
 * capability matrix — the matrix is the only source (the platform-literal
 * gate enforces it). Uploads ride `@sanvi/course-media`'s single upload
 * pipeline; previews render through the tokenized placement frames so a
 * headline that fits in English and overflows in Japanese is caught here,
 * in this tab, before any platform ever sees it.
 */

type CreativeRow = CreativeView & { [key: string]: unknown }

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let platforms = $state<PlatformView[]>([])
let connections = $state<ConnectionView[]>([])
let creatives = $state<CreativeView[]>([])

let loadSeq = 0

const writable = $derived(can('advertising.campaign.write', getActiveTenantId()))
const names = $derived(
  Object.fromEntries(platforms.map((platform) => [platform.key, platform.display_name])),
)
const activeConnections = $derived(connections.filter((item) => item.status !== 'disconnected'))

// --- List sorting (client-side, per column; nothing is summed) --------------

let sortKey = $state<string | undefined>(undefined)
let sortDirection = $state<'asc' | 'desc'>('asc')

const sortedCreatives = $derived.by(() => {
  if (!sortKey) return creatives
  const factor = sortDirection === 'asc' ? 1 : -1
  const key = sortKey
  return [...creatives].sort((left, right) => {
    if (key === 'updated') {
      return left.updated_at.localeCompare(right.updated_at) * factor
    }
    if (key === 'platform') {
      return (
        (names[left.platform] ?? left.platform).localeCompare(
          names[right.platform] ?? right.platform,
          undefined,
        ) * factor
      )
    }
    if (key === 'placement') {
      return (
        placementLabel(left.creative.placement).localeCompare(
          placementLabel(right.creative.placement),
        ) * factor
      )
    }
    return 0
  })
})

// --- Editor state ------------------------------------------------------------

let editorOpen = $state(false)
let editorConnectionId = $state<string | undefined>(undefined)
let editorPlacements = $state<string[]>([])
let editorEntries = $state<CampaignFormTextEntry[] | undefined>(undefined)
let editorAssets = $state<EditorAsset[]>([])
let editorSaving = $state(false)
let editorError = $state<string | undefined>(undefined)
let serverMessages = $state<string[]>([])

let mediaController: AssetUploadController | undefined
let mediaState = $state<AssetUploadState>({ phase: 'idle' })

const editorConnection = $derived(
  activeConnections.find((candidate) => candidate.id === editorConnectionId),
)
const editorPlatform = $derived(
  editorConnection
    ? platforms.find((candidate) => candidate.key === editorConnection.platform)
    : undefined,
)
const editorMatrix = $derived(editorPlatform?.capability_matrix)
const editorSchema = $derived(
  editorMatrix ? campaignFormSchema(editorMatrix, editorPlatform?.key) : undefined,
)
const editorPlacementSpecs = $derived<PlacementSpec[]>(
  editorConnection && editorMatrix
    ? placementsForConnection(editorConnection, platforms).filter((candidate) =>
        editorPlacements.includes(candidate.key),
      )
    : [],
)
const copyLimits = $derived.by(() => {
  if (!editorSchema) return {}
  return Object.fromEntries(
    editorSchema.texts.locales.map((locale) => [locale, textFieldsFor(editorSchema.texts, locale)]),
  )
})
const copyOptionLabels = $derived.by(() => {
  const labels: Record<string, string> = {}
  for (const locale of Object.keys(copyLimits)) {
    labels[locale] = dataLocaleLabel(locale)
  }
  for (const locale of Object.keys(copyLimits)) {
    for (const field of Object.keys(copyLimits[locale] ?? {})) {
      labels[field] = dataOptionLabel(field)
    }
  }
  return labels
})
const editorViolations = $derived(specViolations(editorAssets, editorPlacementSpecs))

/** Violations grouped per placement: the messages, and which images fail it. */
const violationsByPlacement = $derived.by(() => {
  const groups = new Map<string, { key: string; messages: string[]; assetIndexes: number[] }>()
  for (const violation of editorViolations) {
    let group = groups.get(violation.placementKey)
    if (!group) {
      group = { key: violation.placementKey, messages: [], assetIndexes: [] }
      groups.set(violation.placementKey, group)
    }
    group.messages.push(violation.message)
    if (violation.kind === 'asset' && violation.assetIndex !== undefined) {
      if (!group.assetIndexes.includes(violation.assetIndex)) {
        group.assetIndexes.push(violation.assetIndex)
      }
    }
  }
  return [...groups.values()]
})
const editorReady = $derived(
  Boolean(editorConnection) &&
    editorPlacementSpecs.length > 0 &&
    editorAssets.length > 0 &&
    editorViolations.length === 0,
)

function dataOptionLabel(value: string): string {
  const label = t as unknown as Record<string, () => string>
  const key = `admin.advertising.option.${value}`
  return typeof label[key] === 'function' ? label[key]() : value
}

function dataLocaleLabel(value: string): string {
  const label = t as unknown as Record<string, () => string>
  const key = `admin.advertising.locale.${value}`
  return typeof label[key] === 'function' ? label[key]() : value
}

/**
 * The media service connection. There is no bearer token to give: the SPA
 * holds a Kratos session cookie, and the service's own API key is a server
 * secret that must never reach a browser — so the empty token omits the
 * `Authorization` header and `credentials: 'include'` sends the cookie for a
 * same-site media gateway to exchange. A cross-origin media origin is not
 * supported by this path (see the TASK-013 notes: it needs a token-minting
 * endpoint on the backend).
 */
function mediaContext() {
  const env = getAppEnv()
  return {
    apiBaseUrl: env.mediaOrigin ?? env.apiOrigin,
    getToken: async () => '',
    getTenantId: () => getActiveTenantId() ?? null,
    credentials: 'include' as const,
  }
}

function ensureMediaController(): AssetUploadController | undefined {
  if (mediaController) return mediaController
  mediaController = new AssetUploadController(mediaContext())
  mediaController.state.subscribe((state: AssetUploadState) => {
    mediaState = state
    if (state.phase === 'ready') {
      const url = mediaController?.takeLocalUrl() ?? state.localUrl
      editorAssets = [
        ...editorAssets,
        {
          id: state.assetId,
          localUrl: url,
          metadata: metadataFromUpload({
            width: state.width,
            height: state.height,
            fileSizeBytes: state.fileSizeBytes,
            contentType: state.contentType,
          }),
        },
      ]
      mediaController?.reset()
    }
  })
  return mediaController
}

function onFileChange(event: Event): void {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !editorConnectionId) return
  ensureMediaController()?.start(file, editorConnectionId)
}

function uploadErrorMessage(): string | undefined {
  if (mediaState.phase !== 'failed') return undefined
  if (mediaState.reason === 'unsupported_file_type') {
    return t['admin.advertising.creatives.uploadUnsupportedType']()
  }
  if (mediaState.reason === 'empty_file') {
    return t['admin.advertising.creatives.uploadEmptyFile']()
  }
  return t['admin.advertising.creatives.uploadFailed']()
}

/**
 * Blob URLs claimed from the upload controller (`takeLocalUrl`) belong to
 * this screen from that point on — nothing else will revoke them, and a
 * full-size image stays in memory for the tab's life if we do not.
 */
function releaseAssetUrl(asset: EditorAsset | undefined): void {
  if (asset?.localUrl.startsWith('blob:')) URL.revokeObjectURL(asset.localUrl)
}

function releaseAllAssetUrls(): void {
  for (const asset of editorAssets) releaseAssetUrl(asset)
}

function removeAsset(index: number): void {
  releaseAssetUrl(editorAssets[index])
  editorAssets = editorAssets.filter((_, candidate) => candidate !== index)
}

function openEditor(): void {
  releaseAllAssetUrls()
  editorConnectionId = activeConnections.length === 1 ? activeConnections[0]?.id : undefined
  editorEntries = undefined
  editorPlacements = []
  editorAssets = []
  editorError = undefined
  serverMessages = []
  mediaState = { phase: 'idle' }
  editorOpen = true
}

function closeEditor(): void {
  editorOpen = false
  releaseAllAssetUrls()
  editorAssets = []
  mediaController?.destroy()
  mediaController = undefined
}

function onEditorConnectionChange(value: string): void {
  editorConnectionId = value || undefined
  editorPlacements = []
  // The copy editor discards stale entries itself when the matrix (and so
  // the limits object) changes — nothing to do here.
  editorError = undefined
}

function togglePlacement(key: string, checked: boolean): void {
  editorPlacements = checked
    ? [...editorPlacements, key]
    : editorPlacements.filter((existing) => existing !== key)
}

// --- Editor live previews ----------------------------------------------------

interface LivePreview {
  key: string
  label: string
  locale: string
  lines: string[]
  imageUrl: string | undefined
  spec: AdAssetSpec
}

const livePreviews = $derived.by(() => {
  const previews: LivePreview[] = []
  if (!editorSchema || !editorEntries) return previews
  for (const placement of editorPlacementSpecs) {
    for (const entry of editorEntries) {
      const fields = Object.keys(textFieldsFor(editorSchema.texts, entry.locale))
      const lines = fields.map((field) => entry.values[field] ?? '')
      if (lines.every((line) => line.trim() === '')) continue
      previews.push({
        key: placement.key,
        label: placementLabel(placement.key),
        locale: entry.locale,
        lines,
        imageUrl: editorAssets[0]?.localUrl,
        spec: placement.spec,
      })
    }
  }
  return previews
})

// --- Submit ------------------------------------------------------------------

async function submitEditor(): Promise<void> {
  if (!editorConnection || !editorReady || editorSaving) return
  editorSaving = true
  editorError = undefined
  serverMessages = []
  try {
    const texts = textsFromEntries(editorEntries ?? [], copyLimits)
    const requests = buildCreateRequests(
      editorConnection.id,
      editorPlacementSpecs,
      texts,
      editorAssets,
    )
    const results = await Promise.allSettled(
      requests.map((request) =>
        createAdCreative(apiClient, request as CreateCreativeRequest, crypto.randomUUID()),
      ),
    )
    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length === results.length && failures[0]) {
      editorError = createErrorMessage(failures[0])
      return
    }
    if (failures.length > 0 && failures[0]) {
      // Some placements were created and some were not. The editor stays
      // open showing why, with the placements that succeeded dropped from
      // the selection so a retry creates only what is still missing —
      // announcing success here would hide a half-published creative.
      const created = editorPlacementSpecs
        .filter((_, index) => results[index]?.status === 'fulfilled')
        .map((placement) => placement.key)
      editorPlacements = editorPlacements.filter((key) => !created.includes(key))
      editorError = createErrorMessage(failures[0])
      await load()
      return
    }
    editorOpen = false
    releaseAllAssetUrls()
    editorAssets = []
    mediaController?.destroy()
    mediaController = undefined
    showToast({ title: t['admin.advertising.creatives.createdToast'](), variant: 'success' })
    await load()
  } finally {
    editorSaving = false
  }
}

function createErrorMessage(failure: PromiseSettledResult<unknown>): string {
  const reason = failure.status === 'rejected' ? failure.reason : undefined
  if (reason instanceof ApiError && reason.status === 400 && reason.problem) {
    const violations = reason.problem['violations']
    if (Array.isArray(violations) && violations.length > 0) {
      serverMessages = (violations as { message: string }[]).map((violation) => violation.message)
      return t['admin.advertising.creatives.serverViolations']()
    }
  }
  return t['admin.advertising.creatives.createError']()
}

// --- Delete ------------------------------------------------------------------

let deleteOpen = $state(false)
let deleteTarget = $state<CreativeView | null>(null)
let deleteRunning = $state(false)
let deleteError = $state<string | undefined>(undefined)

function openDelete(view: CreativeView): void {
  deleteTarget = view
  deleteError = undefined
  deleteOpen = true
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget || deleteRunning) return
  deleteRunning = true
  deleteError = undefined
  try {
    await deleteAdCreative(apiClient, deleteTarget.id)
    deleteOpen = false
    deleteTarget = null
    await load()
  } catch (err) {
    deleteError =
      err instanceof ApiError && (err.status === 400 || err.status === 409)
        ? t['admin.advertising.creatives.inUse']()
        : t['admin.advertising.creatives.deleteError']()
  } finally {
    deleteRunning = false
  }
}

// --- Saved previews ------------------------------------------------------------

let previewOpen = $state(false)
let previewLoading = $state(false)
let previewError = $state<string | undefined>(undefined)
let previewPlacements = $state<CreativePreviewView[]>([])
let previewSeq = 0

async function openPreviews(view: CreativeView): Promise<void> {
  // Same guard as `load()`: two quick clicks on different rows must not let
  // the slower response paint under the newer row's dialog title.
  const seq = ++previewSeq
  previewOpen = true
  previewLoading = true
  previewError = undefined
  previewPlacements = []
  try {
    const result = await getAdCreativePreviews(apiClient, view.id)
    if (seq !== previewSeq) return
    previewPlacements = result?.previews ?? []
  } catch {
    if (seq !== previewSeq) return
    previewError = t['admin.advertising.creatives.previewsLoadError']()
  } finally {
    if (seq === previewSeq) previewLoading = false
  }
}

// --- Load ---------------------------------------------------------------------

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true

  try {
    const catalog = await listAdPlatforms(apiClient)
    if (seq !== loadSeq) return
    platforms = catalog?.platforms ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.genericError']()
    }
    loading = false
    return
  }

  const [connectionsResult, creativesResult] = await Promise.allSettled([
    listAdConnections(apiClient),
    listAdCreatives(apiClient),
  ])
  if (seq !== loadSeq) return
  connections =
    connectionsResult.status === 'fulfilled' ? (connectionsResult.value?.connections ?? []) : []
  creatives = creativesResult.status === 'fulfilled' ? (creativesResult.value?.creatives ?? []) : []
  error =
    connectionsResult.status === 'rejected' || creativesResult.status === 'rejected'
      ? t['admin.advertising.creatives.loadError']()
      : undefined
  loading = false
}

$effect(() => {
  void getActiveTenantId()
  void load()
  return () => {
    releaseAllAssetUrls()
    mediaController?.destroy()
    mediaController = undefined
  }
})

// --- Table cells ----------------------------------------------------------------

function copyCellLines(view: CreativeView): { lead: string; locales: number } {
  const entries = view.creative.texts
  const lead = entries[0]?.headline ?? ''
  return { lead, locales: entries.length }
}

const columns: TableColumn<CreativeRow>[] = $derived([
  {
    key: 'platform',
    header: t['admin.advertising.creatives.platformColumn'](),
    cell: platformCell,
    sortable: true,
  },
  {
    key: 'placement',
    header: t['admin.advertising.creatives.placementColumn'](),
    cell: placementCell,
    sortable: true,
  },
  { key: 'copy', header: t['admin.advertising.creatives.copyColumn'](), cell: copyCell },
  {
    key: 'updated',
    header: t['admin.advertising.creatives.updatedColumn'](),
    cell: updatedCell,
    sortable: true,
  },
  { key: 'actions', header: t['admin.advertising.creatives.actionsColumn'](), cell: actionsCell },
])
</script>

{#snippet platformCell(row: CreativeRow)}
  <Badge variant="neutral">{names[row.platform] ?? row.platform}</Badge>
{/snippet}

{#snippet placementCell(row: CreativeRow)}
  {placementLabel(row.creative.placement)}
{/snippet}

{#snippet copyCell(row: CreativeRow)}
  {@const copy = copyCellLines(row)}
  <span class="sanvi-ad-creatives__copy-lead">{copy.lead || t['admin.advertising.creatives.noCopy']()}</span>
  <span class="sanvi-ad-creatives__copy-meta">
    {t['admin.advertising.creatives.localeCount']({ count: copy.locales })}
  </span>
{/snippet}

{#snippet updatedCell(row: CreativeRow)}
  {fmt.datetime(row.updated_at, 'medium')}
{/snippet}

{#snippet actionsCell(row: CreativeRow)}
  <Cluster gap="2">
    <Button variant="ghost" size="sm" onclick={() => void openPreviews(row)}>
      {t['admin.advertising.creatives.previewAction']()}
    </Button>
    {#if writable}
      <Button variant="ghost" size="sm" onclick={() => openDelete(row)}>
        {t['admin.advertising.creatives.deleteAction']()}
      </Button>
    {/if}
  </Cluster>
{/snippet}

<svelte:head>
  <title>{t['admin.advertising.creatives.title']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.creatives.title']()}</h1>
      <p>{t['admin.advertising.creatives.description']()}</p>
      {#if writable && activeConnections.length > 0}
        <Button variant="primary" onclick={openEditor}>
          {t['admin.advertising.creatives.createCta']()}
        </Button>
      {/if}
    </div>

    {#if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
      </Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.advertising.campaigns.loading']()} />
    {:else if !entitled}
      <EmptyState
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
      />
    {:else if activeConnections.length === 0}
      <EmptyState
        title={t['admin.advertising.campaigns.noConnectionTitle']()}
        description={t['admin.advertising.campaigns.noConnectionDescription']()}
      />
    {:else if creatives.length === 0}
      <EmptyState
        title={t['admin.advertising.creatives.emptyTitle']()}
        description={t['admin.advertising.creatives.emptyDescription']()}
      />
    {:else}
      <DataTable
        columns={columns}
        rows={sortedCreatives as CreativeRow[]}
        getRowId={(row) => row.id}
        caption={t['admin.advertising.creatives.tableCaption']()}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(key, direction) => {
          sortKey = key
          sortDirection = direction
        }}
      />
    {/if}
  </Stack>
</Container>

<Dialog bind:open={editorOpen} titleText={t['admin.advertising.creatives.createCta']()}>
  {#snippet children()}
    <Stack gap="5">
      {#if editorError}
        <Alert variant="error">
          {editorError}
          {#if serverMessages.length > 0}
            <ul class="sanvi-ad-creatives__server-messages">
              {#each serverMessages as message, index (index)}
                <li>{message}</li>
              {/each}
            </ul>
          {/if}
        </Alert>
      {/if}

      <label class="sanvi-ad-creatives__field">
        <span>{t['admin.advertising.creatives.connectionLabel']()}</span>
        <select
          aria-label={t['admin.advertising.creatives.connectionLabel']()}
          onchange={(event) => onEditorConnectionChange(event.currentTarget.value)}
          value={editorConnectionId ?? ''}
        >
          <option value="">{t['admin.advertising.creatives.connectionPlaceholder']()}</option>
          {#each activeConnections as candidate (candidate.id)}
            <option value={candidate.id}>
              {candidate.account_name ?? candidate.external_account_id} · {candidate.currency}
            </option>
          {/each}
        </select>
      </label>

      {#if editorMatrix}
        <fieldset class="sanvi-ad-creatives__group">
          <legend>{t['admin.advertising.creatives.placementsLabel']()}</legend>
          <p class="sanvi-ad-creatives__hint">{t['admin.advertising.creatives.placementsHint']()}</p>
          {#each editorMatrix.creative_placements as placement (placement.key)}
            <label class="sanvi-ad-creatives__check">
              <input
                type="checkbox"
                checked={editorPlacements.includes(placement.key)}
                onchange={(event) => togglePlacement(placement.key, event.currentTarget.checked)}
              />
              {placementLabel(placement.key)}
            </label>
          {/each}
          {#if editorPlacements.length === 0}
            <p class="sanvi-ad-creatives__field-error" role="alert">
              {t['admin.advertising.creatives.placementRequired']()}
            </p>
          {/if}
        </fieldset>

        <AdLocaleCopyEditor
          bind:entries={editorEntries}
          limitsByLocale={copyLimits}
          optionLabels={copyOptionLabels}
          formatCounter={(current, limit) =>
            t['admin.advertising.creatives.counter']({ current, limit })}
          formatTooLongError={(limit, current) =>
            t['admin.advertising.creatives.tooLong']({ limit, current })}
        />

        <fieldset class="sanvi-ad-creatives__group">
          <legend>{t['admin.advertising.creatives.assetsLabel']()}</legend>
          <p class="sanvi-ad-creatives__hint">{t['admin.advertising.creatives.assetsHint']()}</p>
          <label class="sanvi-ad-creatives__upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onchange={onFileChange}
            />
            {t['admin.advertising.creatives.uploadButton']()}
          </label>
          {#if uploadErrorMessage()}
            <p class="sanvi-ad-creatives__field-error" role="alert">{uploadErrorMessage()}</p>
          {/if}
          {#if mediaState.phase === 'uploading'}
            <p class="sanvi-ad-creatives__hint" aria-live="polite">
              {t['admin.advertising.creatives.uploading']()}
            </p>
          {/if}
          {#if editorAssets.length > 0}
            <ul class="sanvi-ad-creatives__assets">
              {#each editorAssets as asset, index (asset.id)}
                <li>
                  <img
                    src={asset.localUrl}
                    alt=""
                    width={asset.metadata.width_px}
                    height={asset.metadata.height_px}
                  />
                  <Button variant="ghost" size="sm" onclick={() => removeAsset(index)}>
                    {t['admin.advertising.creatives.removeAssetAction']()}
                  </Button>
                </li>
              {/each}
            </ul>
          {/if}
        </fieldset>

        {#if editorPlacementSpecs.length > 0}
          <section class="sanvi-ad-creatives__specs">
            <h3>{t['admin.advertising.creatives.specHeading']()}</h3>
            {#each editorPlacementSpecs as placement (placement.key)}
              <div class="sanvi-ad-creatives__spec">
                <h4>{placementLabel(placement.key)}</h4>
                <ul>
                  {#each requirementLines(placement.spec) as line (line)}
                    <li>{line}</li>
                  {/each}
                </ul>
              </div>
            {/each}
          </section>
        {/if}

        {#if editorViolations.length > 0}
          <Alert variant="warning">
            <p>{t['admin.advertising.creatives.specIssueHeading']()}</p>
            {#each violationsByPlacement as group (group.key)}
              <div class="sanvi-ad-creatives__violation-group">
                <ul class="sanvi-ad-creatives__violations">
                  {#each group.messages as message, index (index)}
                    <li>{message}</li>
                  {/each}
                </ul>
                <Cluster gap="2">
                  {#each group.assetIndexes as assetIndex (assetIndex)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => removeAsset(assetIndex)}
                    >
                      {t['admin.advertising.creatives.removeAssetAction']()}
                    </Button>
                  {/each}
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => togglePlacement(group.key, false)}
                  >
                    {t['admin.advertising.creatives.dropPlacementAction']({
                      placement: placementLabel(group.key),
                    })}
                  </Button>
                </Cluster>
              </div>
            {/each}
          </Alert>
        {/if}

        {#if livePreviews.length > 0}
          <section class="sanvi-ad-creatives__previews">
            <h3>{t['admin.advertising.creatives.previewsTitle']()}</h3>
            <div class="sanvi-ad-creatives__preview-grid">
              {#each livePreviews as preview (preview.key + preview.locale)}
                <PlacementPreview
                  placementKey={preview.key}
                  placementLabel={preview.label}
                  spec={preview.spec}
                  copyLines={preview.lines}
                  imageUrl={preview.imageUrl}
                  imageAlt=""
                  locale={preview.locale}
                />
              {/each}
            </div>
          </section>
        {/if}
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={closeEditor}>{t['common.cancel']()}</Button>
    <Button variant="primary" loading={editorSaving} disabled={!editorReady} onclick={() => void submitEditor()}>
      {t['admin.advertising.creatives.saveAction']()}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={previewOpen} titleText={t['admin.advertising.creatives.previewsTitle']()}>
  {#snippet children()}
    <Stack gap="4">
      {#if previewLoading}
        <Spinner label={t['admin.advertising.campaigns.loading']()} />
      {:else if previewError}
        <Alert variant="error">{previewError}</Alert>
      {:else}
        <div class="sanvi-ad-creatives__preview-grid">
          {#each previewPlacements as preview (preview.placement)}
            <PlacementPreview
              placementKey={preview.placement}
              placementLabel={placementLabel(preview.placement)}
              spec={preview.spec}
              copyLines={[preview.headline ?? '', preview.body ?? '']}
              locale={undefined}
            />
          {/each}
        </div>
      {/if}
    </Stack>
  {/snippet}
</Dialog>

<Dialog bind:open={deleteOpen} titleText={t['admin.advertising.creatives.deleteTitle']()}>
  {#snippet children()}
    <Stack gap="4">
      <p>
        {t['admin.advertising.creatives.deleteDescription']({
          placement: deleteTarget ? placementLabel(deleteTarget.creative.placement) : '',
        })}
      </p>
      {#if deleteError}
        <Alert variant="error">{deleteError}</Alert>
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button
      variant="ghost"
      onclick={() => {
        deleteOpen = false
        deleteTarget = null
      }}
      disabled={deleteRunning}
    >
      {t['common.cancel']()}
    </Button>
    <Button variant="danger" loading={deleteRunning} onclick={() => void confirmDelete()}>
      {t['admin.advertising.creatives.deleteConfirm']()}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-ad-creatives__copy-lead {
    display: block;
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-ad-creatives__copy-meta {
    display: block;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-creatives__field {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    max-width: 40ch;
  }

  .sanvi-ad-creatives__field span {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-ad-creatives__group {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    padding: 0;
    border: none;
    margin: 0;
  }

  .sanvi-ad-creatives__group legend {
    padding: 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-ad-creatives__hint {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-creatives__field-error {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-status-error);
  }

  .sanvi-ad-creatives__check {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-ad-creatives__upload {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    cursor: pointer;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-ad-creatives__upload input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .sanvi-ad-creatives__upload input:focus-visible {
    outline: var(--sanvi-border-width-thick) solid var(--sanvi-color-border-focus);
    outline-offset: var(--sanvi-spacing-1);
  }

  .sanvi-ad-creatives__assets {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-ad-creatives__assets li {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    align-items: flex-start;
  }

  .sanvi-ad-creatives__assets img {
    width: var(--sanvi-spacing-32);
    aspect-ratio: 1;
    object-fit: cover;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
  }

  .sanvi-ad-creatives__specs {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-ad-creatives__specs h3 {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-ad-creatives__spec h4 {
    margin: 0 0 var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-ad-creatives__spec ul {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-creatives__violation-group {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    padding-block-end: var(--sanvi-spacing-2);
  }

  .sanvi-ad-creatives__violations {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-ad-creatives__server-messages {
    margin: var(--sanvi-spacing-2) 0 0;
    padding-inline-start: var(--sanvi-spacing-5);
  }

  .sanvi-ad-creatives__previews h3 {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-ad-creatives__preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(24ch, 1fr));
    gap: var(--sanvi-spacing-4);
  }
</style>
