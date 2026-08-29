<script lang="ts">
import {
  createPortalSession,
  getSubscription,
  listInvoices,
  listPublicPlans,
  listTenantEntitlements,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  DetailShell,
  Dialog,
  EmptyState,
  Spinner,
  Stack,
  StatCard,
  Table,
  UsageMeter,
} from '@sanvi/ui'
import type { DetailShellTab } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type Subscription = components['schemas']['SubscriptionView']
type Invoice = components['schemas']['InvoiceView']
type PublicPlan = components['schemas']['PublicPlanView']
type Entitlement = components['schemas']['ResolvedEntitlementView']

let activeTab = $state<'overview' | 'usage' | 'plans' | 'invoices' | 'cancel'>('overview')
let subscription = $state<Subscription | null | undefined>(undefined)
let invoices = $state<Invoice[]>([])
let plans = $state<PublicPlan[]>([])
let entitlements = $state<Entitlement[]>([])

let loading = $state(true)
let error = $state<string | undefined>(undefined)
let portalLoading = $state(false)
let portalError = $state<string | undefined>(undefined)

let loadSeq = 0

async function loadBillingData(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const [subResult, invResult, plansResult, entResult] = await Promise.all([
      getSubscription(apiClient),
      listInvoices(apiClient).catch(() => []),
      listPublicPlans(apiClient).catch(() => []),
      listTenantEntitlements(apiClient).catch(() => []),
    ])

    if (seq !== loadSeq) return
    subscription = subResult
    invoices = invResult ?? []
    plans = plansResult ?? []
    entitlements = entResult ?? []
  } catch {
    if (seq !== loadSeq) return
    error = t['admin.billing.genericError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void loadBillingData()
})

async function openCustomerPortal(): Promise<void> {
  portalLoading = true
  portalError = undefined
  try {
    const result = await createPortalSession(apiClient, {
      return_url: window.location.href,
    })
    if (result?.url) {
      window.location.href = result.url
    } else {
      portalError = t['admin.billing.portalError']()
    }
  } catch {
    portalError = t['admin.billing.portalError']()
  } finally {
    portalLoading = false
  }
}

const TABS: DetailShellTab[] = $derived([
  { href: 'overview', label: t['admin.billing.tabOverview']() },
  { href: 'usage', label: t['admin.billing.tabUsage']() },
  { href: 'plans', label: t['admin.billing.tabChangePlan']() },
  { href: 'invoices', label: t['admin.billing.tabInvoices']() },
  { href: 'cancel', label: t['admin.billing.tabCancel']() },
])

function handleTabNavigate(event: MouseEvent, href: string): void {
  event.preventDefault()
  activeTab = href as typeof activeTab
}

const quotaEntitlements = $derived(entitlements.filter((e) => e.kind === 'quota'))
const featureEntitlements = $derived(entitlements.filter((e) => e.kind === 'boolean'))

const trialDaysRemaining = $derived(() => {
  if (!subscription?.trial_end) return 0
  const end = new Date(subscription.trial_end).getTime()
  const now = Date.now()
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
})

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return fmt.date(dateStr, 'medium')
}
</script>

<svelte:head>
  <title>{t['admin.billing.pageTitle']()}</title>
</svelte:head>

<DetailShell
  title={t['admin.billing.pageTitle']()}
  subtitle={t['admin.billing.pageDescription']()}
  tabs={TABS}
  activeHref={activeTab}
  onNavigate={handleTabNavigate}
>
  {#if portalError}
    <Alert variant="error">{portalError}</Alert>
  {/if}

  {#if loading}
    <Spinner label={t['admin.billing.loading']()} />
  {:else if error}
    <Alert variant="error">{error}</Alert>
  {:else if !subscription}
    <EmptyState title={t['admin.billing.noSubscription']()} description={t['admin.billing.noSubscriptionDesc']()}>
      {#snippet action()}
        <a class="sanvi-billing__cta-link" href="/onboarding">{t['admin.billing.choosePlanCta']()}</a>
      {/snippet}
    </EmptyState>
  {:else}
    <!-- Tab 1: Overview -->
    {#if activeTab === 'overview'}
      <Stack gap="6">
        {#if subscription.collection_state === 'dunning'}
          <Alert variant="error" title={t['admin.billing.pastDueWarning']()}>
            <Button variant="danger" loading={portalLoading} onclick={openCustomerPortal}>
              {t['admin.billing.managePaymentCta']()}
            </Button>
          </Alert>
        {/if}

        {#if subscription.status === 'trialing' && subscription.trial_end}
          <Alert variant="info">
            {t['admin.billing.trialEndingNotice']({ days: trialDaysRemaining(), date: formatDateTime(subscription.trial_end) })}
          </Alert>
        {/if}

        {#if subscription.cancel_at_period_end && subscription.current_period?.end}
          <Alert variant="warning">
            <Stack gap="2">
              <p>{t['admin.billing.canceledNotice']({ date: formatDateTime(subscription.current_period.end) })}</p>
              <div>
                <Button variant="primary" loading={portalLoading} onclick={openCustomerPortal}>
                  {t['admin.billing.reactivateCta']()}
                </Button>
              </div>
            </Stack>
          </Alert>
        {/if}

        <div class="sanvi-billing__card">
          <Stack gap="4">
            <div class="sanvi-billing__card-header">
              <h2>{t['admin.billing.currentPlanTitle']()}</h2>
              <Cluster gap="2">
                <Badge variant={subscription.status === 'active' ? 'success' : subscription.status === 'trialing' ? 'info' : 'warning'}>
                  {subscription.status}
                </Badge>
                {#if subscription.collection_state !== 'ok'}
                  <Badge variant="error">{subscription.collection_state}</Badge>
                {/if}
              </Cluster>
            </div>

            <div class="sanvi-billing__grid">
              <StatCard label={t['admin.billing.planLabel']()} value={subscription.plan_name} />
              <StatCard
                label={t['admin.billing.renewalLabel']()}
                value={formatDateTime(subscription.current_period?.end)}
              />
            </div>
          </Stack>
        </div>

        <div class="sanvi-billing__card">
          <Stack gap="3">
            <h2>{t['admin.billing.paymentMethodTitle']()}</h2>
            <p class="sanvi-billing__muted">{t['admin.billing.paymentMethodDesc']()}</p>
            <div>
              <Button variant="secondary" loading={portalLoading} onclick={openCustomerPortal}>
                {t['admin.billing.managePaymentCta']()}
              </Button>
            </div>
          </Stack>
        </div>
      </Stack>

    <!-- Tab 2: Usage & Quotas -->
    {:else if activeTab === 'usage'}
      <Stack gap="6">
        <div>
          <h2>{t['admin.billing.quotaTitle']()}</h2>
          <div class="sanvi-billing__quota-grid">
            {#each quotaEntitlements as q (q.feature)}
              <StatCard
                label={q.feature}
                value={q.limit === null || q.limit === undefined ? t['admin.billing.unlimited']() : String(q.limit)}
                description={q.source ? t['admin.billing.sourceLabel']({ source: q.source }) : undefined}
              />
            {/each}
          </div>
        </div>

        <div>
          <h2>{t['admin.billing.featuresTitle']()}</h2>
          <Stack gap="2" align="start">
            {#each featureEntitlements as f (f.feature)}
              <div class="sanvi-billing__feature-row">
                <Badge variant={f.enabled ? 'success' : 'neutral'}>
                  {f.enabled ? t['admin.billing.enabled']() : t['admin.billing.disabled']()}
                </Badge>
                <span class="sanvi-billing__feature-name">{f.feature}</span>
                <span class="sanvi-billing__muted">({f.source})</span>
              </div>
            {/each}
          </Stack>
        </div>
      </Stack>

    <!-- Tab 3: Change Plan -->
    {:else if activeTab === 'plans'}
      <Stack gap="6">
        <div>
          <h2>{t['admin.billing.changePlanTitle']()}</h2>
          <p class="sanvi-billing__muted">{t['admin.billing.changePlanDesc']()}</p>
        </div>

        <div class="sanvi-billing__plans-grid">
          {#each plans as plan (plan.plan_id)}
            {@const isCurrent = plan.key === subscription.plan_key}
            <div class="sanvi-plan-box {isCurrent ? 'sanvi-plan-box--current' : ''}">
              <Stack gap="3">
                <div class="sanvi-plan-box__header">
                  <h3>{plan.name}</h3>
                  {#if isCurrent}
                    <Badge variant="success">{t['admin.billing.currentPlanBadge']()}</Badge>
                  {/if}
                </div>

                <div class="sanvi-plan-box__actions">
                  {#if isCurrent}
                    <Button variant="secondary" disabled>
                      {t['admin.billing.currentPlanBadge']()}
                    </Button>
                  {:else}
                    <Button variant="primary" loading={portalLoading} onclick={openCustomerPortal}>
                      {t['admin.billing.selectPlanCta']()}
                    </Button>
                  {/if}
                </div>
              </Stack>
            </div>
          {/each}
        </div>
      </Stack>

    <!-- Tab 4: Invoices -->
    {:else if activeTab === 'invoices'}
      <Stack gap="4">
        <h2>{t['admin.billing.invoicesTitle']()}</h2>
        {#if invoices.length === 0}
          <EmptyState title={t['admin.billing.invoicesEmpty']()} />
        {:else}
          <div class="sanvi-billing__table-wrapper">
            <table class="sanvi-invoices-table">
              <thead>
                <tr>
                  <th scope="col">{t['admin.billing.invoiceNumberCol']()}</th>
                  <th scope="col">{t['admin.billing.invoiceDateCol']()}</th>
                  <th scope="col">{t['admin.billing.invoiceAmountCol']()}</th>
                  <th scope="col">{t['admin.billing.invoiceStatusCol']()}</th>
                  <th scope="col">{t['admin.billing.invoiceActionsCol']()}</th>
                </tr>
              </thead>
              <tbody>
                {#each invoices as inv (inv.invoice_id)}
                  <tr>
                    <td><strong>{inv.number ?? inv.invoice_id.slice(0, 8)}</strong></td>
                    <td>{formatDateTime(inv.created_at)}</td>
                    <td>{fmt.money(inv.total_minor, inv.currency)}</td>
                    <td>
                      <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'open' ? 'warning' : 'neutral'}>
                        {inv.status}
                      </Badge>
                    </td>
                    <td>
                      <Cluster gap="2">
                        {#if inv.hosted_url}
                          <a class="sanvi-billing__table-link" href={inv.hosted_url} target="_blank" rel="noopener noreferrer">
                            {t['admin.billing.viewInvoice']()}
                          </a>
                        {/if}
                        {#if inv.pdf_url}
                          <a class="sanvi-billing__table-link" href={inv.pdf_url} target="_blank" rel="noopener noreferrer">
                            {t['admin.billing.downloadPdf']()}
                          </a>
                        {/if}
                      </Cluster>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Stack>

    <!-- Tab 5: Cancel -->
    {:else if activeTab === 'cancel'}
      <Stack gap="6">
        <div>
          <h2>{t['admin.billing.cancelTitle']()}</h2>
          <p class="sanvi-billing__muted">{t['admin.billing.cancelWarning']()}</p>
        </div>

        <div class="sanvi-billing__cancel-card">
          <Stack gap="4">
            <h3>{t['admin.billing.cancelImpactHeader']()}</h3>
            <ul class="sanvi-billing__cancel-list">
              <li>{t['admin.billing.cancelImpact1']()}</li>
              <li>{t['admin.billing.cancelImpact2']()}</li>
              <li>{t['admin.billing.cancelImpact3']()}</li>
            </ul>

            <div>
              <Button variant="danger" loading={portalLoading} onclick={openCustomerPortal}>
                {t['admin.billing.cancelButton']()}
              </Button>
            </div>
          </Stack>
        </div>
      </Stack>
    {/if}
  {/if}
</DetailShell>

<style>
  .sanvi-billing__card {
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-billing__card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sanvi-billing__card-header h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
  }

  .sanvi-billing__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); /* sanvi-tokens-ignore */
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-billing__quota-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); /* sanvi-tokens-ignore */
    gap: var(--sanvi-spacing-3);
    margin-block-start: var(--sanvi-spacing-3);
  }

  .sanvi-billing__feature-row {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-billing__feature-name {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-billing__muted {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-billing__plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); /* sanvi-tokens-ignore */
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-plan-box {
    padding: var(--sanvi-spacing-5);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-plan-box--current {
    border-color: var(--sanvi-color-solid-primary-base);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-plan-box__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sanvi-plan-box__header h3 {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
  }

  .sanvi-billing__table-wrapper {
    overflow-x: auto;
    border-radius: var(--sanvi-radius-md);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-invoices-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-invoices-table th,
  .sanvi-invoices-table td {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    text-align: start;
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-invoices-table th {
    background: var(--sanvi-color-background-secondary);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-billing__table-link {
    color: var(--sanvi-color-link-primary);
    text-decoration: underline;
  }

  .sanvi-billing__cta-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-billing__cancel-card {
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-billing__cancel-card h3 {
    margin: 0;
    font-size: var(--sanvi-font-size-base);
  }

  .sanvi-billing__cancel-list {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
