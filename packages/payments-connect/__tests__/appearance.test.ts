import { DarkTokensObj, LightTokensObj, PrimitivesTokensObj } from '@sanvi/design-tokens'
import { describe, expect, it } from 'vitest'
import { getConnectAppearance } from '../src/appearance'

describe('getConnectAppearance', () => {
  it('returns light theme tokens by default', () => {
    const appearance = getConnectAppearance()
    expect(appearance.variables.colorPrimary).toBe(LightTokensObj.sanviColorPrimaryBase)
    expect(appearance.variables.colorBackground).toBe(LightTokensObj.sanviColorBackgroundPrimary)
    expect(appearance.variables.colorText).toBe(LightTokensObj.sanviColorTextPrimary)
    expect(appearance.variables.colorSecondaryText).toBe(LightTokensObj.sanviColorTextSecondary)
    expect(appearance.variables.colorBorder).toBe(LightTokensObj.sanviColorBorderDefault)
    expect(appearance.variables.colorDanger).toBe(LightTokensObj.sanviColorStatusError)
    expect(appearance.variables.fontFamily).toBe(PrimitivesTokensObj['sanviFont-familySans'])
    expect(appearance.variables.borderRadius).toBe(PrimitivesTokensObj.sanviRadiusMd)
    expect(appearance.variables.spacingUnit).toBe(PrimitivesTokensObj.sanviSpacing1)
    expect(appearance.variables.buttonBorderRadius).toBe(PrimitivesTokensObj.sanviRadiusLg)
    expect(appearance.overlays).toBe('dialog')
  })

  it('returns dark theme tokens when dark theme is requested', () => {
    const appearance = getConnectAppearance('dark')
    expect(appearance.variables.colorPrimary).toBe(DarkTokensObj.sanviColorPrimaryBase)
    expect(appearance.variables.colorBackground).toBe(DarkTokensObj.sanviColorBackgroundPrimary)
    expect(appearance.variables.colorText).toBe(DarkTokensObj.sanviColorTextPrimary)
    expect(appearance.variables.colorSecondaryText).toBe(DarkTokensObj.sanviColorTextSecondary)
    expect(appearance.variables.colorBorder).toBe(DarkTokensObj.sanviColorBorderDefault)
    expect(appearance.variables.colorDanger).toBe(DarkTokensObj.sanviColorStatusError)
  })
})
