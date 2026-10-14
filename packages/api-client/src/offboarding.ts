import type { TypedApiClient } from './typed'

/**
 * Tenant offboarding — export-then-purge (TASK-028, FR-1131; sanvi-backend
 * TASK-028). The API records the request and answers status, export
 * evidence, and the purge report; the export and the purge themselves are
 * executed by the operator CLI (`just offboard`), which advances the record
 * through the verified-export gate and the typed confirmation naming the
 * tenant. The console starts (POST), monitors (GET polling), and presents —
 * it never purges over the wire.
 */

/** The record's state machine: pending → exporting → exported → purging → purged, `failed` from any point. */
export type OffboardingStatus =
  | 'pending'
  | 'exporting'
  | 'exported'
  | 'purging'
  | 'purged'
  | 'failed'

/** The verified export's evidence — present once the export verified; the checksum is the purge-time integrity gate. */
export interface OffboardingExportEvidence {
  path: string
  checksum: string
}

/** One lawfully retained class: what was kept, why, and until when. */
export interface PurgeReportRetainedClass {
  dataClass: string
  table: string
  rowsRetained: number
  legalBasis: string
  /** RFC 3339; `undefined` when the class has no end (append-only chain, tombstone anchor). */
  retentionEnd: string | undefined
}

/** The purge report, typed from the operator CLI's JSON (`sanvi-backend apps/cli/src/offboard.rs`). */
export interface PurgeReport {
  tenant: string
  tenantId: string
  requestId: string
  /** Rows removed per fully-purged table (`schema.table` → count). */
  removed: Record<string, number>
  /** What was lawfully kept, each entry naming its reason and retention end date. */
  lawfullyRetained: PurgeReportRetainedClass[]
  archivesPurged: number
  cacheKeysDeleted: number
  backupPolicyNote: string | undefined
  objectStorageNote: string | undefined
  searchIndexesNote: string | undefined
  /** The neighbour-byte-identical proof, when one was asked for. */
  neighbour: { tenant: string; byteIdentical: boolean } | undefined
  residualScan: string | undefined
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

interface WireRetainedClass {
  data_class?: unknown
  table?: unknown
  rows_retained?: unknown
  legal_basis?: unknown
  retention_end?: unknown
}

function parseRetainedClass(entry: unknown): PurgeReportRetainedClass | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined
  const wire = entry as WireRetainedClass
  if (
    !nonEmptyString(wire.data_class) ||
    !nonEmptyString(wire.table) ||
    typeof wire.rows_retained !== 'number' ||
    !Number.isInteger(wire.rows_retained) ||
    wire.rows_retained < 0 ||
    !nonEmptyString(wire.legal_basis)
  ) {
    return undefined
  }
  // The end date is an RFC 3339 string or a real null (no-end classes); any
  // other value means the member is corrupt and the entry cannot be rendered
  // truthfully — it is dropped rather than shown without its end.
  if (wire.retention_end !== null && wire.retention_end !== undefined) {
    if (!nonEmptyString(wire.retention_end)) return undefined
  }
  return {
    dataClass: wire.data_class,
    table: wire.table,
    rowsRetained: wire.rows_retained,
    legalBasis: wire.legal_basis,
    retentionEnd: nonEmptyString(wire.retention_end) ? wire.retention_end : undefined,
  }
}

/**
 * Parses the schema-less `purge_report` JSON member of an
 * `OffboardingSnapshot` into the typed shape. The report reaches the DOM, so
 * only members that validate survive: a malformed entry is dropped, never
 * rendered, never a crash. Same input in, same report out — re-running an
 * offboarding answers the stored report and must render identically.
 */
export function purgeReportOf(raw: unknown): PurgeReport | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const wire = raw as {
    tenant?: unknown
    tenant_id?: unknown
    request_id?: unknown
    removed?: unknown
    lawfully_retained?: unknown
    archives_purged?: unknown
    cache_keys_deleted?: unknown
    backup_policy_note?: unknown
    object_storage_note?: unknown
    search_indexes_note?: unknown
    neighbour?: unknown
    residual_scan?: unknown
  }
  if (!nonEmptyString(wire.tenant) || !nonEmptyString(wire.tenant_id)) return undefined

  const removed: Record<string, number> = {}
  if (typeof wire.removed === 'object' && wire.removed !== null) {
    for (const [table, count] of Object.entries(wire.removed)) {
      if (
        nonEmptyString(table) &&
        typeof count === 'number' &&
        Number.isInteger(count) &&
        count >= 0
      ) {
        removed[table] = count
      }
    }
  }

  const lawfullyRetained: PurgeReportRetainedClass[] = []
  if (Array.isArray(wire.lawfully_retained)) {
    for (const entry of wire.lawfully_retained) {
      const parsed = parseRetainedClass(entry)
      if (parsed) lawfullyRetained.push(parsed)
    }
  }

  let neighbour: PurgeReport['neighbour']
  if (typeof wire.neighbour === 'object' && wire.neighbour !== null) {
    const candidate = wire.neighbour as { tenant?: unknown; byte_identical?: unknown }
    if (nonEmptyString(candidate.tenant) && typeof candidate.byte_identical === 'boolean') {
      neighbour = { tenant: candidate.tenant, byteIdentical: candidate.byte_identical }
    }
  }

  const nonNegativeInt = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined

  return {
    tenant: wire.tenant,
    tenantId: wire.tenant_id,
    requestId: nonEmptyString(wire.request_id) ? wire.request_id : '',
    removed,
    lawfullyRetained,
    archivesPurged: nonNegativeInt(wire.archives_purged) ?? 0,
    cacheKeysDeleted: nonNegativeInt(wire.cache_keys_deleted) ?? 0,
    backupPolicyNote: nonEmptyString(wire.backup_policy_note) ? wire.backup_policy_note : undefined,
    objectStorageNote: nonEmptyString(wire.object_storage_note)
      ? wire.object_storage_note
      : undefined,
    searchIndexesNote: nonEmptyString(wire.search_indexes_note)
      ? wire.search_indexes_note
      : undefined,
    neighbour,
    residualScan: nonEmptyString(wire.residual_scan) ? wire.residual_scan : undefined,
  }
}

/** `POST /api/v1/platform/tenants/{id}/offboarding` — record the export-then-purge request; idempotent by `(tenant, key)`. */
export function requestOffboarding(
  client: TypedApiClient,
  tenantId: string,
  body: { idempotencyKey: string },
  signal?: AbortSignal,
) {
  return client.POST(
    '/api/v1/platform/tenants/{id}/offboarding',
    { idempotency_key: body.idempotencyKey },
    { params: { path: { id: tenantId } }, ...(signal ? { signal } : {}) },
  )
}

/** `GET /api/v1/platform/tenants/{id}/offboarding` — status, export evidence, purge report. 404 when none recorded. */
export function getOffboarding(client: TypedApiClient, tenantId: string, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/tenants/{id}/offboarding', {
    params: { path: { id: tenantId } },
    ...(signal ? { signal } : {}),
  })
}
