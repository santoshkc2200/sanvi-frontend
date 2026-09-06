<script lang="ts">
import {
  ApiError,
  getAdCampaign,
  listAdCampaignChanges,
  listAdConnections,
  listAdPlatforms,
  listMembers,
  pauseAdCampaign,
  publishAdCampaign,
  resumeAdCampaign,
} from '@sanvi/api-client'
import type { CampaignChange, CampaignView, ConnectionView, PlatformView } from '@sanvi/api-client'
import { can } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  AdChangeTimeline,
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  DetailShell,
  Dialog,
  EmptyState,
  formatAdCurrency,
  humanizeOptionValue,
  Spinner,
  Stack,
  type AdChangeItem,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import {
  budgetKindLabel,
  changeItems,
  dataLabel,
  money,
  statusLabel,
} from '../../lib/advertising/campaigns'

/**
 * The campaign detail (phase 10, TASK-012): the campaign tree (ad groups and
 * ads), the change log as readable history — "who paused this" has an answer
 * here, with platform-sourced changes attributed to the platform — and the
 * mutations that move money (publish, pause, resume), each naming what it
 * does before it does it.
 *
 * Performance over time arrives with the dashboard slice (TASK-016); its
 * placeholder says so rather than rendering an empty chart. Ad review state
 * is likewise not in this slice's contract — the platform's verbatim text
 * renders wherever the contract carries it (change entries), and the ads
 * table gains a status column the moment the schema does.
 */

interface Props {
  id?: string
}

let { id: campaignId }: Props = $props()

let loading = $state(true)
let error = $state<string | undefined>(undefined)
let notFound = $state(false)
let campaign = $state<CampaignView | null>(null)
let changes = $state<CampaignChange[]>([])
let platform = $state<PlatformView | undefined>(undefined)
let connection = $state<ConnectionView | undefined>(undefined)
let actorNames = $state<Record<string, string>>({})

// Publish confirmation.
let publishOpen = $state(false)
let publishRunning = $state(false)
let publishError = $state<string | undefined>(undefined)

// Resume spends money again — confirmed like a spend action.
let resumeOpen = $state(false)
let resumeRunning = $state(false)
let resumeError = $state<string | undefined>(undefined)

let mutating = $state(false)
let actionError = $state<string | undefined>(undefined)
let changesError = $state<string | undefined>(undefined)

let loadSeq = 0

const writable = $derived(can('advertising.campaign.write', getActiveTenantId()))
const platformAvailable = $derived(
  platform ? platform.available && !platform.upgrade_required : true,
)

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  notFound = false
  actionError = undefined
  changesError = undefined

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

  // Context loads are individually optional: a catalog or connection failure
  // degrades the header, it does not blank the page.
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

  try {
    const view = await listAdCampaignChanges(apiClient, campaignId)
    if (seq !== loadSeq) return
    changes = view?.changes ?? []
  } catch {
    if (seq !== loadSeq) return
    // History failing to load must not hide the campaign — the timeline
    // section shows the retriable error instead.
    changes = []
    changesError = t['admin.advertising.detail.changesError']()
  }

  // Actor names resolve best-effort: an operator without directory
  // permission still gets history, with ids standing in for names.
  try {
    const members = await listMembers(apiClient)
    if (seq !== loadSeq) return
    actorNames = Object.fromEntries((members ?? []).map((member) => [member.user_id, member.email]))
  } catch {
    if (seq !== loadSeq) return
    actorNames = {}
  }

  loading = false
}

function platformName(): string {
  return platform?.display_name ?? campaign?.platform ?? ''
}

const timelineItems = $derived<AdChangeItem[]>(
  campaign
    ? changeItems(changes, {
        platformName: platformName(),
        actorName: (actorId) => actorNames[actorId],
      })
    : [],
)

const budget = $derived(
  campaign && connection
    ? `${formatAdCurrency(campaign.campaign.budget.amount.amount_minor, connection.currency)} (${budgetKindLabel(campaign.campaign.budget.kind)})`
    : '—',
)

function statusTone(status: string): 'success' | 'neutral' | 'warning' {
  if (status === 'active') return 'success'
  if (status === 'paused') return 'warning'
  return 'neutral'
}

// --- Mutations --------------------------------------------------------------

function mutationError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) return t['admin.advertising.campaigns.platformUnavailable']()
    if (err.status === 409) return t['admin.advertising.detail.notPublishable']()
    if (err.status === 403) return t['admin.advertising.campaigns.forbidden']()
    if (err.status === 429) return t['admin.advertising.campaigns.quota']()
  }
  return t['admin.advertising.detail.mutationError']()
}

async function confirmPublish(): Promise<void> {
  if (!campaign || publishRunning) return
  publishRunning = true
  publishError = undefined
  try {
    await publishAdCampaign(apiClient, campaign.id, crypto.randomUUID())
    publishOpen = false
    await load()
  } catch (err) {
    if (err instanceof ApiError && err.status === 400 && err.problem) {
      // Platform-side validation failure: the platform's field messages,
      // verbatim — paraphrasing a rejection is how people ship broken ads.
      const violations = err.problem['violations']
      publishError =
        Array.isArray(violations) && violations.length > 0
          ? (violations as { message: string }[]).map((violation) => violation.message).join(' ')
          : (err.detail ?? t['admin.advertising.detail.publishError']())
      return
    }
    publishError = mutationError(err)
  } finally {
    publishRunning = false
  }
}

async function pause(): Promise<void> {
  if (!campaign || mutating) return
  mutating = true
  actionError = undefined
  try {
    await pauseAdCampaign(apiClient, campaign.id, crypto.randomUUID())
    await load()
  } catch (err) {
    actionError = mutationError(err)
  } finally {
    mutating = false
  }
}

function openResume(): void {
  resumeError = undefined
  resumeOpen = true
}

async function confirmResume(): Promise<void> {
  if (!campaign || resumeRunning) return
  resumeRunning = true
  try {
    await resumeAdCampaign(apiClient, campaign.id, crypto.randomUUID())
    resumeOpen = false
    await load()
  } catch (err) {
    resumeError = mutationError(err)
  } finally {
    resumeRunning = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<svelte:head>
  <title>{t['admin.advertising.detail.title']()}</title>
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
  {:else}
    <Stack gap="6">
      {#if campaign.campaign.drift.drifted}
        <!-- Drift is surfaced, never silently resolved: the banner is the
             entry into the diff, not a dismissal. -->
        <Alert variant="warning">
          <Cluster gap="4" align="center">
            <span>{t['admin.advertising.drift.banner']({ fields: campaign.campaign.drift.changed_fields.length })}</span>
            <Button variant="secondary" size="sm" onclick={() => navigate(`/advertising/campaigns/${campaign?.id ?? ''}/drift`)}>
              {t['admin.advertising.drift.reviewAction']()}
            </Button>
          </Cluster>
        </Alert>
      {/if}

      {#if !platformAvailable}
        <Alert variant="warning">
          {t['admin.advertising.detail.platformOff']()}
        </Alert>
      {/if}

      {#if actionError}
        <Alert variant="error">{actionError}</Alert>
      {/if}

      <DetailShell
        title={campaign.campaign.name}
        subtitle={t['admin.advertising.detail.subtitle']({
          platform: platformName(),
          account: connection
            ? (connection.account_name ?? connection.external_account_id)
            : campaign.platform,
        })}
        backHref="/advertising/campaigns"
        backLabel={t['admin.advertising.campaigns.backToList']()}
        tabsLabel={t['admin.advertising.detail.sectionsLabel']()}
      >
        {#snippet statusBadge()}
          <Badge variant={statusTone(campaign?.campaign.status ?? '')}>
            {statusLabel(campaign?.campaign.status ?? '')}
          </Badge>
          {#if campaign?.campaign.drift.drifted}
            <Badge variant="warning">{t['admin.advertising.campaigns.driftedBadge']()}</Badge>
          {/if}
        {/snippet}
        {#snippet meta()}
          <p class="sanvi-ad-detail__meta">
            {t['admin.advertising.detail.budgetMeta']({ budget })}
            {#if campaign?.external_id}
              · {t['admin.advertising.detail.externalIdMeta']({ id: campaign.external_id })}
            {/if}
          </p>
        {/snippet}
        {#snippet primaryActions()}
          {#if writable && platformAvailable}
            {#if campaign?.campaign.status === 'draft'}
              <Button variant="primary" disabled={mutating} onclick={() => (publishOpen = true)}>
                {t['admin.advertising.detail.publishAction']()}
              </Button>
            {:else if campaign?.campaign.status === 'active'}
              <Button variant="secondary" disabled={mutating} onclick={() => void pause()}>
                {t['admin.advertising.campaigns.pauseAction']()}
              </Button>
            {:else if campaign?.campaign.status === 'paused'}
              <Button variant="primary" disabled={mutating} onclick={() => openResume()}>
                {t['admin.advertising.campaigns.resumeAction']()}
              </Button>
            {/if}
          {/if}
          {#if writable}
            <Button variant="ghost" onclick={() => navigate(`/advertising/campaigns/${campaign?.id ?? ''}/edit`)}>
              {t['admin.advertising.campaigns.editAction']()}
            </Button>
          {/if}
        {/snippet}
        {#snippet children()}
      {#if campaign}
      <section>
        <h2>{t['admin.advertising.detail.performanceHeading']()}</h2>
        <p class="sanvi-ad-detail__placeholder">{t['admin.advertising.detail.performancePlaceholder']()}</p>
      </section>

      <section>
        <h2>{t['admin.advertising.detail.treeHeading']({ count: campaign.campaign.ad_groups.length })}</h2>
        {#if campaign.campaign.ad_groups.length === 0}
          <p class="sanvi-ad-detail__placeholder">{t['admin.advertising.detail.treeEmpty']()}</p>
        {:else}
          <Stack gap="4">
            {#each campaign.campaign.ad_groups as group (group.id)}
              <div class="sanvi-ad-detail__group">
                <Cluster gap="3" align="baseline">
                  <h3>{group.name}</h3>
                  <span class="sanvi-ad-detail__group-meta">
                    {t['admin.advertising.detail.bidMeta']({
                      strategy: humanizeOptionValue(group.bid.strategy),
                      maximum: group.bid.maximum_bid
                        ? money(group.bid.maximum_bid.amount_minor, group.bid.maximum_bid.currency)
                        : t['admin.advertising.detail.bidUnset'](),
                    })}
                  </span>
                </Cluster>
                {#if Object.keys(group.targeting.dimensions).length > 0}
                  <p class="sanvi-ad-detail__targeting">
                    {t['admin.advertising.builder.reviewTargeting']()}:
                    {Object.keys(group.targeting.dimensions)
                      .map((dimension) => dataLabel('admin.advertising.option.', dimension))
                      .join(', ')}
                  </p>
                {/if}
                {#if group.ads.length === 0}
                  <p class="sanvi-ad-detail__placeholder">{t['admin.advertising.detail.adsEmpty']()}</p>
                {:else}
                  <ul class="sanvi-ad-detail__ads">
                    {#each group.ads as ad (ad.id)}
                      <li>
                        <span class="sanvi-ad-detail__ad-placement">
                          {dataLabel('admin.advertising.option.', ad.creative.placement)}
                        </span>
                        {#each ad.creative.texts as text, index (text.locale)}
                          <span class="sanvi-ad-detail__ad-text">
                            {text.headline}
                            {#if index < ad.creative.texts.length - 1}
                              <span aria-hidden="true">·</span>
                            {/if}
                          </span>
                        {/each}
                        <span class="sanvi-ad-detail__ad-url">{ad.landing_url}</span>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/each}
          </Stack>
        {/if}
      </section>

      <section>
        <h2>{t['admin.advertising.detail.changesHeading']()}</h2>
        {#if changesError}
          <Alert variant="error">
            {changesError}
            <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
          </Alert>
        {:else if timelineItems.length === 0}
          <p class="sanvi-ad-detail__placeholder">{t['admin.advertising.detail.changesEmpty']()}</p>
        {:else}
          <AdChangeTimeline
            items={timelineItems}
            labels={{
              listLabel: t['admin.advertising.detail.changesListLabel'](),
              beforeLabel: t['admin.advertising.detail.changeBefore'](),
              afterLabel: t['admin.advertising.detail.changeAfter'](),
            }}
          />
        {/if}
      </section>
      {/if}
        {/snippet}
      </DetailShell>
    </Stack>
  {/if}
</Container>

<Dialog bind:open={publishOpen} titleText={t['admin.advertising.detail.publishTitle']()}>
  {#snippet children()}
    <Stack gap="4">
      <p>{t['admin.advertising.detail.publishDescription']({ name: campaign?.campaign.name ?? '' })}</p>
      <p>{t['admin.advertising.detail.publishBudget']({ budget })}</p>
      <Alert variant="warning">{t['admin.advertising.detail.publishConsequence']()}</Alert>
      {#if publishError}
        <Alert variant="error">{publishError}</Alert>
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button
      variant="ghost"
      onclick={() => {
        publishOpen = false
      }}
      disabled={publishRunning}
    >
      {t['common.cancel']()}
    </Button>
    <Button variant="primary" loading={publishRunning} onclick={() => void confirmPublish()}>
      {t['admin.advertising.detail.publishConfirm']()}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={resumeOpen} titleText={t['admin.advertising.campaigns.resumeTitle']()}>
  {#snippet children()}
    <Stack gap="4">
      <p>{t['admin.advertising.detail.resumeDescription']({ budget })}</p>
      {#if resumeError}
        <Alert variant="error">{resumeError}</Alert>
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button
      variant="ghost"
      onclick={() => {
        resumeOpen = false
      }}
      disabled={resumeRunning}
    >
      {t['common.cancel']()}
    </Button>
    <Button variant="primary" loading={resumeRunning} onclick={() => void confirmResume()}>
      {t['admin.advertising.campaigns.resumeConfirm']()}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-ad-detail__meta {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-detail__placeholder {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-detail__group {
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    padding: var(--sanvi-spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-ad-detail__group h3 {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-ad-detail__group-meta {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-detail__targeting {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-detail__ads {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-ad-detail__ads li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2);
    align-items: baseline;
  }

  .sanvi-ad-detail__ad-placement {
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-ad-detail__ad-url {
    color: var(--sanvi-color-text-secondary);
  }
</style>
