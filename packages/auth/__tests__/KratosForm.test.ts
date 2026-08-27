import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import KratosForm from '../src/components/KratosForm.svelte'
import type { KratosFlow } from '../src/kratos/types'

function loginFlow(): KratosFlow {
  return {
    id: 'flow-1',
    type: 'browser',
    issued_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-01-01T00:10:00Z',
    ui: {
      action: 'https://kratos.example.com/self-service/login?flow=flow-1',
      method: 'POST',
      messages: [{ id: 9999999, type: 'error', text: 'The provided credentials are invalid.' }],
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
          attributes: { node_type: 'input', name: 'identifier', type: 'text', required: true },
          messages: [],
          meta: { label: { id: 1, type: 'info', text: 'Email' } },
        },
        {
          type: 'input',
          group: 'password',
          attributes: { node_type: 'input', name: 'password', type: 'password', required: true },
          messages: [{ id: 4000006, type: 'error', text: 'That password is incorrect.' }],
          meta: { label: { id: 2, type: 'info', text: 'Password' } },
        },
        {
          type: 'input',
          group: 'password',
          attributes: { node_type: 'input', name: 'method', type: 'submit', value: 'password' },
          messages: [],
          meta: { label: { id: 3, type: 'info', text: 'Sign in' } },
        },
        {
          type: 'input',
          group: 'oidc',
          attributes: { node_type: 'input', name: 'provider', type: 'submit', value: 'google' },
          messages: [],
          meta: { label: { id: 4, type: 'info', text: 'Continue with Google' } },
        },
      ],
    },
  }
}

describe('KratosForm', () => {
  it('renders an un-catalogued flow-level message as-is (safe fallback)', () => {
    render(KratosForm, { props: { flow: loginFlow(), onSubmit: vi.fn() } })
    expect(screen.getByText('The provided credentials are invalid.')).toBeInTheDocument()
  })

  it('renders a catalogued field error via its override copy, and both labels', () => {
    render(KratosForm, { props: { flow: loginFlow(), onSubmit: vi.fn() } })

    expect(screen.getByText('That email or password is incorrect.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument()
  })

  it('renders one button per submit node, driven entirely by the flow', () => {
    render(KratosForm, { props: { flow: loginFlow(), onSubmit: vi.fn() } })

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  })

  it('renders two OIDC providers, whose submit nodes share name `provider` and differ only by value', () => {
    const flow = loginFlow()
    flow.ui.nodes.push({
      type: 'input',
      group: 'oidc',
      attributes: { node_type: 'input', name: 'provider', type: 'submit', value: 'microsoft' },
      messages: [],
      meta: { label: { id: 5, type: 'info', text: 'Continue with Microsoft' } },
    })

    render(KratosForm, { props: { flow, onSubmit: vi.fn() } })

    // A keyed-each duplicate-key crash on the shared `provider` name would
    // blank the whole form here.
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Microsoft' })).toBeInTheDocument()
  })

  it('submits the activated node plus the current field values, including hidden defaults', async () => {
    const onSubmit = vi.fn()
    render(KratosForm, { props: { flow: loginFlow(), onSubmit } })

    await fireEvent.input(screen.getByLabelText(/Email/), {
      target: { value: 'alice@example.com' },
    })
    await fireEvent.input(screen.getByLabelText(/Password/), { target: { value: 'hunter2' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(onSubmit).toHaveBeenCalledOnce()
    const [submitNode, values] = onSubmit.mock.calls[0]
    expect(submitNode.attributes.name).toBe('method')
    expect(submitNode.attributes.value).toBe('password')
    expect(values).toEqual({
      csrf_token: 'tok',
      identifier: 'alice@example.com',
      password: 'hunter2',
    })
  })

  it('submits the google node without the password field values leaking into it', async () => {
    const onSubmit = vi.fn()
    render(KratosForm, { props: { flow: loginFlow(), onSubmit } })

    await fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    const [submitNode] = onSubmit.mock.calls[0]
    expect(submitNode.attributes.name).toBe('provider')
    expect(submitNode.attributes.value).toBe('google')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(KratosForm, { props: { flow: loginFlow(), onSubmit: vi.fn() } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
