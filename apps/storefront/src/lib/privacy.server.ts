import {
  createApiClient,
  createTypedApiClient,
  getDirectives,
  getNoticeAtCollection,
  getPrivacyNotice,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { CONSENT_COOKIE, ConsentStore, readCookie, resolveConsentModel } from '@sanvi/consent'
import type { ConsentModel } from '@sanvi/consent'
import { getAppEnv } from '$lib/env'

type DirectiveSnapshot = components['schemas']['DirectiveSnapshot']
type PrivacyNoticeView = components['schemas']['PrivacyNoticeView']
type NoticeAtCollectionView = components['schemas']['NoticeAtCollectionView']

/**
 * Everything the privacy surfaces need, resolved once per request on the
 * server so the consent banner/notice can render before first paint:
 *
 * - the subject's directive snapshot (`GET /api/v1/privacy/directives`),
 *   called with the request's cookies so the session — or the device-ref
 *   cookie for anonymous visitors — identifies the subject;
 * - the public notice, which is also how the presentation mode is decided:
 *   `resolveConsentModel` looks the directive's jurisdiction up in the
 *   notice's jurisdiction profiles. No component ever branches on a code.
 *
 * Any failure here yields `null`, not a 500: phase-05's surfaces must
 * degrade to "no consent surface" rather than take the storefront down,
 * and the backend may simply not expose the phase-05 API yet.
 */
export interface PrivacyContext {
  snapshot: DirectiveSnapshot
  model: ConsentModel
  notice: PrivacyNoticeView | null
  noticeAtCollection: NoticeAtCollectionView | null
  /**
   * Whether the banner is due, decided here rather than after hydration so
   * the consent surface is in the server-rendered HTML. Computed from a
   * document-less {@link ConsentStore} over the request's own consent cookie,
   * so it is the same predicate the browser store applies — not a second
   * implementation that can drift from it.
   */
  initialView: { showOptIn: boolean; showNotice: boolean }
}

/**
 * Milliseconds before we give up on the privacy API and serve the page
 * without consent surfaces. 3 s is intentionally short: a hanging
 * privacy service must not cascade into a storefront outage.
 */
const PRIVACY_TIMEOUT_MS = 3000

export async function loadPrivacyContext(
  cookieHeader: string | null,
): Promise<PrivacyContext | null> {
  const { apiOrigin } = getAppEnv()
  const client = createTypedApiClient(
    createApiClient({
      baseUrl: apiOrigin,
      credentials: 'include',
      // Forward the browser's cookies so the backend can resolve the
      // subject server-side (session or device reference).
      getExtraHeaders: cookieHeader ? () => ({ cookie: cookieHeader }) : undefined,
    }),
  )

  // The three calls are independent, so they go out together rather than in
  // series, and the abort signal is what actually bounds the wait: a bare
  // `Promise.race` against a timer leaves the requests running and the
  // connections held for as long as the API hangs.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PRIVACY_TIMEOUT_MS)

  try {
    const [directives, notice, noticeAtCollection] = await Promise.all([
      getDirectives(client, controller.signal),
      getPrivacyNotice(client, controller.signal).catch(() => null),
      getNoticeAtCollection(client, controller.signal).catch(() => null),
    ])
    const { snapshot } = directives
    const model = resolveConsentModel(notice, snapshot.jurisdiction)
    return {
      snapshot,
      model,
      notice,
      noticeAtCollection,
      initialView: resolveInitialView(snapshot, model, noticeAtCollection, cookieHeader),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function resolveInitialView(
  snapshot: DirectiveSnapshot,
  model: ConsentModel,
  noticeAtCollection: NoticeAtCollectionView | null,
  cookieHeader: string | null,
): { showOptIn: boolean; showNotice: boolean } {
  // No `doc`: the store reads the cookie value handed to it and its
  // `#persist` is a no-op, so this is a pure read of the same state machine
  // the client will build from the same cookie on hydration.
  const store = new ConsentStore({
    snapshot,
    consentModel: model,
    storedCookie: readCookie({ cookie: cookieHeader ?? '' }, CONSENT_COOKIE) ?? null,
    noticeAtCollectionVersion: noticeAtCollection?.notice_version ?? null,
  })
  return {
    showOptIn: model === 'opt_in' && store.needsChoice(),
    showNotice: model === 'notice_and_opt_out' && store.needsNoticeAck(),
  }
}
