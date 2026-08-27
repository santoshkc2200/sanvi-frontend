// Session (SPA store)
export {
  bootSession,
  getLastDeniedPermission,
  getSession,
  isSessionHydrated,
  logout,
  onSessionChange,
  refreshSession,
  setSession,
  startSessionAutoRefresh,
} from './store.svelte'

// Session (SSR context)
export { getSessionContext, requireSessionContext, setSessionContext } from './context'

// Session types
export { hydrateSession, membershipFor } from './session'
export type { MembershipSummary, Session } from './session'

// Permissions
export { can, hasPermission } from './can'
export { default as Can } from './components/Can.svelte'

// Guards (SPA — spa-router `RouteDefinition['guard']` factories)
export { requireAal2, requirePermission, requireSession } from './guards'

// Open-redirect guard
export { safeReturnTo } from './return-to'

// Account linking
export { abandonLinking, completeLinking, getPendingLink, startLinking } from './linking'
export type { PendingLink } from './linking'

// Kratos flow client
export { createKratosClient } from './kratos/client'
export {
  collectNodeValues,
  getFlow,
  KratosRequestError,
  requestLogoutUrl,
  startFlow,
  submitFlow,
} from './kratos/flow'
export type { StartFlowOptions, SubmitFlowResult } from './kratos/flow'
export { translateKratosMessage } from './kratos/messages'
export type {
  FlowKind,
  FlowState,
  KratosFlow,
  UiContainer,
  UiNode,
  UiNodeAttributes,
  UiNodeGroup,
  UiText,
} from './kratos/types'

// Components
export { default as KratosForm } from './components/KratosForm.svelte'
