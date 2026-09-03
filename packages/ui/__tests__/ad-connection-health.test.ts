import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import AdConnectionHealth from '../src/advertising/AdConnectionHealth.svelte'
import type { AdConnectionHealthData } from '../src/advertising/health'

const HEALTHY: AdConnectionHealthData = {
  can_sync: true,
  can_upload_conversions: true,
  scopes_missing: [],
  reconnect_required: false,
  token_expires_at: null,
  last_error: null,
  last_synced_at: '2026-09-03T11:00:00Z',
}

describe('AdConnectionHealth', () => {
  it('renders the badge text and message for the current state', () => {
    render(AdConnectionHealth, {
      props: {
        status: 'active',
        health: HEALTHY,
        labels: { badge: 'Healthy', message: 'Connected and working. Last synced 12:00.' },
      },
    })
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('Connected and working. Last synced 12:00.')).toBeInTheDocument()
  })

  it('renders the single fixing action when the state has one', async () => {
    const onAction = vi.fn()
    render(AdConnectionHealth, {
      props: {
        status: 'active',
        health: { ...HEALTHY, can_sync: false, last_error: 'token rejected' },
        labels: {
          badge: 'Sync failing',
          message: 'The last sync failed.',
          actionLabel: 'Reconnect',
        },
        onAction,
      },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('renders no action when the caller provides none (healthy/disconnected)', () => {
    render(AdConnectionHealth, {
      props: {
        status: 'active',
        health: HEALTHY,
        labels: { badge: 'Healthy', message: 'All good.' },
      },
    })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('marks its derived state in data so colour is never the only encoding', () => {
    const { container } = render(AdConnectionHealth, {
      props: {
        status: 'active',
        health: { ...HEALTHY, scopes_missing: ['ads.manage'] },
        labels: {
          badge: 'Re-consent required',
          message: 'The platform no longer grants: Manage campaigns.',
          actionLabel: 'Reconnect',
        },
      },
    })
    expect(container.firstElementChild).toHaveAttribute('data-health-state', 'reconsent_required')
  })

  it('passes axe with an action present', async () => {
    const { container } = render(AdConnectionHealth, {
      props: {
        status: 'active',
        health: { ...HEALTHY, reconnect_required: true },
        labels: {
          badge: 'Reconnect required',
          message: 'The platform no longer accepts this connection.',
          actionLabel: 'Reconnect',
        },
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
