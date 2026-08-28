import {
  createApiClient,
  createTypedApiClient,
  getDirectives,
  getNoticeAtCollection,
  getPrivacyNotice,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { resolveConsentModel } from '@sanvi/consent'
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
}

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

  try {
    const { snapshot } = await getDirectives(client)
    const [notice, noticeAtCollection] = await Promise.all([
      getPrivacyNotice(client).catch(() => null),
      getNoticeAtCollection(client).catch(() => null),
    ])
    return {
      snapshot,
      model: resolveConsentModel(notice, snapshot.jurisdiction),
      notice,
      noticeAtCollection,
    }
  } catch {
    return null
  }
}
