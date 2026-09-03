import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import AdPlatformCard from '../src/advertising/AdPlatformCard.svelte'
import {
  fixturePlatformByKey,
  platformViewFixture,
  type AdPlatformFixture,
} from './fixtures/advertising/index'

const GOOGLE_FIXTURE = fixturePlatformByKey('google_ads')!
const META_FIXTURE = fixturePlatformByKey('meta')!

function platformOf(fixture: AdPlatformFixture, overrides = {}) {
  return platformViewFixture(fixture, overrides)
}

const LABELS = {
  connectCta: 'Connect',
  upgradeTitle: 'Upgrade required',
  upgradeDescription: 'Advertising on this platform needs a plan that includes it.',
  capabilitiesLabel: 'What connecting allows',
  objectivesLabel: 'Objectives',
  placementsLabel: 'Placements',
}

describe('AdPlatformCard', () => {
  it('renders display name, connection badge, and capability summary from matrix data', () => {
    render(AdPlatformCard, {
      props: {
        platform: platformOf(GOOGLE_FIXTURE, {
          connection_state: 'connected',
        }),
        labels: LABELS,
        connectionLabels: { connected: 'Connected', not_connected: 'Not connected' },
        optionLabels: { sales: 'Sales', feed: 'Feed', stories: 'Stories' },
      },
    })

    expect(screen.getByRole('heading', { name: GOOGLE_FIXTURE.display_name })).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('What connecting allows')).toBeInTheDocument()
    // Matrix values render through the provided labels, unknown ones through the fallback.
    expect(screen.getByText('App Promotion, Awareness, Leads, Sales, Traffic')).toBeInTheDocument()
    expect(screen.getByText('Feed, Stories')).toBeInTheDocument()
  })

  it('humanizes matrix values it has no label for, so new backend data still renders', () => {
    render(AdPlatformCard, { props: { platform: platformOf(META_FIXTURE), labels: LABELS } })
    expect(
      screen.getByText('App Promotion, Awareness, Engagement, Leads, Sales, Traffic'),
    ).toBeInTheDocument()
    expect(screen.getByText('Feed, Stories, Reels')).toBeInTheDocument()
  })

  it('shows the upgrade path on a non-entitled platform instead of omitting it', () => {
    render(AdPlatformCard, {
      props: {
        platform: platformOf(META_FIXTURE, { upgrade_required: true }),
        entitled: false,
        labels: LABELS,
      },
    })
    expect(screen.getByText('Upgrade required')).toBeInTheDocument()
    expect(
      screen.getByText('Advertising on this platform needs a plan that includes it.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
  })

  it('renders the connect CTA inert with its reason while the connection flow is pending', () => {
    render(AdPlatformCard, {
      props: {
        platform: platformOf(GOOGLE_FIXTURE),
        labels: LABELS,
        connectDisabled: true,
        onConnect: vi.fn(),
      },
    })
    const connect = screen.getByRole('button', { name: 'Connect' })
    expect(connect).toHaveAttribute('aria-disabled', 'true')
    // Inert but focusable — the reason is reachable by keyboard and screen reader.
    expect(screen.getByText('Connecting is not available yet.')).toBeInTheDocument()
  })

  it('emits onConnect with the platform when the CTA is live', async () => {
    const onConnect = vi.fn()
    render(AdPlatformCard, {
      props: {
        platform: platformOf(GOOGLE_FIXTURE),
        labels: LABELS,
        onConnect,
      },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(onConnect).toHaveBeenCalledWith(platformOf(GOOGLE_FIXTURE))
  })

  it('lists the OAuth scopes that will be requested when provided', () => {
    render(AdPlatformCard, {
      props: {
        platform: platformOf(GOOGLE_FIXTURE),
        labels: LABELS,
        scopes: ['https://www.googleapis.com/auth/adwords'],
      },
    })
    expect(screen.getByText('Permissions requested')).toBeInTheDocument()
    expect(screen.getByText('https://www.googleapis.com/auth/adwords')).toBeInTheDocument()
  })

  it('marks an unavailable platform instead of offering connection', () => {
    render(AdPlatformCard, {
      props: {
        platform: platformOf(GOOGLE_FIXTURE, { available: false }),
        labels: LABELS,
      },
    })
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
  })

  it('passes axe on the entitled, upgrade, and connected paths', async () => {
    const entitledView = render(AdPlatformCard, {
      props: {
        platform: platformOf(GOOGLE_FIXTURE),
        labels: LABELS,
        connectionLabels: { connected: 'Connected', not_connected: 'Not connected' },
        connectionTones: { connected: 'success' },
        connectDisabled: true,
      },
    })
    expect(await axe(entitledView.container)).toHaveNoViolations()
    entitledView.unmount()

    const upgradeView = render(AdPlatformCard, {
      props: {
        platform: platformOf(META_FIXTURE, { upgrade_required: true }),
        entitled: false,
        labels: LABELS,
      },
    })
    expect(await axe(upgradeView.container)).toHaveNoViolations()
    upgradeView.unmount()
  })
})
