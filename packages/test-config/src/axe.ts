import { configureAxe } from 'jest-axe'

/**
 * Pre-configured `axe()` for isolated component tests. Disables the
 * `region` rule — it flags content outside a landmark, which is expected
 * when a test renders one component rather than a full page — and the
 * `page-has-heading-one`/`landmark-one-main` rules for the same reason.
 * Full-page a11y coverage lives in the Playwright e2e suite instead.
 */
export const axe = configureAxe({
  rules: {
    region: { enabled: false },
    'page-has-heading-one': { enabled: false },
    'landmark-one-main': { enabled: false },
  },
})
