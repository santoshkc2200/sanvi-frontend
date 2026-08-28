<script lang="ts">
import {
  activateTenant,
  ApiError,
  applySubscriptionOverride,
  archiveTenant,
  getTenant,
  getTenantAdminView,
  grantEntitlementOverride,
  listAudit,
  listEntitlementOverrides,
  listFeatures,
  resumeTenant,
  revokeEntitlementOverride,
  revokeSubscriptionOverride,
  suspendTenant,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { handleLinkClick } from '@sanvi/spa-router'
import {
  Alert,
  AuditTrail,
  type AuditEntryRow,
  Badge,
  Button,
  Checkbox,
  Cluster,
  DangerousAction,
  DetailShell,
  type DetailShellTab,
  Dialog,
  EmptyState,
  ErrorView,
  Field,
  Input,
  showToast,
  Spinner,
  Stack,
  Textarea,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

interface Props {
  id: string
}

let { id }: Props = $props()

type TenantView = components['schemas']['TenantView']
type TenantAdminView = components['schemas']['TenantAdminView']
type Subscription = components['schemas']['SubscriptionView']
type FeatureView = components['schemas']['FeatureView']
type OverrideView = components['schemas']['OverrideView']
type EntitlementSource = components['schemas']['EntitlementSourceView']

interface EntitlementRow {
  feature: FeatureView
  override: OverrideView | undefined
  source: EntitlementSource
  enabled: boolean
  limit: number | null | undefined
}

const COPY = {
  loading: 'Loading',
  loadError: 'Could not load this tenant.',
  retry: 'Try again',
  backToTenants: 'Back to tenants',
  tabOverview: 'Overview',
  tabEntitlements: 'Entitlements',
  tabAudit: 'Audit',
  tabDanger: 'Danger zone',
  tabSubscription: 'Subscription',
  noSubscription: 'No active subscription for this tenant.',
  subPeriod: 'Current period',
  subOverrideTitle: 'Apply subscription override',
  subOverrideDesc: 'Pin this tenant to a specific plan outside Stripe billing.',
  subOverridePlanKey: 'Plan key',
  subOverridePlanPlaceholder: 'starter, professional, enterprise',
  subOverrideReason: 'Reason',
  subOverrideReasonPlaceholder: 'e.g. Enterprise pilot agreement',
  applyOverride: 'Apply override',
  revokeOverride: 'Revoke override',
  subOverrideApplied: 'Subscription override applied.',
  subOverrideRevoked: 'Subscription override revoked.',
  subOverrideError: 'Could not apply subscription override.',
  subRevokeError: 'Could not revoke subscription override.',
  tabDomains: 'Domains',
  tabDomainsReason: 'Ships in phase 08',
  metaTitle: 'Details',
  metaRegion: 'Region',
  metaLocale: 'Default locale',
  metaCreated: 'Created',
  metaMembers: 'Members',
  metaOverrides: 'Entitlement overrides',
  metaImpersonations: 'Active impersonations',
  overviewSlug: 'Slug',
  overviewStatus: 'Status',
  overviewSuspendedReason: 'Suspension reason',
  overviewUpdated: 'Last updated',
  overviewArchived: 'Archived',
  entitlementsEmpty: 'No features in the catalog yet.',
  entitlementsError: 'Could not load entitlements.',
  colFeature: 'Feature',
  colSource: 'Source',
  colStatus: 'Status',
  colLimit: 'Limit',
  colActions: 'Actions',
  grant: 'Grant',
  editOverride: 'Edit override',
  revoke: 'Revoke',
  grantTitle: (name: string) => `Grant ${name}`,
  enabledLabel: 'Enabled',
  limitLabel: 'Limit',
  limitPlaceholder: 'Unlimited',
  limitInvalid: 'The limit must be a non-negative whole number.',
  expiresAtLabel: 'Expires at',
  reasonLabel: 'Reason',
  reasonPlaceholder: 'Why is this override being granted?',
  cancel: 'Cancel',
  save: 'Save',
  granted: (feature: string) => `${feature} updated for this tenant.`,
  grantError: 'Could not save this entitlement override.',
  approvalRequiredTitle: 'Approval required',
  approvalRequiredDescription: 'This grant needs a second approval before it takes effect.',
  goToApprovals: 'Go to approvals',
  revokeTitle: (feature: string) => `Revoke ${feature}`,
  revokeConsequence:
    'This removes the tenant-specific override. The feature falls back to its plan or catalog default immediately.',
  revoked: (feature: string) => `${feature} override revoked.`,
  revokeError: 'Could not revoke this override.',
  auditEmpty: 'No audit activity for this tenant yet.',
  auditError: 'Could not load the audit log.',
  auditNext: 'Load more',
  activate: 'Activate',
  activateTitle: 'Activate tenant',
  activateConsequence: 'The tenant becomes reachable and can start serving traffic immediately.',
  activated: 'Tenant activated.',
  activateError: 'Could not activate this tenant.',
  suspend: 'Suspend',
  suspendTitle: 'Suspend tenant',
  suspendConsequence:
    'Every request to this tenant will be rejected with a 423 until it is resumed. Members will not be able to sign in to it.',
  suspendReasonPlaceholder: 'Select a reason',
  suspended: 'Tenant suspended.',
  suspendError: 'Could not suspend this tenant.',
  resume: 'Resume',
  resumeTitle: 'Resume tenant',
  resumeConsequence: 'The tenant immediately regains access.',
  resumed: 'Tenant resumed.',
  resumeError: 'Could not resume this tenant.',
  archive: 'Archive',
  archiveTitle: 'Archive tenant',
  archiveConsequence: (slug: string) =>
    `This is terminal — ${slug} becomes permanently inaccessible and cannot be reactivated from this console.`,
  archiveConfirmationLabel: 'Type the slug to confirm',
  archived: 'Tenant archived.',
  archiveError: 'Could not archive this tenant.',
  noLifecycleActions: 'This tenant is archived — no further lifecycle actions are available.',
}

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  provisioning: 'info',
  active: 'success',
  suspended: 'warning',
  archived: 'error',
}

const SOURCE_VARIANT: Record<EntitlementSource, 'neutral' | 'info' | 'success' | 'warning'> = {
  override: 'success',
  subscription: 'info',
  plan_default: 'neutral',
  feature_default: 'neutral',
}

const SOURCE_LABEL: Record<EntitlementSource, string> = {
  override: 'Override',
  subscription: 'Subscription',
  plan_default: 'Plan default',
  feature_default: 'Default',
}

let loadedTenantId = $state<string | undefined>(undefined)
let tenant = $state<TenantView | undefined>(undefined)
let adminView = $state<TenantAdminView | undefined>(undefined)
let loading = $state(true)
let loadError = $state<string | undefined>(undefined)

// Sequencing token — navigating from one tenant's detail page to another
// keeps this component instance mounted (`{#key}` only reacts to component
// identity), so both the reload and stale in-flight responses must be tied
// to the current `id`.
let loadSeq = 0

async function loadTenant(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  loadError = undefined
  try {
    const [tenantResult, adminResult] = await Promise.all([
      getTenant(apiClient, id),
      getTenantAdminView(apiClient, id),
    ])
    if (seq !== loadSeq) return
    tenant = tenantResult
    adminView = adminResult
  } catch {
    if (seq !== loadSeq) return
    loadError = COPY.loadError
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  // Navigating here from another tenant's detail page reuses this component
  // instance — every per-tenant cache below must reset, or tenant A's
  // entitlements and audit entries would render under tenant B.
  if (loadedTenantId !== id) {
    loadedTenantId = id
    entitlementsLoaded = false
    features = []
    overrides = []
    auditLoaded = false
    auditEntries = []
    auditCursor = undefined
    auditHasMore = false
    subscriptionLoaded = false
    subscription = undefined
    activeTab = 'overview'
  }
  void loadTenant()
})

let subscription = $state<Subscription | null | undefined>(undefined)
let subscriptionLoading = $state(false)
let subscriptionLoaded = $state(false)

async function loadSubscription(): Promise<void> {
  subscriptionLoading = true
  try {
    const res = await apiClient.GET('/api/v1/tenant/billing/subscription', {
      headers: { 'x-tenant-id': id },
    })
    subscription = res ?? null
    subscriptionLoaded = true
  } catch {
    subscription = null
    subscriptionLoaded = true
  } finally {
    subscriptionLoading = false
  }
}

$effect(() => {
  if (activeTab === 'subscription' && !subscriptionLoaded && !subscriptionLoading) {
    void loadSubscription()
  }
})

// This screen is a single route (`tenants/:id`), not itself sub-routed —
// the tab strip is in-page local state, not real navigation, so
// `DetailShell`'s `onNavigate` just switches `activeTab` instead of pushing
// history.
type TabId = 'overview' | 'entitlements' | 'audit' | 'danger' | 'subscription'
let activeTab = $state<TabId>('overview')

const TABS: DetailShellTab[] = [
  { href: 'overview', label: COPY.tabOverview },
  { href: 'entitlements', label: COPY.tabEntitlements },
  { href: 'subscription', label: COPY.tabSubscription },
  { href: 'audit', label: COPY.tabAudit },
  { href: 'danger', label: COPY.tabDanger },
  {
    href: 'domains',
    label: COPY.tabDomains,
    disabled: true,
    disabledReason: COPY.tabDomainsReason,
  },
]

function handleTabNavigate(event: MouseEvent, href: string): void {
  event.preventDefault()
  activeTab = href as TabId
}

// --- Entitlements ---------------------------------------------------------

let features = $state<FeatureView[]>([])
let overrides = $state<OverrideView[]>([])
let entitlementsLoaded = $state(false)
let entitlementsLoading = $state(false)
let entitlementsError = $state<string | undefined>(undefined)
let entitlementsSeq = 0

async function loadEntitlements(): Promise<void> {
  const seq = ++entitlementsSeq
  entitlementsLoading = true
  entitlementsError = undefined
  try {
    const [featureList, overrideList] = await Promise.all([
      listFeatures(apiClient),
      listEntitlementOverrides(apiClient, id),
    ])
    if (seq !== entitlementsSeq) return
    features = featureList
    overrides = overrideList
    entitlementsLoaded = true
  } catch {
    if (seq !== entitlementsSeq) return
    entitlementsError = COPY.entitlementsError
  } finally {
    if (seq === entitlementsSeq) entitlementsLoading = false
  }
}

$effect(() => {
  if (activeTab === 'entitlements' && !entitlementsLoaded) void loadEntitlements()
})

const entitlementRows = $derived<EntitlementRow[]>(
  features
    .filter((feature) => !feature.deprecated_at || overrides.some((o) => o.feature === feature.key))
    .map((feature) => {
      const override = overrides.find((o) => o.feature === feature.key)
      return override
        ? {
            feature,
            override,
            source: 'override' as const,
            enabled: override.enabled,
            limit: override.limit,
          }
        : {
            feature,
            override: undefined,
            source: 'feature_default' as const,
            enabled: feature.default_enabled,
            limit: feature.default_limit,
          }
    }),
)

let grantOpen = $state(false)
let grantTarget = $state<FeatureView | undefined>(undefined)
let grantEnabled = $state(true)
let grantLimit = $state('')
let grantExpiresAt = $state('')
let grantReason = $state('')
let grantSubmitting = $state(false)

function openGrant(row: EntitlementRow): void {
  grantTarget = row.feature
  grantEnabled = row.enabled
  grantLimit = row.limit != null ? String(row.limit) : ''
  grantExpiresAt = ''
  grantReason = ''
  grantOpen = true
}

// `Number("1,000")`/`Number("abc")` are NaN, and JSON.stringify turns NaN
// into null — i.e. a typo would silently store "unlimited quota". Reject
// anything that isn't a non-negative integer before it reaches the API.
const grantLimitInvalid = $derived(
  grantLimit.trim() !== '' &&
    (!/^\d+$/.test(grantLimit.trim()) || !Number.isSafeInteger(Number(grantLimit))),
)

// Plan security requirement: reason fields are required — a grant without
// a captured "why" must not be submittable.
const grantReasonValid = $derived(grantReason.trim().length > 0)

async function submitGrant(): Promise<void> {
  if (!grantTarget || grantLimitInvalid || !grantReasonValid) return
  grantSubmitting = true
  try {
    const result = await grantEntitlementOverride(apiClient, id, {
      feature_key: grantTarget.key,
      enabled: grantEnabled,
      limit: grantLimit.trim() ? Number(grantLimit) : null,
      expires_at: grantExpiresAt ? new Date(grantExpiresAt).toISOString() : null,
      reason: grantReason.trim() || null,
    })
    grantOpen = false
    if (result === 'granted') {
      showToast({ variant: 'success', title: COPY.granted(grantTarget.name) })
      entitlementsLoaded = false
      await loadEntitlements()
    } else {
      showToast({
        variant: 'info',
        title: COPY.approvalRequiredTitle,
        description: COPY.approvalRequiredDescription,
      })
    }
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.grantError,
      description: err instanceof ApiError ? err.detail : undefined,
    })
  } finally {
    grantSubmitting = false
  }
}

let revokeOpen = $state(false)
let revokeTarget = $state<FeatureView | undefined>(undefined)
let revokeSubmitting = $state(false)

function openRevoke(feature: FeatureView): void {
  revokeTarget = feature
  revokeOpen = true
}

async function confirmRevoke(): Promise<void> {
  if (!revokeTarget) return
  revokeSubmitting = true
  try {
    await revokeEntitlementOverride(apiClient, id, revokeTarget.key)
    revokeOpen = false
    showToast({ variant: 'success', title: COPY.revoked(revokeTarget.name) })
    entitlementsLoaded = false
    await loadEntitlements()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.revokeError,
      description: err instanceof ApiError ? err.detail : undefined,
    })
  } finally {
    revokeSubmitting = false
  }
}

// --- Audit ------------------------------------------------------------

let auditEntries = $state<AuditEntryRow[]>([])
let auditCursor = $state<number | undefined>(undefined)
let auditHasMore = $state(false)
let auditLoaded = $state(false)
let auditLoading = $state(false)
let auditError = $state<string | undefined>(undefined)
let auditSeq = 0

function toAuditRow(entry: components['schemas']['AuditEntry']): AuditEntryRow {
  return {
    id: entry.id,
    occurredAt: entry.occurred_at,
    actorLabel: entry.actor_id ? `${entry.actor_type} ${entry.actor_id}` : entry.actor_type,
    action: entry.action,
    resourceLabel: entry.resource_type
      ? `${entry.resource_type}${entry.resource_id ? ` ${entry.resource_id}` : ''}`
      : undefined,
    before: (entry.before as Record<string, unknown> | null) ?? undefined,
    after: (entry.after as Record<string, unknown> | null) ?? undefined,
  }
}

async function loadAudit(append: boolean): Promise<void> {
  const seq = ++auditSeq
  auditLoading = true
  auditError = undefined
  try {
    const page = await listAudit(apiClient, {
      tenant_id: id,
      limit: 25,
      after: append ? auditCursor : undefined,
    })
    if (seq !== auditSeq) return
    auditEntries = append
      ? [...auditEntries, ...page.entries.map(toAuditRow)]
      : page.entries.map(toAuditRow)
    auditCursor = page.next_cursor ?? undefined
    auditHasMore = page.next_cursor != null
    auditLoaded = true
  } catch {
    if (seq !== auditSeq) return
    auditError = COPY.auditError
  } finally {
    if (seq === auditSeq) auditLoading = false
  }
}

$effect(() => {
  if (activeTab === 'audit' && !auditLoaded) void loadAudit(false)
})

// --- Lifecycle ----------------------------------------------------------

// The backend validates the suspend reason against this exact vocabulary
// (400 on anything else) — the dialog must offer the enum, not free text.
const SUSPENSION_REASON_OPTIONS = [
  { value: 'billing', label: 'Billing' },
  { value: 'abuse', label: 'Abuse' },
  { value: 'legal', label: 'Legal' },
  { value: 'operational', label: 'Operational' },
]

let activateOpen = $state(false)
let resumeOpen = $state(false)
let suspendOpen = $state(false)
let archiveOpen = $state(false)
let lifecycleSubmitting = $state(false)
let lifecycleError = $state<string | undefined>(undefined)

// One shared error state backs all four dialogs — clear it when a dialog
// opens so a failed action's message can't leak into a different dialog.
function openActivate(): void {
  lifecycleError = undefined
  activateOpen = true
}
function openResume(): void {
  lifecycleError = undefined
  resumeOpen = true
}
function openSuspend(): void {
  lifecycleError = undefined
  suspendOpen = true
}
function openArchive(): void {
  lifecycleError = undefined
  archiveOpen = true
}

async function runLifecycle(
  action: () => Promise<unknown>,
  successTitle: string,
  errorTitle: string,
): Promise<void> {
  lifecycleSubmitting = true
  lifecycleError = undefined
  try {
    await action()
    activateOpen = false
    resumeOpen = false
    suspendOpen = false
    archiveOpen = false
    showToast({ variant: 'success', title: successTitle })
    await loadTenant()
  } catch (err) {
    lifecycleError = err instanceof ApiError ? err.detail : undefined
    showToast({ variant: 'error', title: errorTitle, description: lifecycleError })
  } finally {
    lifecycleSubmitting = false
  }
}

async function confirmActivate(): Promise<void> {
  await runLifecycle(() => activateTenant(apiClient, id), COPY.activated, COPY.activateError)
}
async function confirmResume(): Promise<void> {
  await runLifecycle(() => resumeTenant(apiClient, id), COPY.resumed, COPY.resumeError)
}
async function confirmSuspend(reason: string): Promise<void> {
  await runLifecycle(
    () => suspendTenant(apiClient, id, { reason }),
    COPY.suspended,
    COPY.suspendError,
  )
}
async function confirmArchive(): Promise<void> {
  await runLifecycle(() => archiveTenant(apiClient, id), COPY.archived, COPY.archiveError)
}

let overrideDialogOpen = $state(false)
let overridePlanKey = $state('professional')
let overrideReason = $state('')
let overrideSubmitting = $state(false)
let overrideError = $state<string | undefined>(undefined)

let revokeSubDialogOpen = $state(false)
let revokeSubSubmitting = $state(false)

const hasOverride = $derived(subscription?.source === 'override')

async function handleApplySubscriptionOverride(): Promise<void> {
  if (!overridePlanKey.trim() || !overrideReason.trim()) {
    overrideError = 'Please specify both plan key and reason.'
    return
  }
  overrideSubmitting = true
  overrideError = undefined
  try {
    await applySubscriptionOverride(apiClient, id, {
      plan_key: overridePlanKey.trim(),
      reason: overrideReason.trim(),
    })
    overrideDialogOpen = false
    showToast({ title: COPY.subOverrideApplied, variant: 'success' })
    await Promise.all([loadTenant(), loadSubscription()])
  } catch {
    overrideError = COPY.subOverrideError
  } finally {
    overrideSubmitting = false
  }
}

async function handleRevokeSubscriptionOverride(): Promise<void> {
  revokeSubSubmitting = true
  try {
    await revokeSubscriptionOverride(apiClient, id)
    revokeSubDialogOpen = false
    showToast({ title: COPY.subOverrideRevoked, variant: 'success' })
    await Promise.all([loadTenant(), loadSubscription()])
  } catch {
    showToast({ title: COPY.subRevokeError, variant: 'error' })
  } finally {
    revokeSubSubmitting = false
  }
}
</script>

{#snippet statusBadge()}
  {#if tenant}
    <Badge variant={STATUS_VARIANT[tenant.status] ?? 'neutral'}>{tenant.status}</Badge>
  {/if}
{/snippet}

{#snippet metaPanel()}
  <Stack gap="3">
    <h2>{COPY.metaTitle}</h2>
    {#if tenant}
      <p><strong>{COPY.metaRegion}:</strong> {tenant.region}</p>
      <p><strong>{COPY.metaLocale}:</strong> {tenant.default_locale}</p>
      <p><strong>{COPY.metaCreated}:</strong> <time datetime={tenant.created_at}>{tenant.created_at}</time></p>
    {/if}
    {#if adminView}
      <p><strong>{COPY.metaMembers}:</strong> {adminView.member_count}</p>
      <p><strong>{COPY.metaOverrides}:</strong> {adminView.override_count}</p>
      <p><strong>{COPY.metaImpersonations}:</strong> {adminView.active_impersonations}</p>
    {/if}
  </Stack>
{/snippet}

{#snippet featureCell(row: EntitlementRow)}
  <div>
    <strong>{row.feature.name}</strong>
    <div class="sanvi-tenant-detail__feature-key">{row.feature.key}</div>
  </div>
{/snippet}

{#if loading}
  <Spinner label={COPY.loading} />
{:else if loadError || !tenant}
  <ErrorView title={loadError ?? COPY.loadError} retryLabel={COPY.retry} onRetry={loadTenant} />
{:else}
  <DetailShell
    title={tenant.display_name}
    subtitle={tenant.slug}
    {statusBadge}
    tabs={TABS}
    activeHref={activeTab}
    onNavigate={handleTabNavigate}
    meta={metaPanel}
    backHref="/tenants"
    backLabel={COPY.backToTenants}
    onNavigateBack={(event) => handleLinkClick(event, '/tenants')}
  >
    {#snippet children()}
      {#if tenant}
      {#if activeTab === 'overview'}
        <Stack gap="3">
          <p><strong>{COPY.overviewSlug}:</strong> {tenant.slug}</p>
          <p><strong>{COPY.overviewStatus}:</strong> {tenant.status}</p>
          {#if tenant.suspended_reason}
            <p><strong>{COPY.overviewSuspendedReason}:</strong> {tenant.suspended_reason}</p>
          {/if}
          <p>
            <strong>{COPY.overviewUpdated}:</strong>
            <time datetime={tenant.updated_at}>{tenant.updated_at}</time>
          </p>
          {#if tenant.archived_at}
            <p>
              <strong>{COPY.overviewArchived}:</strong>
              <time datetime={tenant.archived_at}>{tenant.archived_at}</time>
            </p>
          {/if}
        </Stack>
      {:else if activeTab === 'entitlements'}
        {#if entitlementsLoading}
          <Spinner label={COPY.loading} />
        {:else if entitlementsError}
          <ErrorView title={entitlementsError} retryLabel={COPY.retry} onRetry={loadEntitlements} />
        {:else if entitlementRows.length === 0}
          <EmptyState title={COPY.entitlementsEmpty} />
        {:else}
          <table class="sanvi-tenant-detail__table">
            <thead>
              <tr>
                <th scope="col">{COPY.colFeature}</th>
                <th scope="col">{COPY.colSource}</th>
                <th scope="col">{COPY.colStatus}</th>
                <th scope="col">{COPY.colLimit}</th>
                <th scope="col"><span class="sanvi-visually-hidden">{COPY.colActions}</span></th>
              </tr>
            </thead>
            <tbody>
              {#each entitlementRows as row (row.feature.key)}
                <tr>
                  <td>{@render featureCell(row)}</td>
                  <td><Badge variant={SOURCE_VARIANT[row.source]}>{SOURCE_LABEL[row.source]}</Badge></td>
                  <td>{row.enabled ? COPY.enabledLabel : '—'}</td>
                  <td>{row.limit ?? '—'}</td>
                  <td>
                    <Stack gap="2" align="end">
                      <Button variant="ghost" size="sm" onclick={() => openGrant(row)}>
                        {row.override ? COPY.editOverride : COPY.grant}
                      </Button>
                      {#if row.override}
                        <Button variant="ghost" size="sm" onclick={() => openRevoke(row.feature)}>
                          {COPY.revoke}
                        </Button>
                      {/if}
                    </Stack>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {:else if activeTab === 'subscription'}
        <Stack gap="6">
          <div class="sanvi-tenant-detail__sub-card">
            <Stack gap="4">
              <div class="sanvi-tenant-detail__sub-header">
                <h3>{COPY.tabSubscription}</h3>
              </div>

              {#if subscriptionLoading}
                <Spinner label={COPY.loading} />
              {:else if subscription}
                <Stack gap="2">
                  <p>
                    <strong>{COPY.overviewStatus}:</strong>
                    <Badge variant={subscription.source === 'override' ? 'warning' : 'success'}>
                      {subscription.plan_name ?? subscription.plan_key} ({subscription.source})
                    </Badge>
                  </p>
                  {#if subscription.current_period?.start && subscription.current_period?.end}
                    <p>
                      <strong>{COPY.subPeriod}:</strong>
                      <time datetime={subscription.current_period.start}>{subscription.current_period.start.slice(0, 10)}</time>
                      –
                      <time datetime={subscription.current_period.end}>{subscription.current_period.end.slice(0, 10)}</time>
                    </p>
                  {/if}
                </Stack>
              {:else}
                <p class="sanvi-tenant-detail__muted">{COPY.noSubscription}</p>
              {/if}

              <p class="sanvi-tenant-detail__muted">{COPY.subOverrideDesc}</p>

              <Cluster gap="3">
                <Button variant="primary" onclick={() => { overrideDialogOpen = true }}>
                  {COPY.applyOverride}
                </Button>
                <Button
                  variant="danger"
                  disabled={!hasOverride}
                  onclick={() => { revokeSubDialogOpen = true }}
                >
                  {COPY.revokeOverride}
                </Button>
              </Cluster>
            </Stack>
          </div>
        </Stack>
      {:else if activeTab === 'audit'}
        {#if auditError}
          <ErrorView title={auditError} retryLabel={COPY.retry} onRetry={() => loadAudit(false)} />
        {:else}
          <Stack gap="3">
            <AuditTrail entries={auditEntries} loading={auditLoading && auditEntries.length === 0} emptyMessage={COPY.auditEmpty} />
            {#if auditHasMore}
              <Button variant="ghost" size="sm" loading={auditLoading} onclick={() => loadAudit(true)}>
                {COPY.auditNext}
              </Button>
            {/if}
          </Stack>
        {/if}
      {:else if activeTab === 'danger'}
        <Stack gap="4">
          {#if tenant.status === 'archived'}
            <p>{COPY.noLifecycleActions}</p>
          {:else}
            <Stack gap="2" align="start">
              {#if tenant.status === 'provisioning'}
                <Button variant="secondary" onclick={openActivate}>{COPY.activate}</Button>
              {/if}
              {#if tenant.status === 'suspended'}
                <Button variant="secondary" onclick={openResume}>{COPY.resume}</Button>
              {/if}
              {#if tenant.status === 'active'}
                <Button variant="danger" onclick={openSuspend}>{COPY.suspend}</Button>
              {/if}
              <Button variant="danger" onclick={openArchive}>{COPY.archive}</Button>
            </Stack>
          {/if}
        </Stack>
      {/if}
      {/if}
    {/snippet}
  </DetailShell>
{/if}

<Dialog bind:open={activateOpen} titleText={COPY.activateTitle}>
  {#snippet children()}
    <p>{COPY.activateConsequence}</p>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (activateOpen = false)}>{COPY.cancel}</Button>
    <Button variant="primary" loading={lifecycleSubmitting} onclick={confirmActivate}>{COPY.activate}</Button>
  {/snippet}
</Dialog>

<Dialog bind:open={resumeOpen} titleText={COPY.resumeTitle}>
  {#snippet children()}
    <p>{COPY.resumeConsequence}</p>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (resumeOpen = false)}>{COPY.cancel}</Button>
    <Button variant="primary" loading={lifecycleSubmitting} onclick={confirmResume}>{COPY.resume}</Button>
  {/snippet}
</Dialog>

<DangerousAction
  bind:open={suspendOpen}
  titleText={COPY.suspendTitle}
  consequence={COPY.suspendConsequence}
  reasonLabel={COPY.reasonLabel}
  reasonPlaceholder={COPY.suspendReasonPlaceholder}
  reasonOptions={SUSPENSION_REASON_OPTIONS}
  submitting={lifecycleSubmitting}
  errorMessage={lifecycleError}
  onConfirm={confirmSuspend}
  onCancel={() => (suspendOpen = false)}
/>

<DangerousAction
  bind:open={archiveOpen}
  titleText={COPY.archiveTitle}
  consequence={tenant ? COPY.archiveConsequence(tenant.slug) : ''}
  confirmationPhrase={tenant?.slug}
  confirmationLabel={COPY.archiveConfirmationLabel}
  submitting={lifecycleSubmitting}
  errorMessage={lifecycleError}
  onConfirm={confirmArchive}
  onCancel={() => (archiveOpen = false)}
/>

<Dialog bind:open={grantOpen} titleText={grantTarget ? COPY.grantTitle(grantTarget.name) : ''}>
  {#snippet children()}
    <Stack gap="3">
      <Checkbox checked={grantEnabled} onchange={(event) => (grantEnabled = event.currentTarget.checked)}>
        {COPY.enabledLabel}
      </Checkbox>
      {#if grantTarget?.kind === 'quota'}
        <Field label={COPY.limitLabel}>
          {#snippet children({ id })}
            <Input {id} type="text" bind:value={grantLimit} placeholder={COPY.limitPlaceholder} />
          {/snippet}
        </Field>
        {#if grantLimitInvalid}
          <Alert variant="error">{COPY.limitInvalid}</Alert>
        {/if}
      {/if}
      <Field label={COPY.expiresAtLabel}>
        {#snippet children({ id })}
          <input
            id={id}
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            bind:value={grantExpiresAt}
            class="sanvi-tenant-detail__date-input"
          />
        {/snippet}
      </Field>
      <Field label={COPY.reasonLabel} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={grantReason} placeholder={COPY.reasonPlaceholder} required />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (grantOpen = false)}>{COPY.cancel}</Button>
    <Button
      variant="primary"
      loading={grantSubmitting}
      disabled={grantLimitInvalid || !grantReasonValid}
      onclick={submitGrant}
    >
      {COPY.save}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={revokeOpen} titleText={revokeTarget ? COPY.revokeTitle(revokeTarget.name) : ''}>
  {#snippet children()}
    <p>{COPY.revokeConsequence}</p>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (revokeOpen = false)}>{COPY.cancel}</Button>
    <Button variant="danger" loading={revokeSubmitting} onclick={confirmRevoke}>{COPY.revoke}</Button>
  {/snippet}
</Dialog>

<Dialog bind:open={overrideDialogOpen} titleText={COPY.subOverrideTitle}>
  {#snippet children()}
    <Stack gap="4">
      <p>{COPY.subOverrideDesc}</p>
      {#if overrideError}
        <Alert variant="error">{overrideError}</Alert>
      {/if}
      <Field label={COPY.subOverridePlanKey} required>
        {#snippet children(controlProps)}
          <Input
            {...controlProps}
            value={overridePlanKey}
            placeholder={COPY.subOverridePlanPlaceholder}
            oninput={(e) => { overridePlanKey = (e.target as HTMLInputElement).value }}
          />
        {/snippet}
      </Field>
      <Field label={COPY.subOverrideReason} required>
        {#snippet children(controlProps)}
          <Textarea
            {...controlProps}
            value={overrideReason}
            placeholder={COPY.subOverrideReasonPlaceholder}
            oninput={(e) => { overrideReason = (e.target as HTMLTextAreaElement).value }}
          />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (overrideDialogOpen = false)}>{COPY.cancel}</Button>
    <Button
      variant="primary"
      loading={overrideSubmitting}
      disabled={!overridePlanKey || !overrideReason}
      onclick={handleApplySubscriptionOverride}
    >
      {COPY.save}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={revokeSubDialogOpen} titleText={COPY.revokeOverride}>
  {#snippet children()}
    <p>{COPY.revokeConsequence}</p>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (revokeSubDialogOpen = false)}>{COPY.cancel}</Button>
    <Button
      variant="danger"
      loading={revokeSubSubmitting}
      onclick={handleRevokeSubscriptionOverride}
    >
      {COPY.revokeOverride}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-tenant-detail__sub-card {
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-tenant-detail__sub-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sanvi-tenant-detail__sub-header h3 {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
  }

  .sanvi-tenant-detail__muted {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-tenant-detail__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-tenant-detail__table th,
  .sanvi-tenant-detail__table td {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    text-align: start;
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-tenant-detail__feature-key {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-tenant-detail__date-input {
    width: 100%;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
