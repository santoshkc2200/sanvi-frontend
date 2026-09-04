import type { ClickIds } from '@sanvi/api-client'

/**
 * Landing-time click-id capture for the conversion beacon.
 *
 * Ad platforms attribute a conversion by the click id they appended to the
 * landing URL (`gclid`, `gbraid`, `wbraid`). The beacon fires pages later,
 * on the order confirmation, where those params are long gone from the URL —
 * and the backend only sees the *confirmation* page as the beacon's
 * referrer. So the landing observation has to be stashed when it happens and
 * sent with the beacon body. The backend still prefers its own cookie-based
 * `_fbp`/`_fbc` observation and merges whatever the client sends.
 *
 * Storage is `sessionStorage`: a click id belongs to one visit, and keeping
 * it beyond the session would attribute an unrelated later purchase to an
 * old ad click. A missing or stale entry simply means "no click ids" — the
 * event still fires and the backend still records which ids were absent.
 */

const STORAGE_KEY = 'sanvi_ads_landing_click_ids'

const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid'] as const

interface StashedClickIds {
  ids: Pick<ClickIds, 'gclid' | 'gbraid' | 'wbraid'>
  captured_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Observes the current URL for ad click ids and stashes them for the
 * confirmation beacon. Safe to call on every page load: a URL without click
 * params never overwrites an earlier observation from the same session.
 */
export function stashLandingClickIds(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): void {
  if (typeof window === 'undefined' || !search) return
  const params = new URLSearchParams(search)
  const found: StashedClickIds['ids'] = {}
  for (const param of CLICK_ID_PARAMS) {
    const value = params.get(param)
    if (value) found[param] = value
  }
  if (Object.keys(found).length === 0) return
  try {
    const stash: StashedClickIds = { ids: found, captured_at: new Date().toISOString() }
    window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(stash))
  } catch {
    // Storage quota or disabled storage: the beacon fires without click ids.
  }
}

/**
 * The stashed landing click ids in the contract's `ClickIds` shape, or
 * `undefined` when nothing was observed this session.
 */
export function readStashedClickIds(): ClickIds | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.sessionStorage?.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !isRecord(parsed['ids'])) return undefined
    const ids = parsed['ids']
    const stashedAt = parsed['captured_at']
    const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null)
    const clickIds: ClickIds = {
      gclid: asString(ids['gclid']),
      gbraid: asString(ids['gbraid']),
      wbraid: asString(ids['wbraid']),
      capture_time: asString(stashedAt),
    }
    if (!clickIds.gclid && !clickIds.gbraid && !clickIds.wbraid) return undefined
    return clickIds
  } catch {
    return undefined
  }
}
