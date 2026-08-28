import type { components } from './generated/types'
import type { TypedApiClient } from './typed'

type Schemas = components['schemas']

/**
 * Privacy & consent (phase 05). Two audiences share this module:
 *
 * - Subject-facing surfaces (storefront privacy centre, the consent banner's
 *   server sync): `/api/v1/privacy/*` and the `/api/v1/public/privacy/*`
 *   legal-content endpoints. Opt-out and limit-sensitive deliberately have
 *   NO identity gate — that's a legal requirement, not an oversight.
 * - Operator-facing consoles: `/api/v1/tenant/privacy/*` (tenant staff
 *   acting as processor for their end users) and `/api/v1/platform/privacy/*`
 *   (platform operators; DSR queue, appeals, holds, breach obligations).
 */

/** `GET /api/v1/privacy/directives` — the resolved state per purpose, with source and jurisdiction. */
export function getDirectives(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/privacy/directives', signal ? { signal } : undefined)
}

/** `GET /api/v1/privacy/consents` — the subject's own consent ledger (proof view). */
export function listConsents(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/privacy/consents', signal ? { signal } : undefined)
}

/** `PUT /api/v1/privacy/consents` — grant/withdraw one consent; 409 when essential is targeted. */
export function updateConsent(client: TypedApiClient, body: Schemas['ConsentChangeRequest']) {
  return client.PUT('/api/v1/privacy/consents', body)
}

/**
 * `POST /api/v1/privacy/opt-out` — sale/share, targeted advertising, profiling.
 * No verification gate; rate-limited by device rather than identity so abuse
 * protection never becomes a verification gate on a refusal.
 */
export function recordOptOut(client: TypedApiClient, body: Schemas['RecordOptOutCommand']) {
  return client.POST('/api/v1/privacy/opt-out', body)
}

/** `POST /api/v1/privacy/limit-sensitive` — CPRA "limit the use of my sensitive personal information". */
export function limitSensitiveUse(
  client: TypedApiClient,
  body: Schemas['LimitSensitiveRequest'] = {},
) {
  return client.POST('/api/v1/privacy/limit-sensitive', body)
}

/**
 * `POST /api/v1/privacy/requests` — self-service DSR. Signed-in requesters are
 * verified by their session; anonymous requesters receive an email OTP
 * (`verification_required` in the response).
 */
export function submitDsr(client: TypedApiClient, body: Schemas['SubmitDsrCommand']) {
  return client.POST('/api/v1/privacy/requests', body)
}

/**
 * `GET /api/v1/privacy/requests/{id}` — status for the subject. Owned by the
 * session, or by the challenge token for unauthenticated requesters.
 */
export function getDsrStatus(
  client: TypedApiClient,
  id: string,
  query?: { token?: string },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/privacy/requests/{id}', {
    params: { path: { id }, query },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/privacy/requests/{id}/verify` — consume the emailed OTP. */
export function verifyDsr(
  client: TypedApiClient,
  id: string,
  body: Schemas['VerifyRequestRequest'],
) {
  return client.POST('/api/v1/privacy/requests/{id}/verify', body, { params: { path: { id } } })
}

/** `POST /api/v1/privacy/requests/{id}/appeal` — appeal a refusal; the authority's complaint route comes back in the response. */
export function appealRequest(
  client: TypedApiClient,
  id: string,
  body: Schemas['AppealRequestRequest'],
) {
  return client.POST('/api/v1/privacy/requests/{id}/appeal', body, { params: { path: { id } } })
}

/** `PATCH /api/v1/privacy/requests/{id}/rectify` — apply corrections to a rectification request. */
export function rectifyRequest(
  client: TypedApiClient,
  id: string,
  body: Schemas['RectifyRequest'],
) {
  return client.PATCH('/api/v1/privacy/requests/{id}/rectify', body, { params: { path: { id } } })
}

/**
 * Builds the one-time, TTL-bound export download URL. The passphrase is
 * delivered out of band; the token is the link's secret. Rendered as an
 * `href`, never fetched through the client — the browser streams the archive.
 */
export function exportDownloadUrl(apiOrigin: string, id: string, token: string): string {
  const params = new URLSearchParams({ token })
  return `${apiOrigin}/api/v1/privacy/requests/${encodeURIComponent(id)}/download?${params.toString()}`
}

/** `GET /api/v1/public/privacy/notice` — the versioned privacy notice generated from live configuration. */
export function getPrivacyNotice(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/public/privacy/notice', signal ? { signal } : undefined)
}

/** `GET /api/v1/public/privacy/notice-at-collection` — categories, purposes, retention, sale/share status. */
export function getNoticeAtCollection(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/public/privacy/notice-at-collection', signal ? { signal } : undefined)
}

/** `GET /api/v1/public/privacy/metrics` — annual request metrics (CCPA disclosure), from the request ledger. */
export function getPublicMetrics(
  client: TypedApiClient,
  query?: { year?: number },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/public/privacy/metrics', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}

/** `GET /api/v1/public/subprocessors` — the public sub-processor list with role and transfer mechanism. */
export function listPublicSubprocessors(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/public/subprocessors', signal ? { signal } : undefined)
}

/** `GET /api/v1/tenant/privacy/requests` — the tenant's own end users' DSRs (processor role). */
export function listTenantDsrs(
  client: TypedApiClient,
  query?: { status?: Schemas['DsrStatus'] },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/privacy/requests', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/tenant/privacy/requests` — tenant admin acting for their end users. */
export function submitTenantDsr(client: TypedApiClient, body: Schemas['SubmitDsrCommand']) {
  return client.POST('/api/v1/tenant/privacy/requests', body)
}

/** `GET /api/v1/platform/privacy/requests` — operator view of every DSR. */
export function listDsrs(
  client: TypedApiClient,
  query?: { status?: Schemas['DsrStatus'] },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/platform/privacy/requests', {
    params: { query },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/privacy/requests/{id}/extend` — the one deadline extension; jurisdiction rules apply. */
export function extendDsr(client: TypedApiClient, id: string) {
  return client.POST('/api/v1/platform/privacy/requests/{id}/extend', undefined, {
    params: { path: { id } },
  })
}

/** `POST /api/v1/platform/privacy/requests/{id}/reject` — reject with a reason shown to the subject; US subjects get the appeal route. */
export function rejectDsr(
  client: TypedApiClient,
  id: string,
  body: Schemas['RejectRequestRequest'],
) {
  return client.POST('/api/v1/platform/privacy/requests/{id}/reject', body, {
    params: { path: { id } },
  })
}

/** `GET /api/v1/platform/privacy/appeals` — open appeals. */
export function listAppeals(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/appeals', signal ? { signal } : undefined)
}

/** `POST /api/v1/platform/privacy/appeals/{id}/decision` — second-operator review; 409 when the decider decided the original. */
export function decideAppeal(
  client: TypedApiClient,
  id: string,
  body: Schemas['DecideAppealRequest'],
) {
  return client.POST('/api/v1/platform/privacy/appeals/{id}/decision', body, {
    params: { path: { id } },
  })
}

/** `GET /api/v1/platform/privacy/holds` — legal holds. */
export function listHolds(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/holds', signal ? { signal } : undefined)
}

/** `POST /api/v1/platform/privacy/holds` — apply a legal hold (blocks erasure; audited). */
export function applyHold(client: TypedApiClient, body: Schemas['ApplyLegalHoldCommand']) {
  return client.POST('/api/v1/platform/privacy/holds', body)
}

/** `POST /api/v1/platform/privacy/holds/{id}/release` — release a hold. */
export function releaseHold(client: TypedApiClient, id: string) {
  return client.POST('/api/v1/platform/privacy/holds/{id}/release', undefined, {
    params: { path: { id } },
  })
}

/** `GET /api/v1/platform/privacy/incidents` — breach incidents. */
export function listIncidents(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/incidents', signal ? { signal } : undefined)
}

/** `POST /api/v1/platform/privacy/incidents` — record an incident; the response includes computed per-jurisdiction obligations. */
export function recordIncident(
  client: TypedApiClient,
  body: Schemas['RecordBreachIncidentCommand'],
) {
  return client.POST('/api/v1/platform/privacy/incidents', body)
}

/** `GET /api/v1/platform/privacy/incidents/{id}/obligations` — computed per-jurisdiction obligations. */
export function listObligations(client: TypedApiClient, id: string, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/incidents/{id}/obligations', {
    params: { path: { id } },
    ...(signal ? { signal } : {}),
  })
}

/** `POST /api/v1/platform/privacy/incidents/{id}/notify` — record a discharged obligation. */
export function markObligationNotified(
  client: TypedApiClient,
  id: string,
  body: Schemas['MarkBreachNotifiedCommand'],
) {
  return client.POST('/api/v1/platform/privacy/incidents/{id}/notify', body, {
    params: { path: { id } },
  })
}

/** `GET /api/v1/platform/privacy/jurisdictions` — jurisdiction profiles. */
export function listJurisdictions(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/jurisdictions', signal ? { signal } : undefined)
}

/** `PUT /api/v1/platform/privacy/jurisdictions` — upsert a profile (audited configuration). */
export function upsertJurisdiction(
  client: TypedApiClient,
  body: Schemas['UpsertJurisdictionCommand'],
) {
  return client.PUT('/api/v1/platform/privacy/jurisdictions', body)
}

/** `GET /api/v1/platform/privacy/retention-rules` — retention rules; the notice's retention table comes from these rows. */
export function listRetentionRules(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/retention-rules', signal ? { signal } : undefined)
}

/** `PUT /api/v1/platform/privacy/retention-rules` — adjust a rule without a release. */
export function upsertRetentionRule(
  client: TypedApiClient,
  body: Schemas['UpsertRetentionRuleCommand'],
) {
  return client.PUT('/api/v1/platform/privacy/retention-rules', body)
}

/** `GET /api/v1/platform/privacy/subprocessors` — registry (incl. removed rows). */
export function listSubprocessors(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/subprocessors', signal ? { signal } : undefined)
}

/** `POST /api/v1/platform/privacy/subprocessors` — upsert; role decides what counts as a "sale" under US law. */
export function upsertSubprocessor(
  client: TypedApiClient,
  body: Schemas['UpsertSubProcessorCommand'],
) {
  return client.POST('/api/v1/platform/privacy/subprocessors', body)
}

/** `DELETE /api/v1/platform/privacy/subprocessors/{name}` — remove from the registry. */
export function removeSubprocessor(client: TypedApiClient, name: string) {
  return client.DELETE('/api/v1/platform/privacy/subprocessors/{name}', {
    params: { path: { name } },
  })
}

/** `GET /api/v1/platform/privacy/activities` — Art. 30 processing records. */
export function listActivities(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/activities', signal ? { signal } : undefined)
}

/** `POST /api/v1/platform/privacy/activities` — record a processing activity. */
export function upsertActivity(client: TypedApiClient, body: Schemas['UpsertActivityCommand']) {
  return client.POST('/api/v1/platform/privacy/activities', body)
}

/** `GET /api/v1/platform/privacy/assessments` — DPIA / US state data-protection assessments. */
export function listAssessments(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/platform/privacy/assessments', signal ? { signal } : undefined)
}

/** `POST /api/v1/platform/privacy/assessments` — record an assessment. */
export function upsertAssessment(client: TypedApiClient, body: Schemas['UpsertAssessmentCommand']) {
  return client.POST('/api/v1/platform/privacy/assessments', body)
}
