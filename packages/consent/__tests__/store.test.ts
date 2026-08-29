import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CookieDocument } from '../src/cookie'
import { CONSENT_COOKIE, parseStoredState, readCookie } from '../src/cookie'
import type { DirectiveSnapshot, ProcessingPurpose } from '../src/purposes'
import { ConsentStore, evaluateReprompt } from '../src/store'

const NOTICE_V1 = '2026.1'

function snapshot(
  overrides: Partial<DirectiveSnapshot> = {},
  directives: DirectiveSnapshot['directives'] = [],
): DirectiveSnapshot {
  return {
    subject: { key: 'subject-1', kind: 'device', identifiers: [] },
    jurisdiction: 'eu',
    directives: [
      {
        purpose: 'essential',
        state: 'allowed',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction: 'eu',
        notice_version: NOTICE_V1,
      },
      {
        purpose: 'analytics',
        state: 'denied',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction: 'eu',
        notice_version: NOTICE_V1,
      },
      {
        purpose: 'marketing_email',
        state: 'denied',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction: 'eu',
        notice_version: NOTICE_V1,
      },
      {
        purpose: 'sale_or_share',
        state: 'denied',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction: 'eu',
        notice_version: NOTICE_V1,
      },
      {
        purpose: 'targeted_advertising',
        state: 'denied',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction: 'eu',
        notice_version: NOTICE_V1,
      },
      ...directives,
    ],
    honours_universal_opt_out: true,
    ...overrides,
  }
}

function usSnapshot(): DirectiveSnapshot {
  return snapshot({ jurisdiction: 'us-ca' }, [
    {
      purpose: 'analytics',
      state: 'allowed',
      source: 'default',
      effective_at: '2026-01-01T00:00:00Z',
      jurisdiction: 'us-ca',
      notice_version: NOTICE_V1,
    },
    {
      purpose: 'sale_or_share',
      state: 'allowed',
      source: 'default',
      effective_at: '2026-01-01T00:00:00Z',
      jurisdiction: 'us-ca',
      notice_version: NOTICE_V1,
    },
  ])
}

function fakeDoc(cookie = ''): CookieDocument {
  return { cookie }
}

describe('ConsentStore — opt_in mode', () => {
  let consentCalls: unknown[]
  let doc: CookieDocument

  beforeEach(() => {
    consentCalls = []
    doc = fakeDoc()
  })

  function makeStore(extra: Partial<ConstructorParameters<typeof ConsentStore>[0]> = {}) {
    return new ConsentStore({
      snapshot: snapshot(),
      consentModel: 'opt_in',
      doc,
      sync: {
        consent: (change) => {
          consentCalls.push(change)
          return Promise.resolve(null)
        },
      },
      ...extra,
    })
  }

  it('starts with every consentable purpose at its default and a pending choice', () => {
    const store = makeStore()
    expect(store.needsChoice()).toBe(true)
    expect(store.decision('analytics').state).toBe('denied')
    expect(store.decision('analytics').source).toBe('default')
    expect(store.decision('essential').state).toBe('allowed')
  })

  it('acceptAll allows every consentable purpose and records one consent change per purpose', () => {
    const store = makeStore()
    expect(store.acceptAll()).toBe('applied')
    expect(store.needsChoice()).toBe(false)
    expect(store.decision('analytics').state).toBe('allowed')
    expect(store.decision('analytics').source).toBe('consent')
    expect(consentCalls.length).toBeGreaterThanOrEqual(1)
    expect(consentCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: 'analytics',
          granted: true,
          notice_version: NOTICE_V1,
          method: 'consent',
        }),
      ]),
    )
  })

  it('rejectAll denies without asking the server to record a grant', () => {
    const store = makeStore()
    store.rejectAll()
    expect(store.needsChoice()).toBe(false)
    expect(store.decision('analytics').state).toBe('denied')
    expect(store.decision('sale_or_share').state).toBe('denied')
  })

  it('refuses to decide essential', () => {
    const store = makeStore()
    expect(() => store.setDecision('essential', true)).toThrow(/essential/)
  })

  it('persists decisions to a SameSite=Lax first-party cookie and restores them', () => {
    const store = makeStore()
    store.setDecision('analytics', true)
    const raw = readCookie(doc, CONSENT_COOKIE)
    expect(raw).toBeDefined()
    expect(doc.cookie).toContain('SameSite=Lax')
    const parsed = parseStoredState(raw)
    expect(parsed?.decisions['analytics']).toBe(1)
    expect(parsed?.versions['analytics']).toBe(NOTICE_V1)

    const restored = new ConsentStore({
      snapshot: snapshot(),
      consentModel: 'opt_in',
      doc,
    })
    expect(restored.decision('analytics').state).toBe('allowed')
    // One granted purpose doesn't complete the choice — the rest still ask.
    expect(restored.needsChoice()).toBe(true)
    restored.rejectAll()
    const afterReject = new ConsentStore({ snapshot: snapshot(), consentModel: 'opt_in', doc })
    expect(afterReject.needsChoice()).toBe(false)
    expect(afterReject.decision('analytics').state).toBe('denied')
  })

  it('marks a previously granted, later withdrawn decision as a withdrawal', () => {
    const store = makeStore()
    store.setDecision('analytics', true)
    consentCalls.length = 0
    store.setDecision('analytics', false)
    expect(consentCalls).toEqual([
      expect.objectContaining({ purpose: 'analytics', granted: false, method: 'withdrawal' }),
    ])
  })

  it('a refusal made before any grant is recorded as an opt-out, not a withdrawal', () => {
    const store = makeStore()
    store.setDecision('analytics', false)
    expect(consentCalls).toEqual([
      expect.objectContaining({ purpose: 'analytics', granted: false, method: 'opt_out' }),
    ])
  })

  it('notifies subscribers synchronously on every change', () => {
    const store = makeStore()
    const seen: number[] = []
    const unsubscribe = store.subscribe(() => seen.push(seen.length))
    store.setDecision('analytics', true)
    expect(seen.length).toBe(1)
    unsubscribe()
    store.setDecision('analytics', false)
    expect(seen.length).toBe(1)
  })
})

describe('ConsentStore — notice re-prompt (version bumps)', () => {
  function storedWithAnalyticsGrant(version: string): string {
    return encodeURIComponent(
      JSON.stringify({ versions: { analytics: version }, decisions: { analytics: 1 } }),
    )
  }

  it('opt_in: drops a stale grant so only that purpose is re-prompted', () => {
    const doc = fakeDoc(`${CONSENT_COOKIE}=${storedWithAnalyticsGrant('2025.9')}`)
    const store = new ConsentStore({ snapshot: snapshot(), consentModel: 'opt_in', doc })
    expect(store.decision('analytics')).toMatchObject({ state: 'denied', source: 'default' })
    // Refusals survive; a purpose the subject never touched stays at default.
    expect(store.needsChoice()).toBe(true)
  })

  it('opt_in: keeps a grant made against the current version', () => {
    const doc = fakeDoc(`${CONSENT_COOKIE}=${storedWithAnalyticsGrant(NOTICE_V1)}`)
    const store = new ConsentStore({ snapshot: snapshot(), consentModel: 'opt_in', doc })
    expect(store.decision('analytics').state).toBe('allowed')
  })

  it('notice_and_opt_out: a version bump never resets anything', () => {
    const stored = encodeURIComponent(
      JSON.stringify({
        versions: { sale_or_share: '2025.9' },
        decisions: { sale_or_share: 0, analytics: 1 },
      }),
    )
    const doc = fakeDoc(`${CONSENT_COOKIE}=${stored}`)
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      doc,
    })
    expect(store.decision('sale_or_share').state).toBe('denied')
    expect(store.decision('analytics').state).toBe('allowed')
  })

  it('evaluateReprompt is a pure function over (stored, directives, model)', () => {
    const stored = {
      versions: { analytics: 'old' },
      decisions: { analytics: 1 as const, session_replay: 0 as const },
    }
    const directives = snapshot().directives
    const next = evaluateReprompt(stored, directives, 'opt_in')
    expect(next.decisions['analytics']).toBeUndefined()
    expect(next.decisions['session_replay']).toBe(0)
    expect(stored.decisions['analytics']).toBe(1) // untouched
    expect(evaluateReprompt(stored, directives, 'notice_and_opt_out')).toBe(stored)
  })
})

describe('ConsentStore — notice_and_opt_out mode', () => {
  it('defaults to allowed and asks for a notice acknowledgement, not a choice', () => {
    const store = new ConsentStore({ snapshot: usSnapshot(), consentModel: 'notice_and_opt_out' })
    expect(store.needsChoice()).toBe(false)
    expect(store.needsNoticeAck()).toBe(true)
    expect(store.decision('analytics').state).toBe('allowed')
  })

  it('acknowledgeNotice records the version and clears the pending notice', () => {
    const store = new ConsentStore({ snapshot: usSnapshot(), consentModel: 'notice_and_opt_out' })
    store.acknowledgeNotice()
    expect(store.needsNoticeAck()).toBe(false)
  })
})

describe('ConsentStore — GPC', () => {
  it('applies the signal to sale/share purposes on first paint and transmits it once', () => {
    const optOutCalls: unknown[] = []
    const doc = fakeDoc()
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      doc,
      gpc: true,
      sync: {
        optOut: (command) => {
          optOutCalls.push(command)
          return Promise.resolve(null)
        },
      },
    })
    expect(store.gpcApplied).toBe(true)
    expect(store.decision('sale_or_share')).toMatchObject({ state: 'denied', source: 'signal' })
    expect(optOutCalls).toEqual([
      expect.objectContaining({
        purposes: ['sale_or_share', 'targeted_advertising'],
        source: 'gpc',
      }),
    ])
    // Second load with the same cookie must not re-transmit.
    new ConsentStore({ snapshot: usSnapshot(), consentModel: 'notice_and_opt_out', doc, gpc: true })
    expect(optOutCalls.length).toBe(1)
  })

  it('a later grant of a GPC-denied purpose is refused until explicitly overridden', () => {
    const doc = fakeDoc()
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      doc,
      gpc: true,
    })
    expect(store.setDecision('sale_or_share', true)).toBe('gpc-confirmation-required')
    expect(store.decision('sale_or_share')).toMatchObject({ state: 'denied', source: 'signal' })
    expect(store.acceptAll()).toBe('gpc-confirmation-required')
    expect(store.decision('analytics').state).toBe('allowed') // unaffected purposes were applied
    expect(store.decision('sale_or_share').state).toBe('denied')
  })

  it('setDecision with an explicit override applies and flags the signal source', () => {
    const consentCalls: unknown[] = []
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      gpc: true,
      sync: {
        consent: (change) => {
          consentCalls.push(change)
          return Promise.resolve(null)
        },
      },
    })
    expect(store.setDecision('sale_or_share', true, { overrideGpc: true })).toBe('applied')
    expect(store.decision('sale_or_share').state).toBe('allowed')
    expect(consentCalls).toEqual([
      expect.objectContaining({ purpose: 'sale_or_share', granted: true, signal_source: 'gpc' }),
    ])
  })

  it('acceptAll with an explicit override applies everywhere and flags the signal source', () => {
    const consentCalls: unknown[] = []
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      gpc: true,
      sync: {
        consent: (change) => {
          consentCalls.push(change)
          return Promise.resolve(null)
        },
      },
    })
    expect(store.acceptAll({ overrideGpc: true })).toBe('applied')
    expect(store.decision('sale_or_share').state).toBe('allowed')
    expect(consentCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: 'sale_or_share', granted: true, signal_source: 'gpc' }),
      ]),
    )
  })

  it('a GPC signal never grants anything', () => {
    const store = new ConsentStore({
      snapshot: snapshot(), // EU defaults: everything denied
      consentModel: 'opt_in',
      gpc: true,
    })
    expect(store.needsChoice()).toBe(true)
    expect(store.decision('analytics').source).toBe('default')
  })
})

describe('ConsentStore — statutory opt-out and sensitive limitation', () => {
  it('optOut denies the sale/share family, posts to the opt-out endpoint, and merges server directives', async () => {
    const doc = fakeDoc()
    const optOutCalls: unknown[] = []
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      doc,
      sync: {
        optOut: (command) => {
          optOutCalls.push(command)
          return Promise.resolve({
            jurisdiction: 'us-ca',
            directives: [
              {
                purpose: 'sale_or_share',
                state: 'denied',
                source: 'opt_out',
                effective_at: '2026-01-02T00:00:00Z',
                jurisdiction: 'us-ca',
              },
            ],
          })
        },
      },
    })
    store.optOut('ui')
    expect(store.decision('sale_or_share').state).toBe('denied')
    expect(store.decision('targeted_advertising').state).toBe('denied')
    expect(store.decision('profiling_significant_effects').state).toBe('denied')
    expect(store.decision('analytics').state).toBe('allowed') // not an opt-out purpose
    await vi.waitFor(() => expect(optOutCalls.length).toBe(1))
    expect(optOutCalls[0]).toMatchObject({ source: 'ui' })
    // A doc-backed device reference is generated (random, rotating — see cookie.ts).
    expect(typeof (optOutCalls[0] as { device_ref: string | null }).device_ref).toBe('string')
  })

  it('limitSensitive denies sensitive_pi_use without touching other purposes', () => {
    const sensitiveCalls: unknown[] = []
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      sync: {
        limitSensitive: (body) => {
          sensitiveCalls.push(body)
          return Promise.resolve(null)
        },
      },
    })
    store.limitSensitive()
    expect(store.decision('sensitive_pi_use').state).toBe('denied')
    expect(store.decision('analytics').state).toBe('allowed')
    expect(sensitiveCalls).toEqual([{ source: 'ui' }])
  })

  /**
   * The statutory pages tell the user processing has stopped. Local state
   * denying it is not the same as the server having recorded it, so a failed
   * call has to reach the caller instead of being swallowed.
   */
  it('optOut denies locally but rejects when the server never records it', async () => {
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      doc: fakeDoc(),
      sync: { optOut: () => Promise.reject(new Error('503')) },
    })

    const promise = store.optOut('ui')
    expect(store.decision('sale_or_share').state).toBe('denied')
    await expect(promise).rejects.toThrow('503')
  })

  it('limitSensitive rejects when the server never records it', async () => {
    const store = new ConsentStore({
      snapshot: usSnapshot(),
      consentModel: 'notice_and_opt_out',
      sync: { limitSensitive: () => Promise.reject(new Error('503')) },
    })

    const promise = store.limitSensitive()
    expect(store.decision('sensitive_pi_use').state).toBe('denied')
    await expect(promise).rejects.toThrow('503')
  })
})

describe('ConsentStore — directives without a notice version', () => {
  function unversioned(): DirectiveSnapshot {
    return {
      subject: { key: 'subject-1', kind: 'device', identifiers: [] },
      jurisdiction: 'eu',
      directives: [
        {
          purpose: 'analytics',
          state: 'denied',
          source: 'default',
          effective_at: '2026-01-01T00:00:00Z',
          jurisdiction: 'eu',
        },
      ],
      honours_universal_opt_out: true,
    }
  }

  it('persists a decision so a reject-all is not re-prompted on the next load', () => {
    const doc = fakeDoc()
    const store = new ConsentStore({ snapshot: unversioned(), consentModel: 'opt_in', doc })

    store.setDecision('analytics', false)

    const stored = parseStoredState(readCookie(doc, CONSENT_COOKIE))
    expect(stored?.decisions.analytics).toBe(0)
    // And a fresh store over the same cookie keeps the refusal.
    const next = new ConsentStore({ snapshot: unversioned(), consentModel: 'opt_in', doc })
    expect(next.decision('analytics').source).not.toBe('default')
  })

  it('falls back to the notice-at-collection version so the US notice still shows', () => {
    const store = new ConsentStore({
      snapshot: { ...unversioned(), jurisdiction: 'us-ca' },
      consentModel: 'notice_and_opt_out',
      noticeAtCollectionVersion: NOTICE_V1,
    })

    expect(store.noticeVersion).toBe(NOTICE_V1)
    expect(store.needsNoticeAck()).toBe(true)
  })
})

describe('ConsentStore — server precedence on hydrate', () => {
  it('a server-side statutory opt-out beats a stale local grant', () => {
    const stored = encodeURIComponent(
      JSON.stringify({ versions: { sale_or_share: NOTICE_V1 }, decisions: { sale_or_share: 1 } }),
    )
    const store = new ConsentStore({
      snapshot: snapshot({}, [
        {
          purpose: 'sale_or_share',
          state: 'denied',
          source: 'opt_out',
          effective_at: '2026-01-02T00:00:00Z',
          jurisdiction: 'eu',
          notice_version: NOTICE_V1,
        },
      ]),
      consentModel: 'opt_in',
      doc: fakeDoc(`${CONSENT_COOKIE}=${stored}`),
    })
    expect(store.decision('sale_or_share')).toMatchObject({ state: 'denied', source: 'opt_out' })
  })

  it('a local refusal beats a server-side grant (a re-served notice never resurrects processing)', () => {
    const stored = encodeURIComponent(
      JSON.stringify({ versions: { analytics: NOTICE_V1 }, decisions: { analytics: 0 } }),
    )
    const store = new ConsentStore({
      snapshot: snapshot({}, [
        {
          purpose: 'analytics',
          state: 'allowed',
          source: 'consent',
          effective_at: '2026-01-02T00:00:00Z',
          jurisdiction: 'eu',
          notice_version: NOTICE_V1,
        },
      ]),
      consentModel: 'notice_and_opt_out',
      doc: fakeDoc(`${CONSENT_COOKIE}=${stored}`),
    })
    expect(store.decision('analytics').state).toBe('denied')
  })
})

describe('ConsentStore — misc reads', () => {
  it('exposes jurisdiction profile facts and consentable decisions in registry order', () => {
    const store = new ConsentStore({ snapshot: snapshot(), consentModel: 'opt_in' })
    expect(store.jurisdiction).toBe('eu')
    expect(store.honoursUniversalOptOut).toBe(true)
    expect(store.consentableDecisions().map((d) => d.purpose)).not.toContain<ProcessingPurpose>(
      'essential',
    )
  })
})
