<script lang="ts">
import { onDestroy } from 'svelte'
import {
  ApiError,
  exportTenantPayments,
  getPaymentConnection,
  listTenantPayments,
} from '@sanvi/api-client'
import type { PaymentView } from '@sanvi/api-client'
import { formatMinor } from '@sanvi/billing-elements'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Stack,
  UpgradePrompt,
  downloadCsv,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'
import {
  buildLocalDateRange,
  getPaymentStatusFilterOptions,
  getPaymentStatusLabel as getStatusLabel,
  getPaymentStatusVariant as getStatusVariant,
  getPayoutStatusLabel,
} from '../lib/payments/helpers'
import {
  clearPersistedConnectionId,
  readPersistedConnectionId,
} from '../lib/payments/providerRegistry'

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let exportError = $state<string | undefined>(undefined)
let exporting = $state(false)

let payments = $state<PaymentView[]>([])
let nextCursor = $state<string | null | undefined>(undefined)
let currentCursor = $state<string | undefined>(undefined)
let cursorHistory = $state<string[]>([])

let hasConnection = $state<boolean | null>(null)

// Filter states
let filterStatus = $state('')
let filterCurrency = $state('')
let customerInput = $state('')
let filterCustomer = $state('')
let filterDateFrom = $state('')
let filterDateTo = $state('')

const SEARCH_DEBOUNCE_MS = 300
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

const isFiltered = $derived(
  Boolean(
    filterStatus ||
      filterCurrency ||
      filterCustomer ||
      customerInput ||
      filterDateFrom ||
      filterDateTo,
  ),
)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  exportError = undefined
  entitled = true

  const query: Record<string, string | number | undefined> = {
    limit: 20,
    cursor: currentCursor,
  }
  if (filterStatus) query['status'] = filterStatus
  if (filterCurrency) query['currency'] = filterCurrency
  if (filterCustomer) query['customer'] = filterCustomer

  const dateRange = buildLocalDateRange(filterDateFrom, filterDateTo)
  if (dateRange.date_from) query['date_from'] = dateRange.date_from
  if (dateRange.date_to) query['date_to'] = dateRange.date_to

  try {
    const result = await listTenantPayments(apiClient, query)
    if (seq !== loadSeq) return
    payments = result.items ?? []
    nextCursor = result.next_cursor

    // If payments exist, connection is obviously active
    if (payments.length > 0) {
      hasConnection = true
    } else if (hasConnection === null) {
      const tenantId = getActiveTenantId()
      const stored = hasFeature('payments.stripe_connect')
        ? readPersistedConnectionId(tenantId ?? undefined)
        : null
      if (stored) {
        try {
          await getPaymentConnection(apiClient, stored)
          if (seq !== loadSeq) return
          hasConnection = true
        } catch (connErr) {
          if (seq !== loadSeq) return
          if (connErr instanceof ApiError && connErr.status === 404) {
            clearPersistedConnectionId(tenantId ?? undefined)
          }
          hasConnection = false
        }
      } else {
        hasConnection = false
      }
    }
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.payments.list.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})

onDestroy(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
})

function handleCustomerInput(e: Event): void {
  const target = e.target as HTMLInputElement
  const value = target.value
  customerInput = value
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = undefined
  }
  searchDebounceTimer = setTimeout(() => {
    filterCustomer = value
    currentCursor = undefined
    cursorHistory = []
  }, SEARCH_DEBOUNCE_MS)
}

function handleFilterChange(): void {
  currentCursor = undefined
  cursorHistory = []
}

function clearFilters(): void {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = undefined
  }
  customerInput = ''
  filterStatus = ''
  filterCurrency = ''
  filterCustomer = ''
  filterDateFrom = ''
  filterDateTo = ''
  currentCursor = undefined
  cursorHistory = []
}

function handleNextPage(): void {
  if (!nextCursor) return
  if (currentCursor) {
    cursorHistory = [...cursorHistory, currentCursor]
  } else {
    cursorHistory = ['']
  }
  currentCursor = nextCursor
}

function handlePrevPage(): void {
  if (cursorHistory.length === 0) return
  const prev = cursorHistory[cursorHistory.length - 1]
  cursorHistory = cursorHistory.slice(0, -1)
  currentCursor = prev || undefined
}

async function handleExportCsv(): Promise<void> {
  exporting = true
  exportError = undefined
  const query: Record<string, string | undefined> = {}
  if (filterStatus) query['status'] = filterStatus
  if (filterCurrency) query['currency'] = filterCurrency
  if (filterCustomer) query['customer'] = filterCustomer

  const dateRange = buildLocalDateRange(filterDateFrom, filterDateTo)
  if (dateRange.date_from) query['date_from'] = dateRange.date_from
  if (dateRange.date_to) query['date_to'] = dateRange.date_to

  try {
    const csvContent = await exportTenantPayments(apiClient, query)
    downloadCsv(csvContent || '', `payments-${new Date().toISOString().slice(0, 10)}.csv`)
  } catch {
    exportError = t['admin.payments.list.exportError']()
  } finally {
    exporting = false
  }
}

const statusFilterOptions = $derived(getPaymentStatusFilterOptions())

const currencyFilterOptions = [
  { value: 'USD', label: 'USD' },
  { value: 'JPY', label: 'JPY' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CAD', label: 'CAD' },
  { value: 'AUD', label: 'AUD' },
]
</script>

<svelte:head>
  <title>{t['admin.payments.list.title']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div class="sanvi-payments-list__header">
      <Cluster justify="space-between" align="center" gap="4">
        <div>
          <h1>{t['admin.payments.list.title']()}</h1>
          <p class="sanvi-payments-list__subtitle">{t['admin.payments.list.description']()}</p>
        </div>
        {#if entitled}
          <Cluster gap="3">
            <Button
              variant="secondary"
              loading={exporting}
              loadingLabel={t['admin.payments.list.exporting']()}
              disabled={exporting || payments.length === 0}
              onclick={handleExportCsv}
            >
              {t['admin.payments.list.exportCsv']()}
            </Button>
            <a class="sanvi-payments-list__settings-link" href="/payments/settings">
              <Button variant="ghost">
                {t['admin.payments.list.settingsButton']()}
              </Button>
            </a>
          </Cluster>
        {/if}
      </Cluster>
    </div>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if exportError}
      <Alert variant="error">{exportError}</Alert>
    {/if}

    {#if loading && payments.length === 0}
      <Spinner label={t['admin.payments.loading']()} />
    {:else if !entitled}
      <UpgradePrompt
        feature="payments.stripe_connect"
        title={t['admin.payments.upgradeTitle']()}
        description={t['admin.payments.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else if payments.length === 0 && !isFiltered && cursorHistory.length === 0}
      <EmptyState
        title={t['admin.payments.list.emptyTitle']()}
        description={hasConnection === false
          ? t['admin.payments.list.emptyInactiveDescription']()
          : t['admin.payments.list.emptyDescription']()}
      >
        {#snippet action()}
          {#if hasConnection === false}
            <a class="sanvi-payments-list__settings-link" href="/payments/settings">
              <Button variant="primary">
                {t['admin.payments.list.connectCta']()}
              </Button>
            </a>
          {/if}
        {/snippet}
      </EmptyState>
    {:else}
      <!-- Filters toolbar -->
      <section class="sanvi-payments-list__filters" aria-label={t['admin.payments.list.title']()}>
        <div class="sanvi-payments-list__filters-grid">
          <Field label={t['admin.payments.list.filterCustomer']()}>
            {#snippet children(controlProps)}
              <Input
                {...controlProps}
                type="search"
                value={customerInput}
                placeholder={t['admin.payments.list.filterCustomerPlaceholder']()}
                oninput={handleCustomerInput}
              />
            {/snippet}
          </Field>

          <Field label={t['admin.payments.list.filterStatus']()}>
            {#snippet children(controlProps)}
              <Select
                {...controlProps}
                bind:value={filterStatus}
                options={statusFilterOptions}
                placeholder={t['admin.payments.list.filterStatusAll']()}
                clearable
                onchange={handleFilterChange}
              />
            {/snippet}
          </Field>

          <Field label={t['admin.payments.list.filterCurrency']()}>
            {#snippet children(controlProps)}
              <Select
                {...controlProps}
                bind:value={filterCurrency}
                options={currencyFilterOptions}
                placeholder={t['admin.payments.list.filterCurrencyAll']()}
                clearable
                onchange={handleFilterChange}
              />
            {/snippet}
          </Field>

          <Field label={t['admin.payments.list.filterDateFrom']()}>
            {#snippet children(controlProps)}
              <input
                {...controlProps}
                type="date"
                class="sanvi-payments-list__date-input"
                bind:value={filterDateFrom}
                onchange={handleFilterChange}
              />
            {/snippet}
          </Field>

          <Field label={t['admin.payments.list.filterDateTo']()}>
            {#snippet children(controlProps)}
              <input
                {...controlProps}
                type="date"
                class="sanvi-payments-list__date-input"
                bind:value={filterDateTo}
                onchange={handleFilterChange}
              />
            {/snippet}
          </Field>
        </div>

        {#if isFiltered}
          <div class="sanvi-payments-list__filters-actions">
            <Button variant="ghost" size="sm" onclick={clearFilters}>
              {t['admin.payments.list.clearFilters']()}
            </Button>
          </div>
        {/if}
      </section>

      {#if payments.length === 0}
        <EmptyState
          title={t['admin.payments.list.filterEmptyTitle']()}
          description={t['admin.payments.list.filterEmptyDescription']()}
        >
          {#snippet action()}
            <Button variant="secondary" size="sm" onclick={clearFilters}>
              {t['admin.payments.list.clearFilters']()}
            </Button>
          {/snippet}
        </EmptyState>
      {:else}
        <div class="sanvi-payments-list__table-wrapper">
          <table class="sanvi-payments-list__table">
            <thead>
              <tr>
                <th scope="col">{t['admin.payments.list.colDate']()}</th>
                <th scope="col">{t['admin.payments.list.colCustomer']()}</th>
                <th scope="col">{t['admin.payments.list.colAmount']()}</th>
                <th scope="col">{t['admin.payments.list.colStatus']()}</th>
                <th scope="col">{t['admin.payments.list.colMethod']()}</th>
                <th scope="col">{t['admin.payments.list.colPayoutStatus']()}</th>
                <th scope="col" class="sanvi-payments-list__th--actions">{t['admin.payments.list.colActions']()}</th>
              </tr>
            </thead>
            <tbody>
              {#each payments as payment (payment.id)}
                <tr>
                  <td>
                    <span class="sanvi-payments-list__date">
                      {payment.captured_at ? fmt.datetime(payment.captured_at, 'medium') : payment.created_at ? fmt.datetime(payment.created_at, 'medium') : '—'}
                    </span>
                  </td>
                  <td>
                    <span class="sanvi-payments-list__customer">
                      {payment.checkout_id || payment.external_payment_id}
                    </span>
                  </td>
                  <td>
                    <strong class="sanvi-payments-list__amount">
                      {formatMinor(payment.amount_minor, payment.currency)}
                    </strong>
                  </td>
                  <td>
                    <Badge variant={getStatusVariant(payment.status)}>
                      {#snippet children()}
                        {getStatusLabel(payment.status)}
                      {/snippet}
                    </Badge>
                  </td>
                  <td>
                    <span class="sanvi-payments-list__muted">
                      {t['admin.payments.list.methodCard']()}
                    </span>
                  </td>
                  <td>
                    <span class="sanvi-payments-list__muted">
                      {getPayoutStatusLabel(payment.payout_status)}
                    </span>
                  </td>
                  <td class="sanvi-payments-list__td--actions">
                    <a class="sanvi-payments-list__action-link" href={`/payments/${payment.id}`}>
                      {t['admin.payments.list.viewDetails']()}
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <!-- Cursor Pagination controls -->
      {#if payments.length > 0 || cursorHistory.length > 0}
        <Cluster justify="space-between" align="center" gap="4">
          <div>
            {#if loading}
              <Spinner label={t['admin.payments.loading']()} />
            {/if}
          </div>
          <Cluster gap="2">
            <Button
              variant="ghost"
              size="sm"
              disabled={cursorHistory.length === 0 || loading}
              onclick={handlePrevPage}
            >
              {t['admin.payments.list.prevPage']()}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!nextCursor || loading}
              onclick={handleNextPage}
            >
              {t['admin.payments.list.nextPage']()}
            </Button>
          </Cluster>
        </Cluster>
      {/if}
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-payments-list__header h1 {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments-list__subtitle {
    margin: var(--sanvi-spacing-1) 0 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-payments-list__settings-link {
    text-decoration: none;
  }

  .sanvi-payments-list__filters {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments-list__filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(var(--sanvi-spacing-32) + var(--sanvi-spacing-16)), 1fr));
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-payments-list__date-input {
    width: 100%;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-payments-list__filters-actions {
    display: flex;
    justify-content: flex-end;
  }

  .sanvi-payments-list__table-wrapper {
    overflow-x: auto;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments-list__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
    text-align: start;
  }

  .sanvi-payments-list__table th {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-secondary);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    text-align: start;
  }

  .sanvi-payments-list__th--actions {
    text-align: end;
  }

  .sanvi-payments-list__table td {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-primary);
    vertical-align: middle;
  }

  .sanvi-payments-list__table tbody tr:last-child td {
    border-block-end: none;
  }

  .sanvi-payments-list__td--actions {
    text-align: end;
  }

  .sanvi-payments-list__amount {
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-payments-list__date,
  .sanvi-payments-list__customer,
  .sanvi-payments-list__muted {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments-list__action-link {
    color: var(--sanvi-color-solid-primary-base);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-payments-list__action-link:hover {
    text-decoration: underline;
  }
</style>
