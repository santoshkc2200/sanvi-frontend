import { type FlowKind, type KratosFlow, getFlow, safeReturnTo, startFlow } from '@sanvi/auth'
import { kratosClient } from './auth'

export interface FlowLoadResult {
  flow: KratosFlow
  returnTo: string | undefined
}

/**
 * Shared `+page.ts` `load` body for every self-service route (`login`,
 * `registration`, `recovery`, `verification`, `settings`): resumes an
 * existing flow from `?flow=` (a page reload, or a redirect back from an
 * OIDC provider) or starts a fresh one, always validating `return_to`
 * before it goes anywhere near Kratos.
 */
export async function loadFlow(kind: FlowKind, url: URL): Promise<FlowLoadResult> {
  const returnTo = safeReturnTo(url.searchParams.get('return_to'))
  const flowId = url.searchParams.get('flow')
  const flow = flowId
    ? await getFlow(kratosClient, kind, flowId)
    : await startFlow(kratosClient, kind, { returnTo })
  return { flow, returnTo }
}
