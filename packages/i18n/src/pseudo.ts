/**
 * Pseudo-localisation — rendering the real catalog through a transform that
 * accents every letter and expands length ~30–40 %, wrapped in `[…]` so
 * truncation and clipping are visible. Layout breakage from text expansion
 * (the classic German/Japanese launch bug) is caught in CI and storybook
 * *before translators exist*, per the phase-06 plan.
 *
 * Enabled with `initI18n({ pseudo: true })` — apps wire that to
 * `PUBLIC_I18N_PSEUDO=1`. Only `t()` output is pseudo-localised: formatted
 * dates/numbers stay real, or a "pseudo" page would tell you nothing about
 * how real locale-shaped data fits the layout.
 */

let pseudoMode = false

export function setPseudoMode(enabled: boolean): void {
  pseudoMode = enabled
}

export function isPseudoMode(): boolean {
  return pseudoMode
}

/** Latin letters → accented lookalikes (deterministic, reversible by eye). */
const ACCENTS: Record<string, string> = {
  a: 'á',
  b: 'ḃ',
  c: 'ć',
  d: 'ď',
  e: 'é',
  f: 'ḟ',
  g: 'ğ',
  h: 'ħ',
  i: 'í',
  j: 'ĵ',
  k: 'ķ',
  l: 'ĺ',
  m: 'ḿ',
  n: 'ń',
  o: 'ó',
  p: 'ṕ',
  q: 'quee',
  r: 'ŕ',
  s: 'ś',
  t: 'ť',
  u: 'ú',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ź',
}

export function pseudoize(text: string): string {
  let out = ''
  for (const ch of text) {
    const lower = ch.toLowerCase()
    const accented = ACCENTS[lower]
    if (accented === undefined) {
      out += ch
      continue
    }
    // Match the original's case by capitalizing the first accented char.
    const mapped = ch !== lower ? accented.charAt(0).toUpperCase() + accented.slice(1) : accented
    out += mapped
    // Doubled vowels drive the ~30 % expansion the layout tests rely on.
    if ('aeiou'.includes(lower)) out += mapped
  }
  return `[${out}]`
}
