import { describe, expect, it } from 'vitest'
import { BUILD_PATH, CSS_TRANSFORMS, JS_TRANSFORMS, makePlatforms } from '../config/lib.mjs'

// ─── makePlatforms ──────────────────────────────────────────────────────────────

describe('makePlatforms', () => {
  const basicResult = makePlatforms({
    name: 'light',
    cssSelector: ':root, [data-theme="light"]',
    androidColorPath: 'res/values/',
    androidKotlinPath: 'colors/',
    androidKotlinObjectName: 'LightColors',
  })

  it('returns a css platform with correct options', () => {
    expect(basicResult.css).toBeDefined()
    expect(basicResult.css.transforms).toEqual(CSS_TRANSFORMS)
    expect(basicResult.css.buildPath).toBe(BUILD_PATH.css)
    expect(basicResult.css.prefix).toBe('sanvi')
    expect(basicResult.css.files).toHaveLength(1)

    const cssFile = basicResult.css.files[0]
    expect(cssFile.destination).toBe('light.css')
    expect(cssFile.format).toBe('custom/css-variables')
    expect(cssFile.options.selector).toBe(':root, [data-theme="light"]')
    expect(cssFile.options.outputReferences).toBe(false)
  })

  it('returns a ts platform with correct options', () => {
    expect(basicResult.ts).toBeDefined()
    expect(basicResult.ts.transforms).toEqual(JS_TRANSFORMS)
    expect(basicResult.ts.buildPath).toBe(BUILD_PATH.ts)
    expect(basicResult.ts.files).toHaveLength(1)

    const tsFile = basicResult.ts.files[0]
    expect(tsFile.destination).toBe('light.ts')
    expect(tsFile.format).toBe('custom/typescript-esm')
  })

  it('returns a json platform with correct options', () => {
    expect(basicResult.json).toBeDefined()
    expect(basicResult.json.transforms).toEqual(JS_TRANSFORMS)
    expect(basicResult.json.buildPath).toBe(BUILD_PATH.json)
    expect(basicResult.json.files).toHaveLength(1)

    const jsonFile = basicResult.json.files[0]
    expect(jsonFile.destination).toBe('light.json')
    expect(jsonFile.format).toBe('custom/json-flat')
  })

  it('returns an android platform with colors.xml and Compose .kt files', () => {
    expect(basicResult.android).toBeDefined()
    expect(basicResult.android.buildPath).toBe(BUILD_PATH.android)
    expect(basicResult.android.files).toHaveLength(2)

    const colorsFile = basicResult.android.files[0]
    expect(colorsFile.destination).toBe('res/values/colors.xml')
    expect(colorsFile.format).toBe('custom/android-colors-xml')
    expect(colorsFile.filter).toBeDefined()

    const composeFile = basicResult.android.files[1]
    expect(composeFile.destination).toBe('colors/LightColors.kt')
    expect(composeFile.format).toBe('android/compose-colors')
    expect(composeFile.options.packageName).toBe('com.sanvi.designtokens.colors')
    expect(composeFile.options.objectName).toBe('LightColors')
  })

  it('omits android colors.xml when androidColorPath is null', () => {
    const result = makePlatforms({
      name: 'primitives',
      cssSelector: ':root',
      androidColorPath: null,
    })

    expect(result.android.files).toHaveLength(0)
  })

  it('omits android Compose file when androidKotlinPath is null', () => {
    const result = makePlatforms({
      name: 'test',
      cssSelector: ':root',
      androidColorPath: 'res/values/',
      androidKotlinPath: null,
      androidKotlinObjectName: 'TestColors',
    })

    expect(result.android.files).toHaveLength(1)
    expect(result.android.files[0].format).toBe('custom/android-colors-xml')
  })

  it('uses default androidKotlinPackageName when not provided', () => {
    const result = makePlatforms({
      name: 'test',
      cssSelector: ':root',
      androidColorPath: 'res/values/',
      androidKotlinPath: 'colors/',
      androidKotlinObjectName: 'TestColors',
    })

    const composeFile = result.android.files.find((f) => f.format === 'android/compose-colors')
    expect(composeFile.options.packageName).toBe('com.sanvi.designtokens.colors')
  })

  it('applies custom filter to all platform files', () => {
    const customFilter = (token) => token.name === 'allowed'
    const result = makePlatforms({
      name: 'test',
      cssSelector: ':root',
      androidColorPath: 'res/values/',
      androidKotlinPath: 'colors/',
      androidKotlinObjectName: 'TestColors',
      filter: customFilter,
    })

    expect(result.css.files[0].filter).toBe(customFilter)
    expect(result.ts.files[0].filter).toBe(customFilter)
    expect(result.json.files[0].filter).toBe(customFilter)
  })

  it('uses default filter (passthrough) when none provided', () => {
    const result = makePlatforms({
      name: 'test',
      cssSelector: ':root',
      androidColorPath: null,
    })

    // default filter is () => true, so any token passes
    expect(result.css.files[0].filter({})).toBe(true)
    expect(result.css.files[0].filter(null)).toBe(true)
  })

  it('name parameter sets output file destinations', () => {
    const result = makePlatforms({
      name: 'dark',
      cssSelector: '[data-theme="dark"]',
      androidColorPath: 'res/values-night/',
      androidKotlinPath: 'colors/',
      androidKotlinObjectName: 'DarkColors',
    })

    expect(result.css.files[0].destination).toBe('dark.css')
    expect(result.ts.files[0].destination).toBe('dark.ts')
    expect(result.json.files[0].destination).toBe('dark.json')
  })
})
