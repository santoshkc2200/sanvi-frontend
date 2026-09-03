import { t } from '@sanvi/i18n'

export type PaymentStatusVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral'

export function getPaymentStatusVariant(status: string): PaymentStatusVariant {
  switch (status) {
    case 'succeeded':
      return 'success'
    case 'failed':
      return 'error'
    case 'requires_action':
      return 'warning'
    case 'processing':
      return 'info'
    case 'canceled':
      return 'neutral'
    case 'disputed':
      return 'warning'
    case 'partially_refunded':
      return 'info'
    case 'refunded':
      return 'neutral'
    case 'pending':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'requires_action':
      return t['admin.payments.list.statusRequiresAction']()
    case 'processing':
      return t['admin.payments.list.statusProcessing']()
    case 'succeeded':
      return t['admin.payments.list.statusSucceeded']()
    case 'failed':
      return t['admin.payments.list.statusFailed']()
    case 'canceled':
      return t['admin.payments.list.statusCanceled']()
    case 'refunded':
      return t['admin.payments.list.statusRefunded']()
    case 'partially_refunded':
      return t['admin.payments.list.statusPartiallyRefunded']()
    case 'disputed':
      return t['admin.payments.list.statusDisputed']()
    case 'pending':
      return t['admin.payments.list.statusPending']()
    default:
      return status
  }
}

export function getPayoutStatusLabel(payoutStatus?: string | null): string {
  if (!payoutStatus) return '—'
  switch (payoutStatus) {
    case 'paid':
      return t['admin.payments.list.payoutPaid']()
    case 'pending':
      return t['admin.payments.list.payoutPending']()
    case 'failed':
      return t['admin.payments.list.payoutFailed']()
    default:
      return payoutStatus
  }
}

export const PAYMENT_STATUS_FILTER_VALUES = [
  'requires_action',
  'processing',
  'succeeded',
  'failed',
  'canceled',
] as const

export function getPaymentStatusFilterOptions(): Array<{ value: string; label: string }> {
  return PAYMENT_STATUS_FILTER_VALUES.map((value) => ({
    value,
    label: getPaymentStatusLabel(value),
  }))
}

export function sumSucceededRefundsMinor(
  refunds: readonly { status?: string | null; amount_minor: number }[],
): number {
  return refunds.reduce((sum, r) => (r.status === 'succeeded' ? sum + r.amount_minor : sum), 0)
}

export function buildLocalDateRange(
  dateFrom?: string,
  dateTo?: string,
): { date_from?: string; date_to?: string } {
  const query: { date_from?: string; date_to?: string } = {}
  if (dateFrom) {
    const parts = dateFrom.split('-').map(Number)
    if (parts.length === 3 && parts.every((p) => !Number.isNaN(p))) {
      const [year, month, day] = parts
      if (year !== undefined && month !== undefined && day !== undefined) {
        query.date_from = new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
      }
    }
  }
  if (dateTo) {
    const parts = dateTo.split('-').map(Number)
    if (parts.length === 3 && parts.every((p) => !Number.isNaN(p))) {
      const [year, month, day] = parts
      if (year !== undefined && month !== undefined && day !== undefined) {
        query.date_to = new Date(year, month - 1, day, 23, 59, 59, 999).toISOString()
      }
    }
  }
  return query
}
