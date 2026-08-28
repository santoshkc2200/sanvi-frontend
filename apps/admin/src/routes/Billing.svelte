<script lang="ts">
import {
  createPortalSession,
  getSubscription,
  listInvoices,
  listPublicPlans,
  listTenantEntitlements,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { formatMinor } from '@sanvi/billing-elements'
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

const COPY = {
  pageTitle: 'Billing & Subscription',
  pageDescription: 'Manage your plan, quotas, invoices, and payment methods.',
  tabOverview: 'Overview',
  tabUsage: 'Usage & Quotas',
  tabChangePlan: 'Change Plan',
  tabInvoices: 'Invoices',
  tabCancel: 'Cancel Subscription',
  loading: 'Loading billing details',
  genericError: 'Could not load billing details. Please try again in a moment.',
  portalError: 'Could not open the customer portal. Please try again.',
  currentPlanTitle: 'Current Subscription',
  planLabel: 'Plan',
  statusLabel: 'Status',
  intervalLabel: 'Billing interval',
  renewalLabel: 'Renews on',
  trialEndingNotice: (days: number, date: string) =>
    `Your 14-day free trial has ${days} day(s) remaining and ends on ${date}.`,
  canceledNotice: (date: string) =>
    `Your subscription is set to cancel on ${date}. You will continue to have full access until then.`,
  reactivateCta: 'Reactivate subscription',
  pastDueWarning:
    'Your latest subscription payment failed. Please update your payment method to prevent service interruption.',
  managePaymentCta: 'Manage in Stripe',
  paymentMethodTitle: 'Payment Method',
  paymentMethodDesc: 'Card details and billing address are managed securely in Stripe.',
  changePlanTitle: 'Available Plans',
  changePlanDesc:
    'Upgrading or downgrading prorates immediately. Differences are settled on your next invoice.',
  currentPlanBadge: 'Current Plan',
  selectPlanCta: 'Change to this plan',
  invoicesTitle: 'Invoice History',
  invoicesEmpty: 'No invoices found.',
  invoiceNumberCol: 'Invoice #',
  invoiceDateCol: 'Date',
  invoiceAmountCol: 'Amount',
  invoiceStatusCol: 'Status',
  invoiceActionsCol: 'Actions',
  viewInvoice: 'View',
  downloadPdf: 'PDF',
  cancelTitle: 'Cancel Subscription',
  cancelWarning:
    'Canceling your subscription will downgrade your workspace at the end of your billing period.',
  cancelImpactHeader: 'What happens when you cancel:',
  cancelImpact1: 'You keep access to all features until the end of your current billing period.',
  cancelImpact2: 'After the period ends, your published courses and custom domain will be paused.',
  cancelImpact3: 'Your student data and course content are safely stored for 30 days.',
  cancelButton: 'Continue to cancel in Stripe',
  cancelConfirmPrompt:
    'You will be redirected to the Stripe Customer Portal to finalize your cancellation.',
  noSubscription: 'No active subscription found.',
  noSubscriptionDesc: 'Choose a plan to activate your workspace and start your 14-day free trial.',
  choosePlanCta: 'Choose a plan',
  quotaTitle: 'Resource Limits',
  featuresTitle: 'Included Features',
  enabled: 'Enabled',
  disabled: 'Disabled',
}

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
    error = COPY.genericError
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
      portalError = COPY.portalError
    }
  } catch {
    portalError = COPY.portalError
  } finally {
    portalLoading = false
  }
}

const TABS: DetailShellTab[] = [
  { href: 'overview', label: COPY.tabOverview },
  { href: 'usage', label: COPY.tabUsage },
  { href: 'plans', label: COPY.tabChangePlan },
  { href: 'invoices', label: COPY.tabInvoices },
  { href: 'cancel', label: COPY.tabCancel },
]

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
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}
</script>

<svelte:head>
  <title>{COPY.pageTitle}</title>
</svelte:head>

<DetailShell
  title={COPY.pageTitle}
  subtitle={COPY.pageDescription}
  tabs={TABS}
  activeHref={activeTab}
  onNavigate={handleTabNavigate}
>
  {#if portalError}
    <Alert variant="error">{portalError}</Alert>
  {/if}

  {#if loading}
    <Spinner label={COPY.loading} />
  {:else if error}
    <Alert variant="error">{error}</Alert>
  {:else if !subscription}
    <EmptyState title={COPY.noSubscription} description={COPY.noSubscriptionDesc}>
      {#snippet action()}
        <a class="sanvi-billing__cta-link" href="/onboarding">{COPY.choosePlanCta}</a>
      {/snippet}
    </EmptyState>
  {:else}
    <!-- Tab 1: Overview -->
    {#if activeTab === 'overview'}
      <Stack gap="6">
        {#if subscription.collection_state === 'dunning'}
          <Alert variant="error" title={COPY.pastDueWarning}>
            <Button variant="danger" loading={portalLoading} onclick={openCustomerPortal}>
              {COPY.managePaymentCta}
            </Button>
          </Alert>
        {/if}

        {#if subscription.status === 'trialing' && subscription.trial_end}
          <Alert variant="info">
            {COPY.trialEndingNotice(trialDaysRemaining(), formatDateTime(subscription.trial_end))}
          </Alert>
        {/if}

        {#if subscription.cancel_at_period_end && subscription.current_period?.end}
          <Alert variant="warning">
            <Stack gap="2">
              <p>{COPY.canceledNotice(formatDateTime(subscription.current_period.end))}</p>
              <div>
                <Button variant="primary" loading={portalLoading} onclick={openCustomerPortal}>
                  {COPY.reactivateCta}
                </Button>
              </div>
            </Stack>
          </Alert>
        {/if}

        <div class="sanvi-billing__card">
          <Stack gap="4">
            <div class="sanvi-billing__card-header">
              <h2>{COPY.currentPlanTitle}</h2>
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
              <StatCard label={COPY.planLabel} value={subscription.plan_name} />
              <StatCard
                label={COPY.renewalLabel}
                value={formatDateTime(subscription.current_period?.end)}
              />
            </div>
          </Stack>
        </div>

        <div class="sanvi-billing__card">
          <Stack gap="3">
            <h2>{COPY.paymentMethodTitle}</h2>
            <p class="sanvi-billing__muted">{COPY.paymentMethodDesc}</p>
            <div>
              <Button variant="secondary" loading={portalLoading} onclick={openCustomerPortal}>
                {COPY.managePaymentCta}
              </Button>
            </div>
          </Stack>
        </div>
      </Stack>

    <!-- Tab 2: Usage & Quotas -->
    {:else if activeTab === 'usage'}
      <Stack gap="6">
        <div>
          <h2>{COPY.quotaTitle}</h2>
          <div class="sanvi-billing__quota-grid">
            {#each quotaEntitlements as q (q.feature)}
              <StatCard
                label={q.feature}
                value={q.limit === null || q.limit === undefined ? 'Unlimited' : String(q.limit)}
                description={q.source ? `Source: ${q.source}` : undefined}
              />
            {/each}
          </div>
        </div>

        <div>
          <h2>{COPY.featuresTitle}</h2>
          <Stack gap="2" align="start">
            {#each featureEntitlements as f (f.feature)}
              <div class="sanvi-billing__feature-row">
                <Badge variant={f.enabled ? 'success' : 'neutral'}>
                  {f.enabled ? COPY.enabled : COPY.disabled}
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
          <h2>{COPY.changePlanTitle}</h2>
          <p class="sanvi-billing__muted">{COPY.changePlanDesc}</p>
        </div>

        <div class="sanvi-billing__plans-grid">
          {#each plans as plan (plan.plan_id)}
            {@const isCurrent = plan.key === subscription.plan_key}
            <div class="sanvi-plan-box {isCurrent ? 'sanvi-plan-box--current' : ''}">
              <Stack gap="3">
                <div class="sanvi-plan-box__header">
                  <h3>{plan.name}</h3>
                  {#if isCurrent}
                    <Badge variant="success">{COPY.currentPlanBadge}</Badge>
                  {/if}
                </div>

                <div class="sanvi-plan-box__actions">
                  {#if isCurrent}
                    <Button variant="secondary" disabled>
                      {COPY.currentPlanBadge}
                    </Button>
                  {:else}
                    <Button variant="primary" loading={portalLoading} onclick={openCustomerPortal}>
                      {COPY.selectPlanCta}
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
        <h2>{COPY.invoicesTitle}</h2>
        {#if invoices.length === 0}
          <EmptyState title={COPY.invoicesEmpty} />
        {:else}
          <div class="sanvi-billing__table-wrapper">
            <table class="sanvi-invoices-table">
              <thead>
                <tr>
                  <th scope="col">{COPY.invoiceNumberCol}</th>
                  <th scope="col">{COPY.invoiceDateCol}</th>
                  <th scope="col">{COPY.invoiceAmountCol}</th>
                  <th scope="col">{COPY.invoiceStatusCol}</th>
                  <th scope="col">{COPY.invoiceActionsCol}</th>
                </tr>
              </thead>
              <tbody>
                {#each invoices as inv (inv.invoice_id)}
                  <tr>
                    <td><strong>{inv.number ?? inv.invoice_id.slice(0, 8)}</strong></td>
                    <td>{formatDateTime(inv.created_at)}</td>
                    <td>{formatMinor(inv.total_minor, inv.currency)}</td>
                    <td>
                      <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'open' ? 'warning' : 'neutral'}>
                        {inv.status}
                      </Badge>
                    </td>
                    <td>
                      <Cluster gap="2">
                        {#if inv.hosted_url}
                          <a class="sanvi-billing__table-link" href={inv.hosted_url} target="_blank" rel="noopener noreferrer">
                            {COPY.viewInvoice}
                          </a>
                        {/if}
                        {#if inv.pdf_url}
                          <a class="sanvi-billing__table-link" href={inv.pdf_url} target="_blank" rel="noopener noreferrer">
                            {COPY.downloadPdf}
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
          <h2>{COPY.cancelTitle}</h2>
          <p class="sanvi-billing__muted">{COPY.cancelWarning}</p>
        </div>

        <div class="sanvi-billing__cancel-card">
          <Stack gap="4">
            <h3>{COPY.cancelImpactHeader}</h3>
            <ul class="sanvi-billing__cancel-list">
              <li>{COPY.cancelImpact1}</li>
              <li>{COPY.cancelImpact2}</li>
              <li>{COPY.cancelImpact3}</li>
            </ul>

            <div>
              <Button variant="danger" loading={portalLoading} onclick={openCustomerPortal}>
                {COPY.cancelButton}
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
