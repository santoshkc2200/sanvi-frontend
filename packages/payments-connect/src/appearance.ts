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

import { DarkTokensObj, LightTokensObj, PrimitivesTokensObj } from '@sanvi/design-tokens'

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
 * The admin theme, not the tenant storefront theme.
 *
 * Resolves from @sanvi/design-tokens objects.
 */
export function getConnectAppearance(theme: 'light' | 'dark' = 'light'): ConnectAppearance {
  const colors = theme === 'dark' ? DarkTokensObj : LightTokensObj

  return {
    variables: {
      colorPrimary: colors.sanviColorPrimaryBase,
      colorBackground: colors.sanviColorBackgroundPrimary,
      colorText: colors.sanviColorTextPrimary,
      colorSecondaryText: colors.sanviColorTextSecondary,
      colorBorder: colors.sanviColorBorderDefault,
      colorDanger: colors.sanviColorStatusError,
      fontFamily: PrimitivesTokensObj['sanviFont-familySans'],
      borderRadius: PrimitivesTokensObj.sanviRadiusMd,
      spacingUnit: PrimitivesTokensObj.sanviSpacing1,
      buttonBorderRadius: PrimitivesTokensObj.sanviRadiusLg,
    },
    overlays: 'dialog',
  }
}
