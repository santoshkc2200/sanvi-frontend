import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * TASK-024: logout must clear session state in **every** open tab, not only
 * the tab that clicked "Sign out everywhere".
 *
 * The tab that logs out navigates to Kratos's logout URL — its JS state dies
 * with the page. A second tab learns about the sign-out through the
 * `sanvi:auth` BroadcastChannel: its session store drops to null, its
 * memberships and query cache clear, and its very next navigation fails the
 * `requireSession` guard into the login screen — all without a reload, which
 * the marker below proves (a reload would wipe it; that is exactly the
 * pre-broadcast behaviour this spec exists to rule out).
 */

const KRATOS = 'http://acme.localhost:4433'

const SETTINGS_FLOW = {
  id: 'e2e-settings-flow',
  type: 'browser',
  state: 'show_form',
  expires_at: '2027-01-01T00:00:00Z',
  issued_at: '2026-01-01T00:00:00Z',
  ui: { action: `${KRATOS}/self-service/settings`, method: 'POST', messages: [], nodes: [] },
}

function stubKratos(context: BrowserContext): void {
  void context.route(`**${KRATOS}/self-service/settings/browser**`, (route) =>
    route.fulfill({ json: SETTINGS_FLOW }),
  )
  void context.route(`**${KRATOS}/self-service/logout/browser**`, (route) =>
    route.fulfill({ json: { logout_url: `${KRATOS}/self-service/logout?token=e2e` } }),
  )
  void context.route(`**${KRATOS}/self-service/logout?token=e2e**`, (route) =>
    route.fulfill({ body: '<html><body>signed out</body></html>', contentType: 'text/html' }),
  )
}

async function bootSignedIn(context: BrowserContext): Promise<Page> {
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  return page
}

test('logout in one tab clears the session in every open tab', async ({ browser }) => {
  const context = await browser.newContext()
  // Context-level mocks so both tabs answer from the same hermetic backend.
  mockBackend(context)
  stubKratos(context)

  const tabA = await bootSignedIn(context)
  const tabB = await bootSignedIn(context)

  // Survives client-side routing, dies on a reload — the "no reload" proof.
  await tabB.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).__sessionSpecMarker = 'tab-b-was-here'
  })

  // Sign out from tab A.
  await tabA.getByRole('link', { name: 'Security' }).click()
  await expect(tabA.getByRole('button', { name: 'Sign out everywhere' })).toBeVisible({
    timeout: 10_000,
  })
  await tabA.getByRole('button', { name: 'Sign out everywhere' }).click()

  // Tab A completes the real logout: a full navigation to Kratos's one-shot
  // logout URL, which clears the HttpOnly session cookie for the context.
  await expect(tabA).toHaveURL(new RegExp(`${KRATOS}/self-service/logout`))

  // Tab B must learn without a reload...
  await expect
    .poll(() =>
      tabB.evaluate(() => (window as unknown as Record<string, unknown>).__sessionSpecMarker),
    )
    .toBe('tab-b-was-here')
  await expect(tabB.evaluate(() => document.visibilityState)).resolves.toBe('visible')

  // ...and its session state must actually be gone: the very next
  // navigation fails requireSession into the login screen. The Settings
  // link carries no permission gate, so it stays rendered after the
  // membership clear — the redirect to /login is the guard's verdict, not a
  // vanished nav entry.
  await tabB.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(tabB).toHaveURL(/\/login/)

  // Storage-surface walk (TASK-024): after boot, a tenant journey and a
  // logout, the only things persisted client-side are namespaced
  // preferences and drafts — never a token, session artifact, or personal
  // data (the reviewed inventory is packages/lint-gates'
  // check-storage-surface.mjs).
  const storageKeys = await tabB.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
  }))
  for (const key of [...storageKeys.local, ...storageKeys.session]) {
    expect(key, key).toMatch(/^sanvi[:_]/)
  }
})
