import type { ConsentStore } from './store'
import type { ProcessingPurpose } from './purposes'

/**
 * The gated third-party script loader — the only sanctioned path for a
 * non-essential `<script>` to enter the page.
 *
 * Rules the phase-05 plan pins down:
 * - opt-in mode: nothing non-essential loads before a decision (the gate
 *   refuses while the purpose sits at its default);
 * - notice-and-opt-out mode: ad/audience purposes additionally wait until
 *   the directive snapshot resolves and the opt-out state is known — which,
 *   for this store, is always true post-construction, so a US opt-out holds
 *   from first paint;
 * - an allow-list: a URL not on it is a developer mistake, refused loudly
 *   rather than loaded quietly (lint + CSP back this up);
 * - revocation is cleanup, not just gating: when a purpose flips to denied,
 *   the loader removes the elements it injected and announces the revocation
 *   so integrations can drop their cookies and buffers.
 */

/** Fired on `document` when injected scripts are removed because a purpose was revoked. */
export const SCRIPT_REVOKED_EVENT = 'sanvi:consent-script-revoked'

export interface ScriptRevokedDetail {
  src: string
  purposes: readonly ProcessingPurpose[]
}

export interface GatedScript {
  src: string
  purposes: readonly ProcessingPurpose[]
  /** Extra attributes (`async`, `data-*`) copied onto the element. */
  attributes?: Record<string, string>
}

export class ScriptBlockedError extends Error {
  constructor(
    message: string,
    readonly src: string,
    readonly purposes: readonly ProcessingPurpose[],
  ) {
    super(message)
    this.name = 'ScriptBlockedError'
  }
}

export interface ScriptGateOptions {
  store: ConsentStore
  /** Exact URLs allowed to load (after normalization). Everything else is refused. */
  allowList: readonly string[]
  /** Injectable for tests; defaults to the global document. */
  doc?: Document
}

interface LoadedEntry {
  element: HTMLScriptElement
  purposes: readonly ProcessingPurpose[]
}

interface DocumentLike {
  createElement: (tag: 'script') => HTMLScriptElement
  head: HTMLElement
}

export function createScriptGate(options: ScriptGateOptions) {
  const doc: DocumentLike = options.doc ?? document
  const allowList = new Set(options.allowList.map(normalizeUrl))
  const loaded = new Map<string, LoadedEntry>()
  const pending = new Map<string, Promise<HTMLScriptElement>>()

  /**
   * The document itself, so the event matches its documented contract. Falls
   * back to `head` only for a stub `doc` in tests that isn't an EventTarget.
   */
  const dispatchTarget: EventTarget =
    'dispatchEvent' in doc ? (doc as unknown as EventTarget) : doc.head

  function announceRevoked(src: string, purposes: readonly ProcessingPurpose[]): void {
    dispatchTarget.dispatchEvent(
      new CustomEvent<ScriptRevokedDetail>(SCRIPT_REVOKED_EVENT, {
        detail: { src, purposes },
        bubbles: true,
      }),
    )
  }

  const isDenied = (purposes: readonly ProcessingPurpose[]): boolean =>
    purposes.some((purpose) => !options.store.isAllowed(purpose))

  const unsubscribe = options.store.subscribe(() => {
    for (const [src, entry] of loaded) {
      if (!isDenied(entry.purposes)) continue
      entry.element.remove()
      loaded.delete(src)
      announceRevoked(src, entry.purposes)
    }
    // In-flight loads need no bookkeeping here: `load`'s own handler re-checks
    // the store when the script lands, which is both later and authoritative.
  })

  /**
   * Loads `script` when every one of its purposes is allowed; resolves with
   * the element on the script's `load` event. Refuses — with
   * {@link ScriptBlockedError}, never a queue — when a purpose is not
   * allowed. A queue that flushes on a later permission would be
   * retroactive collection. Concurrent loads of one URL share the request.
   */
  function load(script: GatedScript): Promise<HTMLScriptElement> {
    const blocked = script.purposes.find((purpose) => !options.store.isAllowed(purpose))
    if (blocked) {
      return Promise.reject(
        new ScriptBlockedError(`Purpose "${blocked}" is not allowed`, script.src, script.purposes),
      )
    }
    if (!allowList.has(normalizeUrl(script.src))) {
      return Promise.reject(
        new ScriptBlockedError(
          `"${script.src}" is not on the script allow-list — add it deliberately or don't load it`,
          script.src,
          script.purposes,
        ),
      )
    }
    const existing = loaded.get(script.src)
    if (existing) return Promise.resolve(existing.element)
    const inFlight = pending.get(script.src)
    if (inFlight) return inFlight

    const promise = new Promise<HTMLScriptElement>((resolve, reject) => {
      const element = doc.createElement('script')
      element.src = script.src
      element.async = true
      element.dataset['sanviGated'] = 'true'
      for (const [name, value] of Object.entries(script.attributes ?? {})) {
        element.setAttribute(name, value)
      }
      element.addEventListener('load', () => {
        // The gate check at call time can be stale by the time the script
        // lands: a revocation in that window must still take effect, and a
        // re-grant in that window must not cancel a load that is now allowed.
        // Re-reading the store here answers both.
        if (isDenied(script.purposes)) {
          element.remove()
          announceRevoked(script.src, script.purposes)
          reject(new ScriptBlockedError('Purpose revoked during load', script.src, script.purposes))
          return
        }
        loaded.set(script.src, { element, purposes: script.purposes })
        resolve(element)
      })
      element.addEventListener('error', () => {
        reject(new ScriptBlockedError(`Failed to load`, script.src, script.purposes))
      })
      doc.head.appendChild(element)
    }).finally(() => {
      pending.delete(script.src)
    })
    pending.set(script.src, promise)
    return promise
  }

  return {
    load,
    /** Test/teardown hook: stops watching for revocations. */
    dispose(): void {
      unsubscribe()
    },
    isLoaded(src: string): boolean {
      return loaded.has(src)
    },
  }
}

function normalizeUrl(url: string): string {
  try {
    return new URL(url, typeof location !== 'undefined' ? location.href : 'https://localhost').href
  } catch {
    return url
  }
}
