<script lang="ts">
import { ApiError, listAdPlatforms } from '@sanvi/api-client'
import type { PlatformView } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  AdPlatformCard,
  Alert,
  Button,
  Container,
  EmptyState,
  Spinner,
  Stack,
  UpgradePrompt,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

/**
 * The phase-10 advertising settings page. Since TASK-010 it renders the
 * registry-derived platform catalog: one {@link AdPlatformCard} per
 * platform, with each platform's entitlement and connection state read from
 * the catalog entry itself — the page spells no platform key and no
 * entitlement key, so a platform the backend registers renders here with no
 * frontend change. Non-entitled platforms stay listed with their upgrade
 * path rather than disappearing.
 *
 * Without any advertising entitlement the catalog endpoint answers 403 and
 * the page falls back to the `UpgradePrompt`; with the flag off the route is
 * absent (404) and the same fallback stands in for "not there yet".
 *
 * Since TASK-011 the connect action routes to the connections screen
 * (`/advertising/connections`) — the credential screen where the OAuth
 * handoff, health states, and disconnect live — rather than into the flow
 * directly, so the scope explainer is always seen before any grant.
 */
let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let platforms = $state<PlatformView[]>([])

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never answer for the new one.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  platforms = []

  try {
    const result = await listAdPlatforms(apiClient)
    if (seq !== loadSeq) return
    platforms = result?.platforms ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      // 403: no platform entitlement; 404: the advertising flag is off and
      // the route does not exist — the feature is simply not there.
      entitled = false
      platforms = []
    } else {
      error = t['admin.advertising.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

function retry(): void {
  void load()
}

/**
 * Per-platform entitlement comes from the catalog's own
 * `upgrade_required`/`available` state — computed by the backend from the
 * same grants `hasFeature` reads locally, but authoritative and already in
 * hand, so the page never hardcodes an entitlement key to check.
 */
function platformEntitled(platform: PlatformView): boolean {
  return platform.available && !platform.upgrade_required
}

/**
 * Localized labels for matrix values (objectives, placements), keyed by the
 * value itself. Values the catalogs have no entry for resolve to their raw
 * value — the card humanizes that fallback, so a newly registered
 * objective still renders while its translation is on its way.
 */
function optionLabelsFor(platform: PlatformView): Record<string, string> {
  const tMap = t as unknown as Record<string, () => string>
  const values = [
    ...platform.capability_matrix.objectives,
    ...platform.capability_matrix.creative_placements.map((placement) => placement.key),
  ]
  return Object.fromEntries(
    values.map((value) => {
      const key = `admin.advertising.option.${value}`
      return [value, typeof tMap[key] === 'function' ? tMap[key]() : value]
    }),
  )
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.title']()}</h1>
      <p>{t['admin.advertising.description']()}</p>
      <Button variant="secondary" onclick={() => navigate('/advertising/connections')}>
        {t['admin.advertising.manageConnectionsCta']()}
      </Button>
    </div>

    {#if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={retry}>{t['common.retry']()}</Button>
      </Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.advertising.loading']()} />
    {:else if !entitled}
      <UpgradePrompt
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else if platforms.length === 0}
      <EmptyState
        title={t['admin.advertising.empty']()}
        description={t['admin.advertising.emptyDescription']()}
      />
    {:else}
      <!-- A plain wrapper, not a named <section>: a named section is a region
           landmark, and the per-card UpgradePrompt's <aside> (a complementary
           landmark) must stay top-level. -->
      <div>
        <Stack gap="4">
          <h2>{t['admin.advertising.platformsHeading']()}</h2>
          {#each platforms as platform (platform.key)}
            <AdPlatformCard
              platform={platform}
              entitled={platformEntitled(platform)}
              optionLabels={optionLabelsFor(platform)}
              connectionLabels={{
                connected: t['admin.advertising.connectedBadge'](),
                not_connected: t['admin.advertising.notConnectedBadge'](),
              }}
              connectionTones={{ connected: 'success' }}
              labels={{
                connectCta: t['admin.advertising.connectCta'](),
                upgradeTitle: t['admin.advertising.upgradeTitle'](),
                upgradeDescription: t['admin.advertising.cardUpgradeDescription']({
                  platform: platform.display_name,
                }),
                upgradeCtaLabel: t['admin.advertising.upgradeCtaLabel'](),
                capabilitiesLabel: t['admin.advertising.capabilitiesLabel'](),
                objectivesLabel: t['admin.advertising.objectivesLabel'](),
                placementsLabel: t['admin.advertising.placementsLabel'](),
                unavailableTitle: t['admin.advertising.unavailableTitle'](),
                unavailableDescription: t['admin.advertising.unavailableDescription'](),
              }}
              onConnect={() => navigate('/advertising/connections')}
            />
          {/each}
        </Stack>
      </div>
    {/if}
  </Stack>
</Container>
