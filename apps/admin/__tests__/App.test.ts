import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../src/App.svelte'
import { navigate } from '../src/lib/router.svelte'

afterEach(() => {
  navigate('/')
})

describe('App shell', () => {
  it('renders the nav and the dashboard route by default', async () => {
    render(App)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(await screen.findByText('No tenant data yet')).toBeInTheDocument()
  })

  it('navigates to Settings when its nav link is clicked', async () => {
    render(App)
    await screen.findByText('No tenant data yet')

    await fireEvent.click(screen.getByRole('link', { name: 'Settings' }))

    expect(await screen.findByText('Settings')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('has no accessibility violations on the default route', async () => {
    const { container } = render(App)
    await screen.findByText('No tenant data yet')
    expect(await axe(container)).toHaveNoViolations()
  })
})
