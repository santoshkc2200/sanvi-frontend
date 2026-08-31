import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CopyButton from '../src/CopyButton.svelte'

describe('CopyButton', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    writeTextMock.mockClear()
  })

  it('renders default label', () => {
    render(CopyButton, { props: { value: 'sample-token' } })
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('renders custom labels', () => {
    render(CopyButton, {
      props: {
        value: 'sample-token',
        label: 'Copy Record',
        copiedLabel: 'Record Copied!',
      },
    })
    expect(screen.getByRole('button', { name: 'Copy Record' })).toBeInTheDocument()
  })

  it('copies value to clipboard, shows copied state, and calls onCopy', async () => {
    const onCopy = vi.fn()
    render(CopyButton, {
      props: {
        value: 'txt-token-12345',
        label: 'Copy',
        copiedLabel: 'Copied!',
        onCopy,
      },
    })

    const button = screen.getByRole('button', { name: 'Copy' })
    await fireEvent.click(button)

    expect(writeTextMock).toHaveBeenCalledWith('txt-token-12345')
    expect(onCopy).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(CopyButton, { props: { value: 'sample-token' } })
    expect(await axe(container)).toHaveNoViolations()
  })
})
