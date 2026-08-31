import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import type { DomainRecordItem } from '@sanvi/ui'

type CustomDomainView = components['schemas']['CustomDomainView']
type InstructionsView = components['schemas']['InstructionsView']
type InstructionRecord = components['schemas']['InstructionRecord']
type DomainFailure = components['schemas']['DomainFailure']

/**
 * Statuses in which the backend has confirmed both the ownership challenge and
 * the routing records resolve to what it expects.
 */
const CONFIRMED_STATUSES = ['verified', 'issuing_cert', 'live']

/** Failure codes that describe the TXT ownership challenge rather than routing. */
const TXT_FAILURE_CODES: Record<string, DomainRecordItem['observed']> = {
  txt_missing: 'not_found',
  challenge_expired: 'not_found',
  txt_mismatch: 'mismatch',
  dns_drift: 'mismatch',
}

/** Failure codes that describe the routing record rather than the TXT challenge. */
const ROUTING_FAILURE_CODES: Record<string, DomainRecordItem['observed']> = {
  routing_missing: 'not_found',
  routing_mismatch: 'mismatch',
  dns_drift: 'mismatch',
}

function observedFor(
  record: InstructionRecord,
  domain: Pick<CustomDomainView, 'status' | 'failure'>,
): DomainRecordItem['observed'] {
  if (CONFIRMED_STATUSES.includes(domain.status)) return 'matched'

  const isChallenge = record.record_type.toUpperCase() === 'TXT'

  // The backend now reports each check independently (`txt_ok`/`routing_ok`)
  // on verification failures, so a record whose own check passed shows as
  // matched even while the domain is still `verifying` overall.
  const ok = isChallenge ? domain.failure?.txt_ok : domain.failure?.routing_ok
  if (ok !== undefined && ok !== null) return ok ? 'matched' : 'not_found'

  // Health-monitor failures (e.g. `dns_drift` on an already-live domain)
  // don't carry per-check booleans — fall back to the failure code.
  const code = domain.failure?.code
  if (!code) return 'pending'
  const table = isChallenge ? TXT_FAILURE_CODES : ROUTING_FAILURE_CODES
  return table[code] ?? 'pending'
}

/**
 * Turn the backend's authoritative instruction records into table rows,
 * annotating each with what the backend's last probe observed.
 *
 * The record set — names, values, types and TTLs — is never derived here: the
 * edge address and challenge host are deployment facts the backend owns, and a
 * client-side guess would have tenants publishing records that route nowhere.
 * The observed column comes straight from the backend's per-check result
 * (`failure.txt_ok` / `failure.routing_ok`) when the domain is mid-verification;
 * only the health monitor's `dns_drift` case (no per-check split) still falls
 * back to a failure-code guess.
 */
export function toRecordItems(
  instructions: InstructionsView | null | undefined,
  domain: Pick<CustomDomainView, 'status' | 'failure'> | null | undefined,
): DomainRecordItem[] {
  if (!instructions || !domain || !Array.isArray(instructions.records)) return []
  return instructions.records.map((record) => ({
    type: record.record_type,
    name: record.name,
    expected: record.value,
    ttl: record.ttl,
    explanation: record.explanation,
    observed: observedFor(record, domain),
  }))
}

/**
 * The tenant-facing explanation for a domain failure code, each naming a
 * concrete next action. Falls back to the backend's `detail` before the
 * generic message so an unmapped code still says something specific.
 */
export function failureMessage(failure: DomainFailure | null | undefined): string | undefined {
  if (!failure) return undefined
  switch (failure.code) {
    case 'txt_missing':
      return t['admin.domains.failure.txtMissing']()
    case 'txt_mismatch':
      return t['admin.domains.failure.txtMismatch']()
    case 'routing_missing':
      return t['admin.domains.failure.routingMissing']()
    case 'routing_mismatch':
      return t['admin.domains.failure.routingMismatch']()
    case 'dns_drift':
      return t['admin.domains.failure.dnsDrift']()
    case 'challenge_expired':
      return t['admin.domains.failure.challengeExpired']()
    case 'verified_by_other_tenant':
      return t['admin.domains.failure.verifiedByOtherTenant']()
    case 'cert_invalid':
      return t['admin.domains.failure.certInvalid']()
    case 'cert_issuance_failed':
      return t['admin.domains.failure.certIssuanceFailed']()
    case 'propagating':
      return t['admin.domains.failure.propagating']()
    case 'probe_failed':
      return t['admin.domains.failure.probeFailed']()
    default:
      return failure.detail || t['admin.domains.failure.generic']()
  }
}
