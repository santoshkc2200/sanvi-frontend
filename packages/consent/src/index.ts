import { CONSENT_COOKIE, DEVICE_COOKIE } from './cookie'
import type { ProcessingPurpose } from './purposes'

export type {
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
export {
  CONSENTABLE_PURPOSES,
  ESSENTIAL_PURPOSE,
  GPC_PURPOSES,
  OPT_OUT_PURPOSES,
  isConsentable,
  requiresSaleShareConsent,
} from './purposes'
export {
  CONSENT_COOKIE,
  type CookieDocument,
  DEVICE_COOKIE,
  DEVICE_REF_ROTATION_DAYS,
  getOrCreateDeviceRef,
  parseStoredState,
  readCookie,
  type StoredConsentState,
  serializeStoredState,
  writeCookie,
} from './cookie'
export {
  ConsentStore,
  evaluateReprompt,
  type AcceptAllResult,
  type ConsentListener,
  type ConsentStoreOptions,
  type ConsentStoreSync,
  type ResolvedDecision,
} from './store'
export {
  SCRIPT_REVOKED_EVENT,
  ScriptBlockedError,
  createScriptGate,
  type GatedScript,
  type ScriptGateOptions,
  type ScriptRevokedDetail,
} from './loader'
export { currentNoticeVersion, resolveConsentModel } from './notice'

/**
 * The registry of cookies this platform's frontends set, keyed by the
 * purpose category the cookie policy renders. The cookie policy page is
 * generated from this list (plus the backend's directive purposes) so the
 * document cannot drift from what the app really sets.
 */
export const COOKIE_REGISTRY: readonly {
  name: string
  purpose: ProcessingPurpose
  setBy: string
}[] = [
  { name: CONSENT_COOKIE, purpose: 'essential', setBy: '@sanvi/consent (directive decisions)' },
  {
    name: DEVICE_COOKIE,
    purpose: 'essential',
    setBy: '@sanvi/consent (rotating device reference for pre-login opt-out signals)',
  },
]
