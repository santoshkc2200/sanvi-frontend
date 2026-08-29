import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import LocaleSwitcher from '../src/LocaleSwitcher.svelte'

const OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]

describe('LocaleSwitcher', () => {
  it('lists every configured locale, with the current one selected', () => {
    render(LocaleSwitcher, {
      props: { options: OPTIONS, current: 'ja', label: 'Switch language', onSwitch: vi.fn() },
    })

    const select = screen.getByRole('combobox', { name: 'Switch language' }) as HTMLSelectElement
    expect(select.value).toBe('ja')
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '日本語' })).toBeInTheDocument()
  })

  it('calls onSwitch with the newly selected locale code', async () => {
    const onSwitch = vi.fn()
    render(LocaleSwitcher, {
      props: { options: OPTIONS, current: 'en', label: 'Switch language', onSwitch },
    })

    const select = screen.getByRole('combobox', { name: 'Switch language' }) as HTMLSelectElement
    select.value = 'ja'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    expect(onSwitch).toHaveBeenCalledWith('ja')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(LocaleSwitcher, {
      props: { options: OPTIONS, current: 'en', label: 'Switch language', onSwitch: vi.fn() },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
