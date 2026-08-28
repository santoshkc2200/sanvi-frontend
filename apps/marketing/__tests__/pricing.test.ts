import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PLANS, calculateAnnualSavingsPercentage, getPriceForPlan } from '../src/lib/plans'
import PricingPage from '../src/routes/pricing/+page.svelte'

describe('Marketing Pricing Plans Helpers', () => {
  it('getPriceForPlan resolves correct currency and interval', () => {
    const starter = DEFAULT_PLANS[0]!
    const monthlyUSD = getPriceForPlan(starter, 'USD', 'month')
    expect(monthlyUSD?.unit_amount_minor).toBe(2900)

    const annualJPY = getPriceForPlan(starter, 'JPY', 'year')
    expect(annualJPY?.unit_amount_minor).toBe(35000)
  })

  it('calculateAnnualSavingsPercentage calculates savings accurately', () => {
    const starter = DEFAULT_PLANS[0]!
    const savings = calculateAnnualSavingsPercentage(starter, 'USD')
    expect(savings).toBeGreaterThan(0)
  })
})

describe('Marketing Pricing Page Component', () => {
  it('renders all plan cards with initial monthly prices', () => {
    render(PricingPage, { props: { data: { plans: DEFAULT_PLANS } } })

    expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Starter' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Professional' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Enterprise' })).toBeInTheDocument()

    expect(screen.getByText('$29.00')).toBeInTheDocument()
    expect(screen.getByText('$79.00')).toBeInTheDocument()
    expect(screen.getByText('$199.00')).toBeInTheDocument()
  })

  it('switches between monthly and annual interval', async () => {
    render(PricingPage, { props: { data: { plans: DEFAULT_PLANS } } })

    const annualButton = screen.getByRole('button', { name: /Annual/ })
    await fireEvent.click(annualButton)

    expect(screen.getByText('$290.00')).toBeInTheDocument()
    expect(screen.getByText('$790.00')).toBeInTheDocument()
    expect(screen.getByText('$1,990.00')).toBeInTheDocument()
  })

  it('switches currency to JPY without decimal places', async () => {
    render(PricingPage, { props: { data: { plans: DEFAULT_PLANS } } })

    const select = screen.getByLabelText(/Currency/)
    await fireEvent.change(select, { target: { value: 'JPY' } })

    expect(screen.getByText(/¥3,500|JPY 3,500/)).toBeInTheDocument()
  })

  it('renders comparison table and FAQ items', () => {
    render(PricingPage, { props: { data: { plans: DEFAULT_PLANS } } })

    expect(screen.getByRole('heading', { name: 'Compare all features' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument()
    expect(screen.getByText('How does the 14-day free trial work?')).toBeInTheDocument()
  })

  it('hides Save badge when maxAnnualSavings is null / 0 (Defect 13)', () => {
    const plansNoSavings = DEFAULT_PLANS.map((p) => ({
      ...p,
      prices: p.prices.filter((pr) => pr.interval === 'month'),
    }))
    render(PricingPage, { props: { data: { plans: plansNoSavings } } })

    expect(screen.queryByText(/Save \d+%/)).not.toBeInTheDocument()
  })

  it('escapes <, >, and & in JSON-LD structured data (Defect 14)', () => {
    const maliciousPlans = [
      {
        ...DEFAULT_PLANS[0]!,
        name: 'Evil</script><script>alert(1)</script>&"Plan',
      },
    ]
    render(PricingPage, { props: { data: { plans: maliciousPlans } } })
    const script = document.head.querySelector('script[type="application/ld+json"]')
    expect(script?.textContent).toContain('\\u003c/script\\u003e')
    expect(script?.textContent).toContain('\\u0026')
    expect(script?.textContent).not.toContain('</script><script>')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(PricingPage, { props: { data: { plans: DEFAULT_PLANS } } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
