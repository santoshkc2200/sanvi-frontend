import { expect, test } from '@playwright/test'
import { mockDomainsBackend } from './mock-domains-backend'

/**
 * Connect wizard, end to end against the mocked backend (no live network —
 * see mock-domains-backend.ts). Failure-state coverage here uses the real
 * DomainFailure codes DomainConnect.svelte actually switches on
 * (verified_by_other_tenant, challenge_expired) rather than inventing ones;
 * the full failure-code-to-copy matrix is already unit-tested in
 * apps/admin/__tests__/DomainConnect.test.ts — this suite is about the
 * wizard working end to end in a real browser, not exhaustive branch
 * coverage.
 */
test.describe('domain connect wizard', () => {
  test('happy path: enter domain, add records, verify, and go live', async ({ page }) => {
    const state = mockDomainsBackend(page)

    await page.goto('/domains/connect')
    await expect(
      page.getByRole('heading', { name: 'Step 1: Enter your domain', level: 2 }),
    ).toBeVisible()

    await page.getByPlaceholder('example.com or shop.example.com').fill('shop.example.com')
    await page.getByRole('button', { name: 'Continue to DNS setup' }).click()

    await expect(
      page.getByRole('heading', { name: 'Step 2: Add DNS records at your registrar', level: 2 }),
    ).toBeVisible()
    await expect(page.getByText('_sanvi-challenge.shop.example.com')).toBeVisible()

    await page.getByRole('button', { name: "I've added these records" }).click()
    await expect(
      page.getByRole('heading', { name: 'Step 3: Verifying DNS records', level: 2 }),
    ).toBeVisible()

    // The domain is still 'pending_setup' in the mock — flip it to 'live' to
    // simulate the backend's verification+cert-issuance jobs completing, then
    // let the wizard's own backoff poll pick it up.
    state.domains[0]!.status = 'live'
    state.domains[0]!.verified_at = new Date().toISOString()

    await expect(
      page.getByRole('heading', { name: 'Step 5: Your domain is live!', level: 2 }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('conflicting record: another tenant already verified this hostname', async ({ page }) => {
    const state = mockDomainsBackend(page)

    await page.goto('/domains/connect')
    await page.getByPlaceholder('example.com or shop.example.com').fill('taken.example.com')
    await page.getByRole('button', { name: 'Continue to DNS setup' }).click()
    await page.getByRole('button', { name: "I've added these records" }).click()

    state.domains[0]!.status = 'verifying'
    state.domains[0]!.failure = {
      code: 'verified_by_other_tenant',
      detail: 'already claimed',
    }

    await expect(
      page.getByText('This hostname was claimed and verified by another tenant.'),
    ).toBeVisible({ timeout: 10000 })
  })

  test('verification timeout: the challenge expires before DNS propagates', async ({ page }) => {
    const state = mockDomainsBackend(page)

    await page.goto('/domains/connect')
    await page.getByPlaceholder('example.com or shop.example.com').fill('slow-dns.example.com')
    await page.getByRole('button', { name: 'Continue to DNS setup' }).click()
    await page.getByRole('button', { name: "I've added these records" }).click()

    state.domains[0]!.status = 'verifying'
    state.domains[0]!.failure = { code: 'challenge_expired', detail: 'ttl exceeded' }

    await expect(
      page.getByText('The verification challenge expired. Please delete this claim and try again.'),
    ).toBeVisible({ timeout: 10000 })
  })

  test('resumes at Step 2 after a reload when the domain is still pending_setup', async ({
    page,
  }) => {
    const state = mockDomainsBackend(page)
    state.domains = [
      {
        id: 'dom_resume_1',
        hostname: 'resume.example.com',
        kind: 'connected',
        role: 'primary',
        status: 'pending_setup',
        detected_registrar: 'route53',
        challenge: {
          challenge_type: 'txt',
          token: 'tok_resume_1',
          txt_name: '_sanvi-challenge.resume.example.com',
          txt_value: 'sanvi-verification=tok_resume_1',
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
        failure: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    await page.goto('/domains/connect?id=dom_resume_1')

    await expect(
      page.getByRole('heading', { name: 'Step 2: Add DNS records at your registrar', level: 2 }),
    ).toBeVisible()
    await expect(page.getByText('_sanvi-challenge.resume.example.com')).toBeVisible()

    // A hard reload (not client-side navigation) must land in the same place —
    // this is the actual "resume on a fresh page load" guarantee the spec asks
    // for, not just the initial mount.
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Step 2: Add DNS records at your registrar', level: 2 }),
    ).toBeVisible()
  })
})
