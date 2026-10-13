/**
 * The publish-time contrast gate for the storefront mock backend
 * (TASK-027 step 6) — the lab stand-in for the backend's
 * `crates/contexts/theming` validation, extracted here so
 * `theme-contrast.test.ts` can pin it to `@sanvi/design-tokens`' engine:
 * the pairs, minimums, and math must agree exactly, because a theme the
 * admin's live checker passes is one publish must accept.
 */

export const THEME_CONTRAST_DEFAULTS = {
  'color.brand.primary': '#2563eb',
  'color.brand.hover': '#1d4ed8',
  'color.brand.contrast': '#ffffff',
  'color.text.primary': '#1a1d23',
  'color.text.secondary': '#4a505c',
  'color.text.inverse': '#ffffff',
  'color.background.primary': '#ffffff',
  'color.background.inverse': '#1a1d23',
  'color.focus.ring': '#1d4ed8',
}

export const THEME_CONTRAST_PAIRS = [
  { fg: 'color.text.primary', bg: 'color.background.primary', min: 4.5 },
  { fg: 'color.text.secondary', bg: 'color.background.primary', min: 4.5 },
  { fg: 'color.text.inverse', bg: 'color.background.inverse', min: 4.5 },
  { fg: 'color.brand.contrast', bg: 'color.brand.primary', min: 4.5 },
  { fg: 'color.brand.contrast', bg: 'color.brand.hover', min: 4.5 },
  { fg: 'color.focus.ring', bg: 'color.background.primary', min: 3.0 },
]

function themeLuminance(hex) {
  const digits = hex
    .replace(/^#/, '')
    .split('')
    .map((d) => Number.parseInt(d, 16))
  const rgb =
    digits.length === 3 || digits.length === 4
      ? digits.map((d) => d * 17)
      : [
          digits[0] * 16 + digits[1],
          digits[2] * 16 + digits[3],
          digits[4] * 16 + digits[5],
          digits[6] !== undefined ? digits[6] * 16 + digits[7] : 255,
        ]
  const alpha = (rgb[3] ?? 255) / 255
  const channel = (byte) => {
    const c = (byte / 255) * alpha + (1 - alpha)
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

/**
 * Violations for a merged draft token set (`overrides` layered over the
 * defaults), each shaped `{ field, message }` — the problem+json `fields`
 * entries the publish rejection carries.
 */
export function themeContrastViolations(overrides) {
  const tokens = { ...THEME_CONTRAST_DEFAULTS }
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (typeof value?.$value === 'string') tokens[key] = value.$value
  }
  const violations = []
  for (const { fg, bg, min } of THEME_CONTRAST_PAIRS) {
    const fgHex = tokens[fg]
    const bgHex = tokens[bg]
    if (!fgHex || !bgHex) continue
    const l1 = themeLuminance(fgHex)
    const l2 = themeLuminance(bgHex)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    if (ratio < min) {
      violations.push({
        field: fg,
        message:
          `${fg} (${fgHex}) on ${bg} (${bgHex}) is ${Math.round(ratio * 100) / 100}:1, ` +
          `below the ${min}:1 WCAG AA minimum.`,
      })
    }
  }
  return violations
}
