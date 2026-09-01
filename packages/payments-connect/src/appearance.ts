/**
 * Appearance mapping for Stripe Connect embedded components.
 *
 * Only options that the Connect component API exposes (`variables` and
 * `overlays`) are set, and values are sourced from the admin theme's
 * design tokens — never CSS overrides that would break on Stripe releases.
 *
 * Token hex values are taken from `packages/design-tokens/tokens/primitives.json`
 * via the semantic resolution (`primitive.color.*` → `color.*`). The comments
 * name the token so a future token change is traceable here without
 * hardcoding a CSS var that the iframe cannot read.
 */

export interface ConnectAppearance {
  variables: {
    colorPrimary: string
    colorBackground: string
    colorText: string
    colorSecondaryText: string
    colorBorder: string
    colorDanger: string
    fontFamily: string
    borderRadius: string
    spacingUnit: string
    buttonBorderRadius: string
  }
  overlays: 'dialog' | 'drawer'
}

/**
 * The admin theme, not the tenant storefront theme (implementation-plan
 * §Risks: settings surface uses our own theme).
 *
 * Values resolve from:
 * - `color.primary.base` → primitive.blue.600 #2563eb
 * - `color.background.primary` → primitive.gray.0 #ffffff
 * - `color.text.primary` → primitive.gray.900 #0f172a
 * - `color.text.secondary` → primitive.gray.600 #475569
 * - `color.border.default` → primitive.gray.200 #e2e8f0
 * - `color.status.error` → primitive.red.600 #dc2626
 * - `primitive.font-family.sans`
 * - `primitive.radius.md` 0.375rem
 * - `primitive.radius.lg` 0.5rem (button)
 * - `primitive.spacing.1` 0.25rem
 */
export function getConnectAppearance(): ConnectAppearance {
  return {
    variables: {
      colorPrimary: '#2563eb',
      colorBackground: '#ffffff',
      colorText: '#0f172a',
      colorSecondaryText: '#475569',
      colorBorder: '#e2e8f0',
      colorDanger: '#dc2626',
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      borderRadius: '0.375rem',
      spacingUnit: '0.25rem',
      buttonBorderRadius: '0.5rem',
    },
    overlays: 'dialog',
  }
}
