<script lang="ts">
import {
  activateTenant,
  ApiError,
  archiveTenant,
  getTenant,
  getTenantAdminView,
  grantEntitlementOverride,
  listAudit,
  listEntitlementOverrides,
  listFeatures,
  resumeTenant,
  revokeEntitlementOverride,
  suspendTenant,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { handleLinkClick } from '@sanvi/spa-router'
import {
  AuditTrail,
  type AuditEntryRow,
  Badge,
  Button,
  Checkbox,
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
  tabSubscriptionReason: 'Ships in phase 04',
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

let tenant = $state<TenantView | undefined>(undefined)
let adminView = $state<TenantAdminView | undefined>(undefined)
let loading = $state(true)
let loadError = $state<string | undefined>(undefined)

async function loadTenant(): Promise<void> {
  loading = true
  loadError = undefined
  try {
    const [tenantResult, adminResult] = await Promise.all([
      getTenant(apiClient, id),
      getTenantAdminView(apiClient, id),
    ])
    tenant = tenantResult
    adminView = adminResult
  } catch {
    loadError = COPY.loadError
  } finally {
    loading = false
  }
}

$effect(() => {
  void id
  void loadTenant()
})

// This screen is a single route (`tenants/:id`), not itself sub-routed —
// the tab strip is in-page local state, not real navigation, so
// `DetailShell`'s `onNavigate` just switches `activeTab` instead of pushing
// history.
type TabId = 'overview' | 'entitlements' | 'audit' | 'danger'
let activeTab = $state<TabId>('overview')

const TABS: DetailShellTab[] = [
  { href: 'overview', label: COPY.tabOverview },
  { href: 'entitlements', label: COPY.tabEntitlements },
  { href: 'audit', label: COPY.tabAudit },
  { href: 'danger', label: COPY.tabDanger },
  {
    href: 'subscription',
    label: COPY.tabSubscription,
    disabled: true,
    disabledReason: COPY.tabSubscriptionReason,
  },
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

async function loadEntitlements(): Promise<void> {
  entitlementsLoading = true
  entitlementsError = undefined
  try {
    const [featureList, overrideList] = await Promise.all([
      listFeatures(apiClient),
      listEntitlementOverrides(apiClient, id),
    ])
    features = featureList
    overrides = overrideList
    entitlementsLoaded = true
  } catch {
    entitlementsError = COPY.entitlementsError
  } finally {
    entitlementsLoading = false
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

async function submitGrant(): Promise<void> {
  if (!grantTarget) return
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
  auditLoading = true
  auditError = undefined
  try {
    const page = await listAudit(apiClient, {
      tenant_id: id,
      limit: 25,
      after: append ? auditCursor : undefined,
    })
    auditEntries = append
      ? [...auditEntries, ...page.entries.map(toAuditRow)]
      : page.entries.map(toAuditRow)
    auditCursor = page.next_cursor ?? undefined
    auditHasMore = page.next_cursor != null
    auditLoaded = true
  } catch {
    auditError = COPY.auditError
  } finally {
    auditLoading = false
  }
}

$effect(() => {
  if (activeTab === 'audit' && !auditLoaded) void loadAudit(false)
})

// --- Lifecycle ----------------------------------------------------------

let activateOpen = $state(false)
let resumeOpen = $state(false)
let suspendOpen = $state(false)
let archiveOpen = $state(false)
let lifecycleSubmitting = $state(false)
let lifecycleError = $state<string | undefined>(undefined)

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
                <Button variant="secondary" onclick={() => (activateOpen = true)}>{COPY.activate}</Button>
              {/if}
              {#if tenant.status === 'suspended'}
                <Button variant="secondary" onclick={() => (resumeOpen = true)}>{COPY.resume}</Button>
              {/if}
              {#if tenant.status === 'active'}
                <Button variant="danger" onclick={() => (suspendOpen = true)}>{COPY.suspend}</Button>
              {/if}
              <Button variant="danger" onclick={() => (archiveOpen = true)}>{COPY.archive}</Button>
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
      {/if}
      <Field label={COPY.expiresAtLabel}>
        {#snippet children({ id })}
          <input id={id} type="date" bind:value={grantExpiresAt} class="sanvi-tenant-detail__date-input" />
        {/snippet}
      </Field>
      <Field label={COPY.reasonLabel}>
        {#snippet children({ id })}
          <Textarea {id} bind:value={grantReason} placeholder={COPY.reasonPlaceholder} />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (grantOpen = false)}>{COPY.cancel}</Button>
    <Button variant="primary" loading={grantSubmitting} onclick={submitGrant}>{COPY.save}</Button>
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

<style>
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
