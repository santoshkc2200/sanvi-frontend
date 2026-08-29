import type { TokenValue } from '@sanvi/api-client'

export interface ContrastPairConfig {
  foreground: string
  background: string
  minimum: number
}

export const CONTRAST_PAIRS: ContrastPairConfig[] = [
  { foreground: 'color.text.primary', background: 'color.background.primary', minimum: 4.5 },
  { foreground: 'color.text.secondary', background: 'color.background.primary', minimum: 4.5 },
  { foreground: 'color.text.inverse', background: 'color.background.inverse', minimum: 4.5 },
  { foreground: 'color.brand.contrast', background: 'color.brand.primary', minimum: 4.5 },
  { foreground: 'color.brand.contrast', background: 'color.brand.hover', minimum: 4.5 },
  { foreground: 'color.focus.ring', background: 'color.background.primary', minimum: 3.0 },
]

export interface ContrastViolation {
  foreground: string
  background: string
  foregroundValue: string
  backgroundValue: string
  ratio: number
  minimum: number
}

/**
 * Parse `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` into `[r, g, b, a]` (0..=255).
 * Mirrors `crates/contexts/theming/src/domain/tokens.rs:parse_hex_color`.
 */
export function parseHexColor(raw: string): [number, number, number, number] | null {
  if (!raw.startsWith('#')) return null
  const hex = raw.slice(1)
  const digits: number[] = []

  for (let i = 0; i < hex.length; i++) {
    const d = Number.parseInt(hex[i] ?? '', 16)
    if (Number.isNaN(d)) return null
    digits.push(d)
  }

  switch (digits.length) {
    case 3:
      return [digits[0]! * 17, digits[1]! * 17, digits[2]! * 17, 255]
    case 4:
      return [digits[0]! * 17, digits[1]! * 17, digits[2]! * 17, digits[3]! * 17]
    case 6:
      return [
        digits[0]! * 16 + digits[1]!,
        digits[2]! * 16 + digits[3]!,
        digits[4]! * 16 + digits[5]!,
        255,
      ]
    case 8:
      return [
        digits[0]! * 16 + digits[1]!,
        digits[2]! * 16 + digits[3]!,
        digits[4]! * 16 + digits[5]!,
        digits[6]! * 16 + digits[7]!,
      ]
    default:
      return null
  }
}

/**
 * WCAG relative luminance (sRGB, with alpha flattened against white).
 * Mirrors `crates/contexts/theming/src/domain/contrast.rs:relative_luminance`.
 */
export function relativeLuminance(rgb: [number, number, number, number]): number {
  const alpha = rgb[3] / 255.0
  const channel = (byte: number) => {
    // Flatten against white before converting sRGB to linear light
    const c = (byte / 255.0) * alpha + (1.0 - alpha)
    if (c <= 0.04045) {
      return c / 12.92
    }
    return ((c + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

/**
 * Contrast ratio between two colors (1..=21).
 * Mirrors `crates/contexts/theming/src/domain/contrast.rs:contrast_ratio`.
 */
export function contrastRatio(
  foreground: [number, number, number, number],
  background: [number, number, number, number],
): number {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function extractColorString(val: string | TokenValue | undefined): string | null {
  if (!val) return null
  if (typeof val === 'string') return val
  if (typeof val.$value === 'string') return val.$value
  return null
}

/**
 * Check token set against required semantic contrast pairs.
 * Returns all violations where ratio < minimum.
 */
export function checkContrast(tokens: Record<string, string | TokenValue>): ContrastViolation[] {
  const violations: ContrastViolation[] = []

  for (const { foreground, background, minimum } of CONTRAST_PAIRS) {
    const fgRaw = extractColorString(tokens[foreground])
    const bgRaw = extractColorString(tokens[background])
    if (!fgRaw || !bgRaw) continue

    const fgColor = parseHexColor(fgRaw)
    const bgColor = parseHexColor(bgRaw)
    if (!fgColor || !bgColor) continue

    const ratio = contrastRatio(fgColor, bgColor)
    if (ratio < minimum) {
      violations.push({
        foreground,
        background,
        foregroundValue: fgRaw,
        backgroundValue: bgRaw,
        ratio: Math.round(ratio * 100) / 100,
        minimum,
      })
    }
  }

  return violations
}
