import '@testing-library/jest-dom/vitest'
import { toHaveNoViolations } from 'jest-axe'
import { expect } from 'vitest'

// Registers `expect(container).toHaveNoViolations()` for every jsdom test —
// component tests get an axe check for free instead of opting in per file.
// `jest-axe`'s `toHaveNoViolations` export is already the `{ toHaveNoViolations: fn }`
// matchers object `expect.extend` expects — wrapping it in another `{ }`
// double-nests it and breaks the matcher (`expectAssertion.call is not a function`).
expect.extend(toHaveNoViolations)

// jsdom implements <dialog>'s `open` attribute but not the imperative
// `showModal`/`close` methods (still "not implemented" upstream) — @sanvi/ui's
// Dialog/Drawer call both, so every component test that renders one needs
// this polyfill. Close enough for tests: flips `open` and fires the `close`
// event Dialog/Drawer listen for; no focus trap or top-layer behavior, which
// jsdom has no rendering to make meaningful anyway.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
}

// jsdom ships no blob-URL store, so `URL.createObjectURL` / `revokeObjectURL`
// are simply absent — any component that previews a picked file and revokes
// the URL on teardown throws "URL.revokeObjectURL is not a function" during
// cleanup. Minted URLs are unique and revoking is a no-op, which is all a
// test can observe without a rendering engine behind the blob.
if (typeof URL !== 'undefined') {
  let blobUrlCounter = 0
  URL.createObjectURL ??= () => {
    blobUrlCounter += 1
    return `blob:jsdom/${blobUrlCounter}`
  }
  URL.revokeObjectURL ??= () => {}
}
