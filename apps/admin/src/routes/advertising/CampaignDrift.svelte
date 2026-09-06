<script lang="ts">
import {
  ApiError,
  getAdCampaign,
  listAdCampaignChanges,
  listAdConnections,
  listAdPlatforms,
  resolveAdCampaignDrift,
} from '@sanvi/api-client'
import type {
  CampaignChange,
  CampaignView,
  ConnectionView,
  DriftResolution,
  PlatformView,
} from '@sanvi/api-client'
import { can } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  AdDriftDiff,
  Alert,
  Button,
  Cluster,
  Container,
  EmptyState,
  Radio,
  showToast,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import { driftRows, fieldLabel } from '../../lib/advertising/campaigns'

/**
 * The drift view (phase 10, TASK-012): a field-by-field diff of our intent
 * against the platform's current state, and two equal-weight resolutions.
 *
 * The invariants here are absolute: no default selection, no auto-resolve,
 * and no resolution on navigation. The radios start unchecked and the
 * confirm button stays dead until the tenant picks a side — a native-tool
 * edit is the tenant's, and overwriting it on their behalf is not ours to
 * do, ever.
 */

interface Props {
  id?: string
}

let { id: campaignId }: Props = $props()

let loading = $state(true)
let error = $state<string | undefined>(undefined)
let notFound = $state(false)
let campaign = $state<CampaignView | null>(null)
let platformChange = $state<CampaignChange | undefined>(undefined)
let platform = $state<PlatformView | undefined>(undefined)
let connection = $state<ConnectionView | undefined>(undefined)

// Deliberately no initial resolution: both radios render unchecked (the
// group value starts empty), and the confirm stays disabled until a side
// is picked.
let resolutionGroup = $state('')
let resolving = $state(false)
let resolveError = $state<string | undefined>(undefined)
let conflictAgain = $state(false)

let loadSeq = 0

const writable = $derived(can('advertising.campaign.write', getActiveTenantId()))
const resolution = $derived<DriftResolution | undefined>(
  resolutionGroup === '' ? undefined : (resolutionGroup as DriftResolution),
)
const rows = $derived(driftRows(platformChange))

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  notFound = false
  resolveError = undefined
  conflictAgain = false
  resolutionGroup = ''

  if (!campaignId) {
    notFound = true
    loading = false
    return
  }

  try {
    const view = await getAdCampaign(apiClient, campaignId)
    if (seq !== loadSeq) return
    campaign = view
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && err.status === 404) {
      notFound = true
    } else {
      error = t['admin.advertising.campaigns.loadError']()
    }
    loading = false
    return
  }

  try {
    const view = await listAdCampaignChanges(apiClient, campaignId)
    if (seq !== loadSeq) return
    // Newest first per contract — the first platform-sourced entry is the
    // drift we are looking at: its before_state is our intent.
    platformChange = (view?.changes ?? []).find((change) => change.source !== 'sanvi')
  } catch {
    if (seq !== loadSeq) return
    platformChange = undefined
  }

  const [platformsResult, connectionsResult] = await Promise.allSettled([
    listAdPlatforms(apiClient),
    listAdConnections(apiClient),
  ])
  if (seq !== loadSeq) return
  if (platformsResult.status === 'fulfilled') {
    platform = (platformsResult.value?.platforms ?? []).find(
      (candidate) => candidate.key === campaign?.platform,
    )
  }
  if (connectionsResult.status === 'fulfilled') {
    connection = (connectionsResult.value?.connections ?? []).find(
      (candidate) => candidate.id === campaign?.connection_id,
    )
  }

  loading = false
}

async function confirmResolve(): Promise<void> {
  if (!campaign || !resolution || resolving) return
  resolving = true
  resolveError = undefined
  try {
    const result = await resolveAdCampaignDrift(
      apiClient,
      campaign.id,
      { resolution, revision: campaign.revision },
      crypto.randomUUID(),
    )
    showToast({
      title: t['admin.advertising.drift.resolvedToast']({
        name: result.campaign.name,
      }),
      variant: 'success',
    })
    navigate(`/advertising/campaigns/${campaign.id}`)
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        // The state moved again while the decision was being made — reload
        // the diff and let the tenant decide afresh. Never resolve twice.
        await load()
        conflictAgain = true
        return
      }
      if (err.status === 503) {
        resolveError = t['admin.advertising.campaigns.platformUnavailable']()
        return
      }
      if (err.status === 403) {
        resolveError = t['admin.advertising.campaigns.forbidden']()
        return
      }
    }
    resolveError = t['admin.advertising.drift.resolveError']()
  } finally {
    resolving = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<svelte:head>
  <title>{t['admin.advertising.drift.title']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  {#if loading}
    <Spinner label={t['admin.advertising.campaigns.loading']()} />
  {:else if notFound}
    <EmptyState
      title={t['admin.advertising.builder.notFound']()}
      description={t['admin.advertising.detail.notFoundDescription']()}
    >
      {#snippet action()}
        <Button variant="secondary" onclick={() => navigate('/advertising/campaigns')}>
          {t['admin.advertising.campaigns.backToList']()}
        </Button>
      {/snippet}
    </EmptyState>
  {:else if error || !campaign}
    <Alert variant="error">
      {error ?? t['admin.advertising.campaigns.loadError']()}
      <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
    </Alert>
  {:else if !campaign.campaign.drift.drifted}
    <Stack gap="4">
      <p class="sanvi-ad-drift-page__heading">{t['admin.advertising.drift.title']()}</p>
      <EmptyState
        title={t['admin.advertising.drift.noneTitle']()}
        description={t['admin.advertising.drift.noneDescription']()}
      >
        {#snippet action()}
          <Button variant="secondary" onclick={() => navigate(`/advertising/campaigns/${campaign?.id ?? ''}`)}>
            {t['admin.advertising.drift.backToDetail']()}
          </Button>
        {/snippet}
      </EmptyState>
    </Stack>
  {:else}
    <Stack gap="6">
      <div>
        <p class="sanvi-ad-drift-page__back">
          <Button variant="ghost" size="sm" onclick={() => navigate(`/advertising/campaigns/${campaign?.id ?? ''}`)}>
            {t['admin.advertising.drift.backToDetail']()}
          </Button>
        </p>
        <h1>{t['admin.advertising.drift.title']()}</h1>
        <p>
          {t['admin.advertising.drift.description']({
            name: campaign.campaign.name,
            platform: platform?.display_name ?? campaign.platform,
            account: connection
              ? (connection.account_name ?? connection.external_account_id)
              : '',
          })}
        </p>
      </div>

      {#if conflictAgain}
        <Alert variant="warning">{t['admin.advertising.drift.conflictAgain']()}</Alert>
      {/if}

      {#if resolveError}
        <Alert variant="error">{resolveError}</Alert>
      {/if}

      <section>
        <h2>{t['admin.advertising.drift.fieldsHeading']()}</h2>
        <ul class="sanvi-ad-drift-page__fields">
          {#each campaign.campaign.drift.changed_fields as field (field)}
            <li>{fieldLabel(field)}</li>
          {/each}
        </ul>
      </section>

      <section>
        <h2>{t['admin.advertising.drift.diffHeading']()}</h2>
        {#if rows.length === 0}
          <p class="sanvi-ad-drift-page__note">{t['admin.advertising.drift.diffUnavailable']()}</p>
        {:else}
          <AdDriftDiff
            rows={rows}
            labels={{
              fieldHeader: t['admin.advertising.drift.fieldHeader'](),
              oursHeader: t['admin.advertising.drift.oursHeader'](),
              theirsHeader: t['admin.advertising.drift.theirsHeader']({
                platform: platform?.display_name ?? campaign.platform,
              }),
              tableCaption: t['admin.advertising.drift.tableCaption'](),
            }}
          />
        {/if}
      </section>

      {#if writable}
        <section>
          <h2>{t['admin.advertising.drift.resolveHeading']()}</h2>
          <p class="sanvi-ad-drift-page__note">{t['admin.advertising.drift.resolveLead']()}</p>
          <fieldset class="sanvi-ad-drift-page__choices">
            <legend class="sanvi-visually-hidden">{t['admin.advertising.drift.resolveHeading']()}</legend>
            <div>
              <Radio
                name="drift-resolution"
                value="keep_theirs"
                bind:group={resolutionGroup}
              >
                {t['admin.advertising.drift.keepTheirsLabel']()}
              </Radio>
              <p class="sanvi-ad-drift-page__choice-note">
                {t['admin.advertising.drift.keepTheirsNote']()}
              </p>
            </div>
            <div>
              <Radio
                name="drift-resolution"
                value="reapply_ours"
                bind:group={resolutionGroup}
              >
                {t['admin.advertising.drift.reapplyOursLabel']()}
              </Radio>
              <p class="sanvi-ad-drift-page__choice-note">
                {t['admin.advertising.drift.reapplyOursNote']()}
              </p>
            </div>
          </fieldset>
          <Cluster gap="2">
            <Button
              variant="primary"
              disabled={!resolution || resolving}
              loading={resolving}
              onclick={() => void confirmResolve()}
            >
              {t['admin.advertising.drift.resolveConfirm']()}
            </Button>
            <Button
              variant="secondary"
              onclick={() => navigate(`/advertising/campaigns/${campaign?.id ?? ''}`)}
            >
              {t['common.cancel']()}
            </Button>
          </Cluster>
        </section>
      {/if}
    </Stack>
  {/if}
</Container>

<style>
  .sanvi-ad-drift-page__heading {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-ad-drift-page__back {
    margin: 0 0 var(--sanvi-spacing-2);
  }

  .sanvi-ad-drift-page__fields {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
  }

  .sanvi-ad-drift-page__note {
    margin: 0 0 var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-drift-page__choices {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    margin: 0 0 var(--sanvi-spacing-4);
    padding: 0;
    border: none;
  }

  .sanvi-ad-drift-page__choice-note {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
