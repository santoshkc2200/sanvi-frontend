import type {
  ConsentChangeRequest,
  ConsentModel,
  DirectiveSnapshot,
  DirectiveSource,
  DirectiveState,
  JurisdictionRef,
  ProcessingPurpose,
  PurposeDirective,
  RecordOptOutCommand,
} from './purposes'
import {
  CONSENTABLE_PURPOSES,
  ESSENTIAL_PURPOSE,
  GPC_PURPOSES,
  OPT_OUT_PURPOSES,
  isConsentable,
} from './purposes'
import {
  CONSENT_COOKIE,
  CONSENT_COOKIE_MAX_AGE_DAYS,
  type CookieDocument,
  type StoredConsentState,
  getOrCreateDeviceRef,
  parseStoredState,
  readCookie,
  serializeStoredState,
  writeCookie,
} from './cookie'
import { currentNoticeVersion } from './notice'

/**
 * The consent directive store.
 *
 * One source of truth for "what may this browser's processing do", merged
 * from three layers, most specific last:
 *
 * 1. the backend's directive snapshot (the authoritative record, and the
 *    only source of jurisdiction + defaults);
 * 2. this device's stored decisions (the first-party cookie — fast, and
 *    what makes the choice stick between server syncs);
 * 3. runtime signals — currently GPC (`navigator.globalPrivacyControl`),
 *    which always outranks a stored grant for its purposes.
 *
 * The store never fetches: server sync is injected by the app (which is the
 * only layer allowed to call `@sanvi/api-client`), so the state machine here
 * is testable headless and this package stays fetch-free by construction.
 */

export interface ResolvedDecision {
  purpose: ProcessingPurpose
  state: DirectiveState
  source: DirectiveSource
  /** Notice version the *user's* decision was made against, when known. */
  noticeVersion: string | null
}

export interface ConsentStoreSync {
  /** `PUT /api/v1/privacy/consents` — one purpose decision, for the proof ledger. */
  consent?: (change: ConsentChangeRequest) => Promise<unknown>
  /** `POST /api/v1/privacy/opt-out` — the no-verification statutory opt-out. */
  optOut?: (command: RecordOptOutCommand) => Promise<unknown>
  /** `POST /api/v1/privacy/limit-sensitive` — CPRA sensitive-PI limitation. */
  limitSensitive?: (body: { source?: string | null }) => Promise<unknown>
}

export interface ConsentStoreOptions {
  snapshot: DirectiveSnapshot
  /** Presentation mode, resolved by the app from backend data (`resolveConsentModel`). */
  consentModel: ConsentModel
  /** Browser `document` (or lookalike). Absent → no persistence (SSR/tests). */
  doc?: CookieDocument
  /** Injected server sync; failures never block or roll back local state. */
  sync?: ConsentStoreSync
  /** `navigator.globalPrivacyControl` as detected by the caller (client-only). */
  gpc?: boolean
  locale?: string
  randomId?: () => string
  now?: () => number
}

export type ConsentListener = (store: ConsentStore) => void

/**
 * `acceptAll` result. `'gpc-confirmation-required'` means a browser privacy
 * signal is holding some purposes denied and the plan requires the caller to
 * get an explicit confirmation before overriding it — the store will not act
 * until `acceptAll({ overrideGpc: true })` arrives from that confirmation.
 */
export type AcceptAllResult = 'applied' | 'gpc-confirmation-required'

/**
 * Notice-version re-prompt evaluation. Mutates nothing on the server — it
 * only decides which stored decisions survive a version bump:
 *
 * - `opt_in`: a *granted* decision made against a different (older) notice
 *   version is dropped back to the default, so only the affected purposes
 *   are re-prompted. Refusals are kept — re-asking a refusal is pressure,
 *   and a refusal has nothing to re-consent to.
 * - `notice_and_opt_out`: nothing is ever reset. A version bump re-serves
 *   the notice; it must never clear an opt-out (clearing one is unlawful),
 *   and grants don't exist to refresh in this mode.
 */
export function evaluateReprompt(
  stored: StoredConsentState,
  directives: readonly PurposeDirective[],
  model: ConsentModel,
): StoredConsentState {
  if (model !== 'opt_in') return stored
  const next: StoredConsentState = {
    versions: { ...stored.versions },
    decisions: { ...stored.decisions },
    noticeAck: stored.noticeAck,
    updatedAt: stored.updatedAt,
  }
  for (const directive of directives) {
    const purpose = directive.purpose
    const decision = next.decisions[purpose]
    if (decision !== 1) continue // refusals survive a version bump
    const madeAgainst = next.versions[purpose]
    if (directive.notice_version && madeAgainst !== directive.notice_version) {
      delete next.decisions[purpose]
      delete next.versions[purpose]
    }
  }
  return next
}

const directiveDefaultState = (model: ConsentModel): DirectiveState =>
  model === 'opt_in' ? 'denied' : 'allowed'

export class ConsentStore {
  readonly #snapshot: DirectiveSnapshot
  readonly #model: ConsentModel
  readonly #doc: CookieDocument | undefined
  readonly #sync: ConsentStoreSync
  readonly #locale: string | undefined
  readonly #now: () => number
  readonly #randomId: () => string
  readonly #listeners = new Set<ConsentListener>()
  readonly #directives = new Map<ProcessingPurpose, PurposeDirective>()
  readonly #decisions = new Map<ProcessingPurpose, ResolvedDecision>()
  #stored: StoredConsentState
  #gpcApplied = false

  constructor(options: ConsentStoreOptions) {
    this.#snapshot = options.snapshot
    this.#model = options.consentModel
    this.#doc = options.doc
    this.#sync = options.sync ?? {}
    this.#locale = options.locale
    this.#now = options.now ?? Date.now
    this.#randomId = options.randomId ?? (() => `dev-${Math.random().toString(36).slice(2)}`)

    for (const directive of options.snapshot.directives) {
      this.#directives.set(directive.purpose, directive)
    }

    const raw = this.#doc ? readCookie(this.#doc, CONSENT_COOKIE) : undefined
    const parsed = parseStoredState(raw) ?? { versions: {}, decisions: {} }
    this.#stored = evaluateReprompt(parsed, options.snapshot.directives, this.#model)

    this.#hydrateDecisions()
    if (options.gpc) this.#applyGpcSignal()
    this.#persist()
    if (options.gpc && !this.#stored.gpcRecordedAt) {
      // Transmit the signal to the backend once per device-ref rotation —
      // it binds the pre-login signal server-side (Sec-GPC can't be set by
      // fetch; the body's `source: 'gpc'` is the honest transport).
      const command: RecordOptOutCommand = {
        purposes: [...GPC_PURPOSES],
        source: 'gpc',
        device_ref: this.#doc ? getOrCreateDeviceRef(this.#doc, this.#randomId, this.#now) : null,
      }
      this.#stored = { ...this.#stored, gpcRecordedAt: this.#now() }
      void this.#sync.optOut?.(command)?.catch(() => {})
    }
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  get model(): ConsentModel {
    return this.#model
  }

  get jurisdiction(): JurisdictionRef {
    return this.#snapshot.jurisdiction
  }

  get honoursUniversalOptOut(): boolean {
    return this.#snapshot.honours_universal_opt_out
  }

  get minorOptInAge(): number | null {
    return this.#snapshot.minor_opt_in_age ?? null
  }

  get gpcApplied(): boolean {
    return this.#gpcApplied
  }

  /** Current notice version (max across directives), or null when the snapshot carries none. */
  get noticeVersion(): string | null {
    return currentNoticeVersion(this.#snapshot.directives)
  }

  decision(purpose: ProcessingPurpose): ResolvedDecision {
    const resolved = this.#decisions.get(purpose)
    if (resolved) return resolved
    // `essential` never gets a stored decision — it is simply allowed.
    return {
      purpose,
      state: purpose === ESSENTIAL_PURPOSE ? 'allowed' : directiveDefaultState(this.#model),
      source: 'default',
      noticeVersion: null,
    }
  }

  /** Every consentable purpose, in registry order — the preference centre's row list. */
  consentableDecisions(): ResolvedDecision[] {
    return CONSENTABLE_PURPOSES.map((purpose) => this.decision(purpose))
  }

  isAllowed(purpose: ProcessingPurpose): boolean {
    return this.decision(purpose).state === 'allowed'
  }

  /** Opt-in mode: a choice is still pending while any consentable purpose sits at its default. */
  needsChoice(): boolean {
    if (this.#model !== 'opt_in') return false
    return CONSENTABLE_PURPOSES.some((purpose) => this.decision(purpose).source === 'default')
  }

  /** US mode: the notice at collection is unacknowledged for this notice version. */
  needsNoticeAck(): boolean {
    if (this.#model !== 'notice_and_opt_out') return false
    const version = this.noticeVersion
    return version !== null && this.#stored.noticeAck !== version
  }

  /** True when a browser privacy signal is denying purposes a stored grant would allow. */
  gpcOverridesGrant(): boolean {
    return GPC_PURPOSES.some((purpose) => {
      const decision = this.decision(purpose)
      return this.#gpcApplied && decision.source === 'signal'
    })
  }

  subscribe(listener: ConsentListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  acceptAll(options: { overrideGpc?: boolean } = {}): AcceptAllResult {
    const overriding = options.overrideGpc === true
    // A browser privacy signal is the subject's own act; a blanket "accept
    // all" may only override it after an explicit, separate confirmation.
    if (this.gpcOverridesGrant() && !overriding) return 'gpc-confirmation-required'
    for (const purpose of CONSENTABLE_PURPOSES) {
      if (
        this.#gpcApplied &&
        (GPC_PURPOSES as readonly string[]).includes(purpose) &&
        !overriding
      ) {
        continue
      }
      this.#decide(purpose, true, this.#gpcApplied && overriding ? 'gpc' : 'default')
    }
    return 'applied'
  }

  rejectAll(): void {
    for (const purpose of CONSENTABLE_PURPOSES) {
      this.#decide(purpose, false, 'default')
    }
  }

  /**
   * One purpose toggle (preference centre). Refuses `essential` — it is not
   * a choice. Granting a purpose currently held down by a browser privacy
   * signal requires the same explicit override as `acceptAll`.
   */
  setDecision(
    purpose: ProcessingPurpose,
    granted: boolean,
    options: { overrideGpc?: boolean } = {},
  ): AcceptAllResult {
    if (!isConsentable(purpose)) {
      throw new Error(`Purpose "${purpose}" is essential and cannot be decided`)
    }
    if (granted && this.#gpcApplied && !options.overrideGpc) {
      const held = this.decision(purpose)
      if ((GPC_PURPOSES as readonly string[]).includes(purpose) && held.source === 'signal') {
        return 'gpc-confirmation-required'
      }
    }
    this.#decide(purpose, granted, granted && options.overrideGpc === true ? 'gpc' : 'default')
    return 'applied'
  }

  /**
   * The statutory one-click opt-out — no verification, no confirmation
   * dialog. Denies the sale/share family, records via the dedicated
   * endpoint (rate-limited by device, not identity), and updates local
   * state from the server's returned directives when it answers.
   */
  optOut(source: string): void {
    const command: RecordOptOutCommand = {
      purposes: [...OPT_OUT_PURPOSES],
      source,
      device_ref: this.#doc ? getOrCreateDeviceRef(this.#doc, this.#randomId, this.#now) : null,
    }
    for (const purpose of OPT_OUT_PURPOSES) {
      this.#decisions.set(purpose, {
        purpose,
        state: 'denied',
        source: source === 'gpc' ? 'signal' : 'opt_out',
        noticeVersion: this.#stored.versions[purpose] ?? null,
      })
    }
    this.#persist()
    this.#emit()
    void this.#sync.optOut?.(command)?.then(
      (result) => {
        const directives = (result as { directives?: PurposeDirective[] } | undefined)?.directives
        if (!Array.isArray(directives)) return
        for (const directive of directives) {
          this.#decisions.set(directive.purpose, {
            purpose: directive.purpose,
            state: directive.state,
            source: directive.source,
            noticeVersion: directive.notice_version ?? null,
          })
        }
        this.#emit()
      },
      () => {}, // local state already reflects the refusal; server retried later
    )
  }

  /** CPRA "Limit the Use of My Sensitive Personal Information" — one click, no verification. */
  limitSensitive(source = 'ui'): void {
    this.#decisions.set('sensitive_pi_use', {
      purpose: 'sensitive_pi_use',
      state: 'denied',
      source: 'opt_out',
      noticeVersion: this.#stored.versions.sensitive_pi_use ?? null,
    })
    this.#persist()
    this.#emit()
    void this.#sync.limitSensitive?.({ source })?.catch(() => {})
  }

  /** Notice-at-collection acknowledgement (US mode) — not consent, just proof of notice. */
  acknowledgeNotice(): void {
    const version = this.noticeVersion
    if (!version) return
    this.#stored = { ...this.#stored, noticeAck: version, updatedAt: this.#now() }
    this.#persist()
    this.#emit()
  }

  // ── Internals ────────────────────────────────────────────────────────────

  #hydrateDecisions(): void {
    // Seed every consentable purpose — not just the ones the snapshot
    // carries — so a stored decision survives even when the backend's
    // directive list is narrower than the registry.
    for (const purpose of CONSENTABLE_PURPOSES) {
      const directive = this.#directives.get(purpose)
      const storedDecision = this.#stored.decisions[purpose]
      const storedVersion = this.#stored.versions[purpose] ?? null
      if (storedDecision === undefined) {
        this.#decisions.set(purpose, {
          purpose,
          state: directive?.state ?? directiveDefaultState(this.#model),
          source: directive?.source ?? 'default',
          noticeVersion: storedVersion,
        })
        continue
      }
      const source = directive?.source
      // Server-side statutory opt-outs and signals outrank a stale local
      // grant (the refusal must stick across devices); a local refusal
      // always wins over a server-side grant (re-serving a notice must
      // never resurrect processing the subject declined).
      const serverDenialIsStronger =
        directive?.state === 'denied' &&
        (source === 'opt_out' || source === 'signal') &&
        storedDecision === 1
      if (serverDenialIsStronger) {
        this.#decisions.set(purpose, {
          purpose,
          state: 'denied',
          source: source as DirectiveSource,
          noticeVersion: storedVersion,
        })
        continue
      }
      this.#decisions.set(purpose, {
        purpose,
        state: storedDecision === 1 ? 'allowed' : 'denied',
        source: source === 'guardian' ? 'guardian' : 'consent',
        noticeVersion: storedVersion,
      })
    }
  }

  #applyGpcSignal(): void {
    this.#gpcApplied = true
    for (const purpose of GPC_PURPOSES) {
      this.#decisions.set(purpose, {
        purpose,
        state: 'denied',
        source: 'signal',
        noticeVersion: this.#stored.versions[purpose] ?? null,
      })
    }
  }

  #decide(purpose: ProcessingPurpose, granted: boolean, signalSource: 'default' | 'gpc'): void {
    if (!isConsentable(purpose)) {
      throw new Error(`Purpose "${purpose}" is essential and cannot be decided`)
    }
    const previous = this.decision(purpose)
    const wasGranted = previous.state === 'allowed'
    const version = this.noticeVersion
    this.#decisions.set(purpose, {
      purpose,
      state: granted ? 'allowed' : 'denied',
      source: granted ? 'consent' : this.#model === 'opt_in' ? 'consent' : 'opt_out',
      noticeVersion: version,
    })
    if (version) {
      this.#stored = {
        ...this.#stored,
        versions: { ...this.#stored.versions, [purpose]: version },
        decisions: { ...this.#stored.decisions, [purpose]: granted ? 1 : 0 },
        updatedAt: this.#now(),
      }
    }
    this.#persist()
    this.#emit()
    const method: ConsentChangeRequest['method'] =
      !granted && wasGranted && previous.source !== 'default' ? 'withdrawal' : 'opt_out'
    const change: ConsentChangeRequest = {
      purpose,
      granted,
      notice_version: version ?? 'unknown',
      method: granted ? 'consent' : method,
      ...(this.#locale ? { locale: this.#locale } : {}),
      ...(signalSource === 'gpc' ? { signal_source: 'gpc' } : {}),
    }
    void this.#sync.consent?.(change)?.catch(() => {})
  }

  #persist(): void {
    if (!this.#doc) return
    writeCookie(
      this.#doc,
      CONSENT_COOKIE,
      serializeStoredState(this.#stored),
      CONSENT_COOKIE_MAX_AGE_DAYS,
    )
  }

  #emit(): void {
    for (const listener of this.#listeners) listener(this)
  }
}
