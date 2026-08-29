/**
 * IME-safe input primitives (phase 06). A Japanese/Chinese/Korean IME
 * composes text in a temporary buffer: while `isComposing` is true, Enter
 * *commits the composition*, it does not submit the form, and `input`
 * events carry intermediate romaji/kana — not what the user meant to say.
 * Any component that treats Enter as "confirm" or input as "search now"
 * must gate on these helpers or it breaks exactly the keyboards phase 06
 * ships for.
 */

/**
 * True when a keyboard event belongs to an in-flight composition. Checks
 * both the standard flag and the legacy `keyCode === 229` signal, which
 * some engines still fire for every keydown during composition.
 */
export function isComposingKeyboardEvent(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229
}

/**
 * An `onkeydown` handler that fires `handler` on Enter — except while an
 * IME composition is in flight (and for Shift+Enter, the convention for a
 * soft newline in single-line-ish inputs). The classic bug this prevents:
 * pressing Enter to commit 変換 (conversion) submitting the search form
 * with half-finished text.
 */
export function enterUnlessComposing(handler: () => void): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (isComposingKeyboardEvent(event)) return
    handler()
  }
}
