import type { components } from '@sanvi/api-client'
import type { ConsentModel, JurisdictionRef } from './purposes'

type PrivacyNoticeView = components['schemas']['PrivacyNoticeView']

/**
 * Resolves the presentation mode for a jurisdiction **from backend data** —
 * the public notice carries every jurisdiction's profile, including its
 * `consent_model`. This is a lookup, not a rule: no component may branch on
 * a jurisdiction literal, and this function is the only place a code meets a
 * model.
 *
 * Fail-safe default is `opt_in`: showing an EU banner to a US user is
 * over-collection and costs conversions; showing a US notice-and-opt-out to
 * an EU user processes without consent, which is unlawful. When the backend
 * cannot say, we ask permission.
 */
export function resolveConsentModel(
  notice: Pick<PrivacyNoticeView, 'jurisdictions'> | null | undefined,
  jurisdiction: JurisdictionRef | null | undefined,
): ConsentModel {
  if (!notice || !jurisdiction) return 'opt_in'
  const match = notice.jurisdictions.find((entry) => entry.code === jurisdiction)
  return (match?.consent_model as ConsentModel | undefined) ?? 'opt_in'
}

/**
 * The highest notice version across the resolved directives — the version a
 * notice-at-collection acknowledgement is measured against. Directives
 * without a version are ignored; when *no* directive carries one the
 * snapshot is treated as version-less (acknowledgement re-asked never).
 */
export function currentNoticeVersion(
  directives: readonly { notice_version?: string | null }[],
): string | null {
  let latest: string | null = null
  for (const directive of directives) {
    if (directive.notice_version && (!latest || directive.notice_version > latest)) {
      latest = directive.notice_version
    }
  }
  return latest
}
