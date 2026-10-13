/**
 * A minimal Ory Kratos self-service mock for the harness runners
 * (TASK-027 step 1). The storefront's preview serves
 * `PUBLIC_KRATOS_ORIGIN=http://localhost:4433`, and until now nothing
 * listened there — every self-service page (`/login`, `/registration`,
 * `/recovery`, `/verification`, `/settings/security`) rendered the SvelteKit
 * 500 error page in the harness, so the axe sweep covered the error state
 * and never the real forms. This mock answers the two flow endpoints the
 * `@sanvi/auth` client calls (`GET /self-service/{kind}/browser`,
 * `GET /self-service/{kind}/flows?id=`) with browser-flow JSONs carrying
 * real form nodes, so the sweep exercises the actual sign-in, sign-up,
 * recovery, verification, and settings forms.
 *
 * Harness-only by design: the e2e specs deliberately have no Kratos mock
 * (they never navigate the auth pages), so wiring this into the shared
 * storefront fixture would change what e2e proves.
 */
import { createServer } from 'node:http'

const FLOW_TTL_HOURS = 1

function flow(kind, id, nodes, state) {
  const issuedAt = new Date()
  return {
    id,
    type: 'browser',
    ...(state ? { state } : {}),
    ui: { action: `/self-service/${kind}/flows`, method: 'POST', nodes },
    expires_at: new Date(issuedAt.getTime() + FLOW_TTL_HOURS * 3600_000).toISOString(),
    issued_at: issuedAt.toISOString(),
  }
}

function input(name, type, label, extra = {}) {
  return {
    type: 'input',
    group: extra.group ?? 'default',
    attributes: {
      node_type: 'input',
      name,
      type,
      ...(extra.value !== undefined ? { value: extra.value } : {}),
      ...(extra.required ? { required: true } : {}),
      ...(extra.autocomplete ? { autocomplete: extra.autocomplete } : {}),
      disabled: false,
    },
    messages: [],
    meta: { label: { id: 0, text: label, type: 'info' } },
  }
}

function submit(name, value, label, group = 'password') {
  return {
    type: 'input',
    group,
    attributes: { node_type: 'input', name, type: 'submit', value, disabled: false },
    messages: [],
    meta: { label: { id: 0, text: label, type: 'info' } },
  }
}

const csrfNode = () => input('csrf_token', 'hidden', 'CSRF token', { value: 'sweep-csrf' })

/** One flow per `FlowKind`, shaped like the real thing's default screen. */
const FLOWS = {
  login: () =>
    flow('login', 'sweep-login-flow', [
      csrfNode(),
      input('identifier', 'email', 'Email', { required: true, autocomplete: 'email' }),
      input('password', 'password', 'Password', {
        required: true,
        autocomplete: 'current-password',
      }),
      submit('method', 'password', 'Sign in'),
    ]),
  registration: () =>
    flow('registration', 'sweep-registration-flow', [
      csrfNode(),
      input('traits.email', 'email', 'Email', { required: true, autocomplete: 'email' }),
      input('password', 'password', 'Password', { required: true, autocomplete: 'new-password' }),
      submit('method', 'password', 'Sign up'),
    ]),
  recovery: () =>
    flow('recovery', 'sweep-recovery-flow', [
      csrfNode(),
      input('email', 'email', 'Email', { required: true, autocomplete: 'email' }),
      submit('method', 'link', 'Send recovery link'),
    ]),
  verification: () =>
    flow('verification', 'sweep-verification-flow', [
      csrfNode(),
      input('email', 'email', 'Email', { required: true, autocomplete: 'email' }),
      submit('method', 'link', 'Send verification link'),
    ]),
  settings: () =>
    flow(
      'settings',
      'sweep-settings-flow',
      [
        csrfNode(),
        input('traits.name', 'text', 'Display name', { required: true, autocomplete: 'name' }),
        submit('method', 'profile', 'Save'),
      ],
      'show_form',
    ),
}

export const KRATOS_MOCK_PORT = 4433

/**
 * Starts the Kratos mock. Returns a stop handle like the other serving
 * helpers.
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startKratosMock(port = KRATOS_MOCK_PORT) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://localhost:${port}`)
    const segments = url.pathname.split('/').filter(Boolean)
    // /self-service/{kind}/browser and /self-service/{kind}/flows
    if (segments[0] === 'self-service' && (segments[2] === 'browser' || segments[2] === 'flows')) {
      const kind = segments[1]
      const make = FLOWS[kind]
      if (make) {
        const body = make()
        if (segments[2] === 'flows') body.id = url.searchParams.get('id') ?? body.id
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(body))
        return
      }
    }
    // The storefront's server-side session resolution probes whoami on every
    // SSR request; anonymous (401) is this mock's honest answer.
    if (segments[0] === 'sessions' && segments[1] === 'whoami') {
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { id: 'session', message: 'No active session' } }))
      return
    }
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { id: 'not_found', message: 'Not found' } }))
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, () => resolve())
  })
  let stopped = false
  return {
    stop() {
      if (stopped) return
      stopped = true
      server.close()
    },
  }
}
