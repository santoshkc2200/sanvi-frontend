import { expect, test } from '@playwright/test'
import { setPrivacyContext } from './fixtures/privacy-context'

/**
 * DSR journeys: anonymous export request with email OTP, one-time download,
 * erasure with typed confirmation and honest retention explanation, and the
 * appeal route from a refused request.
 */

test.describe('DSR journeys', () => {
  test('anonymous export request: OTP verification, download once, second download refused', async ({
    page,
  }) => {
    await setPrivacyContext(page)
    await page.goto('/privacy/requests')

    await page.getByLabel(/What are you asking for/).selectOption('export')
    await page.getByLabel(/Your email address/).fill('subject@example.com')
    await page.getByRole('button', { name: 'Submit request' }).click()

    await expect(page.getByText(/Check your email/)).toBeVisible()
    await page.getByLabel(/One-time code/).fill('123456')
    await page.getByRole('button', { name: 'Confirm request' }).click()
    await expect(page.getByText(/Request submitted/)).toBeVisible()

    await page.getByRole('link', { name: 'View the request status' }).click()
    await expect(page.getByRole('heading', { name: 'Request status' })).toBeVisible()
    await expect(page.getByText(/export/i).first()).toBeVisible()

    // The status view explains the download but never shows the token
    // inline — the tokenized link arrived by email. Simulate opening that
    // emailed link by fetching the token from the mock's test hook.
    const requestId = new URL(page.url()).pathname.split('/').pop()!
    const token = await page.request
      .get(`http://localhost:8090/__privacy/download-token/${requestId}`)
      .then((r) => r.json())
      .then((body) => body.token as string)
    expect(token).toBeTruthy()

    const emailed = `/privacy/requests/${requestId}?token=${encodeURIComponent(token)}`
    await page.goto(emailed)
    const download = page.getByRole('link', { name: 'Download export' })
    await expect(download).toBeVisible()
    const href = await download.getAttribute('href')
    expect(href).toContain('token=')

    const first = await page.request.get(href!)
    expect(first.status()).toBe(200)
    expect(await first.text()).toContain('SANVI-EXPORT-BYTES')

    // One-time: the second attempt is gone (410).
    const second = await page.request.get(href!)
    expect(second.status()).toBe(410)
  })

  test('wrong OTP is refused and can be retried', async ({ page }) => {
    await setPrivacyContext(page)
    await page.goto('/privacy/requests')
    await page.getByLabel(/What are you asking for/).selectOption('access')
    await page.getByLabel(/Your email address/).fill('subject@example.com')
    await page.getByRole('button', { name: 'Submit request' }).click()
    await expect(page.getByText(/Check your email/)).toBeVisible()

    await page.getByLabel(/One-time code/).fill('000000')
    await page.getByRole('button', { name: 'Confirm request' }).click()
    await expect(page.getByText(/code was not accepted/)).toBeVisible()

    await page.getByLabel(/One-time code/).fill('123456')
    await page.getByRole('button', { name: 'Confirm request' }).click()
    await expect(page.getByText(/Request submitted/)).toBeVisible()
  })

  test('erasure explains retention, then requires typing the confirmation', async ({ page }) => {
    await setPrivacyContext(page)
    await page.goto('/privacy/erasure')

    await expect(page.getByRole('heading', { name: 'What is kept, and why' })).toBeVisible()
    await expect(page.getByText(/Invoices/)).toBeVisible()

    await page.getByLabel(/Your email address/).fill('subject@example.com')

    // Wrong confirmation keeps the button disabled — nothing can be submitted.
    await page.getByLabel(/Type ERASE to confirm/).fill('erase')
    await expect(page.getByRole('button', { name: 'Submit erasure request' })).toBeDisabled()

    await page.getByLabel(/Type ERASE to confirm/).fill('ERASE')
    await page.getByRole('button', { name: 'Submit erasure request' }).click()
    await expect(page.getByText(/Erasure request submitted/)).toBeVisible()
    await page.getByRole('link', { name: 'Open your request' }).click()
    await expect(page.getByRole('heading', { name: 'Request status' })).toBeVisible()
    await expect(page.url()).toMatch(/privacy\/requests\/req-/)
  })

  test('an authorized-agent submission records the authorisation and says the consumer verifies', async ({
    page,
  }) => {
    await setPrivacyContext(page)
    await page.goto('/privacy/agent')
    await expect(page.getByText(/consumer will still be asked to verify/i)).toBeVisible()

    await page.getByLabel(/Your full name/).fill('Alex Agent')
    await page.getByLabel(/Your email address/).fill('agent@example.com')
    await page.getByLabel(/The consumer's email address/).fill('consumer@example.com')
    await page.getByLabel(/Authorisation evidence type/).selectOption('power_of_attorney')
    await page.getByLabel(/Evidence reference/).fill('doc-123')
    await page.getByRole('button', { name: 'Submit as agent' }).click()
    await expect(page.getByText(/Agent submission recorded/)).toBeVisible()
  })

  test('the privacy overview renders what is held and which rules apply', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByText(/Which rules apply/)).toBeVisible()
    await expect(page.getByText('eu')).toBeVisible()
    await expect(page.getByText(/Opt-in — nothing non-essential runs/)).toBeVisible()
    await expect(page.getByText(/Order history/)).toBeVisible()
  })

  test('legal content renders from the backend data: notice, sub-processors, metrics, cookies', async ({
    page,
  }) => {
    await page.goto('/legal/privacy-notice')
    await expect(page.getByText(/Notice version/)).toBeVisible()
    await expect(page.getByText(/2026\.1/).first()).toBeVisible()

    await page.goto('/legal/sub-processors')
    await expect(page.getByText('Stripe')).toBeVisible()
    await expect(page.getByText('Mailjet')).toBeVisible()

    await page.goto('/legal/request-metrics')
    await expect(page.getByText(/Received/)).toBeVisible()

    await page.goto('/legal/cookies')
    await expect(page.getByText('sanvi_consent')).toBeVisible()
    await expect(page.getByText('sanvi_device')).toBeVisible()
  })
})
