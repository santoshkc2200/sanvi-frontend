/**
 * Typed handles onto `@sanvi/design-tokens` primitives. Layout primitives and
 * components accept these scale keys instead of a raw CSS length/color, so
 * "no hardcoded spacing" is enforced by the prop type, not only by lint.
 */

export const SPACING_SCALE = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '8',
  '10',
  '12',
  '16',
  '20',
  '24',
] as const
export type SpacingScale = (typeof SPACING_SCALE)[number]

export function spacingVar(key: SpacingScale): string {
  return `var(--sanvi-spacing-${key})`
}

export const RADIUS_SCALE = ['none', 'sm', 'md', 'lg', 'xl', 'full'] as const
export type RadiusScale = (typeof RADIUS_SCALE)[number]

export function radiusVar(key: RadiusScale): string {
  return `var(--sanvi-radius-${key})`
}
