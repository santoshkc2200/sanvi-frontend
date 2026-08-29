import { describe, expect, it, vi } from 'vitest'
import { enterUnlessComposing, isComposingKeyboardEvent } from '../src/ime'

function keyEvent(init: { key: string; isComposing?: boolean; keyCode?: number }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: init.key, bubbles: true })
  // `keyCode` and `isComposing` are read-only/legacy — patch them the way
  // engines and jsdom allow tests to.
  Object.defineProperty(event, 'isComposing', { value: init.isComposing ?? false })
  Object.defineProperty(event, 'keyCode', {
    value: init.keyCode ?? (init.key === 'Enter' ? 13 : 0),
  })
  return event
}

describe('IME-safe input primitives', () => {
  it('detects composition via isComposing and the legacy keyCode 229', () => {
    expect(isComposingKeyboardEvent(keyEvent({ key: 'Enter', isComposing: true }))).toBe(true)
    expect(isComposingKeyboardEvent(keyEvent({ key: 'Enter', keyCode: 229 }))).toBe(true)
    expect(isComposingKeyboardEvent(keyEvent({ key: 'Enter' }))).toBe(false)
  })

  it('enterUnlessComposing fires on a plain Enter', () => {
    const handler = vi.fn()
    const onkeydown = enterUnlessComposing(handler)
    onkeydown(keyEvent({ key: 'Enter' }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does NOT fire while a composition is in flight — Enter commits the IME text, not the form', () => {
    const handler = vi.fn()
    const onkeydown = enterUnlessComposing(handler)
    onkeydown(keyEvent({ key: 'Enter', isComposing: true }))
    onkeydown(keyEvent({ key: 'Enter', keyCode: 229 }))
    expect(handler).not.toHaveBeenCalled()
    // And a later Enter, composition finished, does.
    onkeydown(keyEvent({ key: 'Enter' }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('ignores other keys and Shift+Enter', () => {
    const handler = vi.fn()
    const onkeydown = enterUnlessComposing(handler)
    onkeydown(keyEvent({ key: 'a' }))
    onkeydown(keyEvent({ key: 'Enter', isComposing: false }))
    const shiftEnter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
    Object.defineProperty(shiftEnter, 'isComposing', { value: false })
    onkeydown(shiftEnter)
    expect(handler).toHaveBeenCalledOnce()
  })
})
