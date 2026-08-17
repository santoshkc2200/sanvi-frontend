import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import TenantSwitcher from '../src/TenantSwitcher.svelte'

const OPTIONS = [
  { tenantId: 'acme-1', label: 'Acme Corporation' },
  { tenantId: 'globex-1', label: 'Globex Industries' },
]

describe('TenantSwitcher', () => {
  it('lists every membership as an option, with the active tenant selected', () => {
    render(TenantSwitcher, {
      props: {
        options: OPTIONS,
        activeTenantId: 'globex-1',
        label: 'Switch tenant',
        onSwitch: vi.fn(),
      },
    })

    const select = screen.getByRole('combobox', { name: 'Switch tenant' }) as HTMLSelectElement
    expect(select.value).toBe('globex-1')
    expect(screen.getByRole('option', { name: 'Acme Corporation' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Globex Industries' })).toBeInTheDocument()
  })

  it('calls onSwitch with the newly selected tenant id', async () => {
    const onSwitch = vi.fn()
    render(TenantSwitcher, {
      props: { options: OPTIONS, activeTenantId: 'acme-1', label: 'Switch tenant', onSwitch },
    })

    const select = screen.getByRole('combobox', { name: 'Switch tenant' }) as HTMLSelectElement
    select.value = 'globex-1'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    expect(onSwitch).toHaveBeenCalledWith('globex-1')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(TenantSwitcher, {
      props: {
        options: OPTIONS,
        activeTenantId: 'acme-1',
        label: 'Switch tenant',
        onSwitch: vi.fn(),
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
