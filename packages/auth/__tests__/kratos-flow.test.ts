import type { ApiClient, RawResponse, RequestOptions } from '@sanvi/api-client'
import { describe, expect, it, vi } from 'vitest'
import {
  KratosRequestError,
  collectNodeValues,
  getFlow,
  requestLogoutUrl,
  startFlow,
  submitFlow,
} from '../src/kratos/flow'
import type { KratosFlow } from '../src/kratos/types'

function fakeClient(
  requestRaw: (path: string, options?: RequestOptions) => Promise<RawResponse<unknown>>,
): ApiClient {
  return {
    request: vi.fn(),
    requestRaw: requestRaw as ApiClient['requestRaw'],
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
}

function loginFlow(overrides: Partial<KratosFlow> = {}): KratosFlow {
  return {
    id: 'flow-1',
    type: 'browser',
    issued_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-01-01T00:10:00Z',
    ui: {
      action: 'https://kratos.example.com/self-service/login?flow=flow-1',
      method: 'POST',
      nodes: [
        {
          type: 'input',
          group: 'default',
          attributes: { node_type: 'input', name: 'csrf_token', type: 'hidden', value: 'tok' },
          messages: [],
          meta: {},
        },
        {
          type: 'input',
          group: 'password',
          attributes: { node_type: 'input', name: 'identifier', type: 'text' },
          messages: [],
          meta: {},
        },
        {
          type: 'input',
          group: 'password',
          attributes: { node_type: 'input', name: 'method', type: 'submit', value: 'password' },
          messages: [],
          meta: {},
        },
      ],
    },
    ...overrides,
  }
}

describe('startFlow', () => {
  it('GETs the browser endpoint and returns the flow on 2xx', async () => {
    const flow = loginFlow()
    const requestRaw = vi.fn().mockResolvedValue({ status: 200, body: flow })
    const result = await startFlow(fakeClient(requestRaw), 'login')

    expect(requestRaw).toHaveBeenCalledWith('/self-service/login/browser', {
      method: 'GET',
      query: { return_to: undefined, aal: undefined },
    })
    expect(result).toBe(flow)
  })

  it('passes return_to as a query param when given', async () => {
    const requestRaw = vi.fn().mockResolvedValue({ status: 200, body: loginFlow() })
    await startFlow(fakeClient(requestRaw), 'registration', { returnTo: '/welcome' })

    expect(requestRaw).toHaveBeenCalledWith('/self-service/registration/browser', {
      method: 'GET',
      query: { return_to: '/welcome', aal: undefined },
    })
  })

  it('passes aal=aal2 for a step-up login flow', async () => {
    const requestRaw = vi.fn().mockResolvedValue({ status: 200, body: loginFlow() })
    await startFlow(fakeClient(requestRaw), 'login', { aal: 'aal2' })

    expect(requestRaw).toHaveBeenCalledWith('/self-service/login/browser', {
      method: 'GET',
      query: { return_to: undefined, aal: 'aal2' },
    })
  })

  it('throws KratosRequestError on an unexpected status', async () => {
    const requestRaw = vi.fn().mockResolvedValue({ status: 500, body: undefined })
    await expect(startFlow(fakeClient(requestRaw), 'login')).rejects.toBeInstanceOf(
      KratosRequestError,
    )
  })
})

describe('getFlow', () => {
  it('GETs the flows endpoint with the id as a query param', async () => {
    const flow = loginFlow()
    const requestRaw = vi.fn().mockResolvedValue({ status: 200, body: flow })
    const result = await getFlow(fakeClient(requestRaw), 'login', 'flow-1')

    expect(requestRaw).toHaveBeenCalledWith('/self-service/login/flows', {
      method: 'GET',
      query: { id: 'flow-1' },
    })
    expect(result).toBe(flow)
  })
})

describe('collectNodeValues', () => {
  it('includes hidden field defaults but excludes submit/button nodes', () => {
    const values = collectNodeValues(loginFlow())
    expect(values).toEqual({ csrf_token: 'tok' })
  })
})

describe('submitFlow', () => {
  it('POSTs to the flow action with hidden defaults merged under the caller-supplied values', async () => {
    const flow = loginFlow()
    const requestRaw = vi.fn().mockResolvedValue({ status: 200, body: undefined })
    const client = fakeClient(requestRaw)

    const result = await submitFlow(client, flow, {
      identifier: 'alice@example.com',
      method: 'password',
      password: 'hunter2',
    })

    expect(result).toEqual({ kind: 'success', flow: undefined })
    expect(requestRaw).toHaveBeenCalledWith(flow.ui.action, {
      method: 'POST',
      body: {
        csrf_token: 'tok',
        identifier: 'alice@example.com',
        method: 'password',
        password: 'hunter2',
      },
    })
  })

  it('returns the updated flow on 2xx when the response is flow-shaped (recovery/verification/settings stay on the same page)', async () => {
    const flow = loginFlow()
    const sentEmailFlow = loginFlow({ id: 'flow-1', state: 'sent_email' })
    const requestRaw = vi.fn().mockResolvedValue({ status: 200, body: sentEmailFlow })

    const result = await submitFlow(fakeClient(requestRaw), flow, { email: 'alice@example.com' })

    expect(result).toEqual({ kind: 'success', flow: sentEmailFlow })
  })

  it('returns a validation_error result with the re-rendered flow on 400', async () => {
    const flow = loginFlow()
    const invalidFlow = loginFlow({ id: 'flow-1-retry' })
    const requestRaw = vi.fn().mockResolvedValue({ status: 400, body: invalidFlow })

    const result = await submitFlow(fakeClient(requestRaw), flow, {})

    expect(result).toEqual({ kind: 'validation_error', flow: invalidFlow })
  })

  it('returns an expired result on 410, carrying the replacement flow id', async () => {
    const requestRaw = vi.fn().mockResolvedValue({
      status: 410,
      body: {
        error: { id: 'self_service_flow_expired', code: 410, message: 'expired' },
        use_flow_id: 'flow-2',
      },
    })

    const result = await submitFlow(fakeClient(requestRaw), loginFlow(), {})

    expect(result).toEqual({ kind: 'expired', useFlowId: 'flow-2' })
  })

  it('throws KratosRequestError for a response that matches none of the known shapes', async () => {
    const requestRaw = vi.fn().mockResolvedValue({ status: 500, body: undefined })
    await expect(submitFlow(fakeClient(requestRaw), loginFlow(), {})).rejects.toBeInstanceOf(
      KratosRequestError,
    )
  })
})

describe('requestLogoutUrl', () => {
  it('returns the logout_url from a successful response', async () => {
    const requestRaw = vi.fn().mockResolvedValue({
      status: 200,
      body: { logout_url: 'https://kratos.example.com/logout', logout_token: 't' },
    })

    await expect(requestLogoutUrl(fakeClient(requestRaw))).resolves.toBe(
      'https://kratos.example.com/logout',
    )
  })
})
