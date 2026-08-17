import { describe, expect, it } from 'vitest'
import {
  BUILD_PATH,
  createConfigs,
  createMobileAssetsConfig,
  createPrimitiveConfig,
  createSemanticDarkConfig,
  createSemanticLightConfig,
  isPrimitive,
  isSemanticOrComponent,
  SOURCE,
} from '../config/lib.mjs'

// ─── createPrimitiveConfig ──────────────────────────────────────────────────────

describe('createPrimitiveConfig', () => {
  const config = createPrimitiveConfig()

  it('has correct source files', () => {
    expect(config.source).toEqual([SOURCE.primitives])
  })

  it('uses tokens-studio preprocessor', () => {
    expect(config.preprocessors).toEqual(['tokens-studio'])
  })

  it('has default log verbosity', () => {
    expect(config.log.verbosity).toBe('default')
  })

  it('generates "primitives" CSS with :root selector', () => {
    const cssFile = config.platforms.css.files[0]
    expect(cssFile.destination).toBe('primitives.css')
    expect(cssFile.options.selector).toBe(':root')
  })

  it('uses isPrimitive as the token filter', () => {
    const cssFile = config.platforms.css.files[0]
    expect(cssFile.filter).toBe(isPrimitive)
  })

  it('omits Android colors.xml (androidColorPath is null)', () => {
    expect(config.platforms.android.files).toHaveLength(0)
  })
})

// ─── createSemanticLightConfig ──────────────────────────────────────────────────

describe('createSemanticLightConfig', () => {
  const config = createSemanticLightConfig()

  it('has correct source files (primitives + semantic)', () => {
    expect(config.source).toEqual([SOURCE.primitives, SOURCE.semantic])
  })

  it('generates "light" CSS with :root and [data-theme="light"] selectors', () => {
    const cssFile = config.platforms.css.files[0]
    expect(cssFile.destination).toBe('light.css')
    expect(cssFile.options.selector).toBe(':root, [data-theme="light"]')
  })

  it('uses isSemanticOrComponent as the token filter', () => {
    const cssFile = config.platforms.css.files[0]
    expect(cssFile.filter).toBe(isSemanticOrComponent)
  })

  it('writes Android day colors.xml', () => {
    const file = config.platforms.android.files[0]
    expect(file.destination).toBe('res/values/colors.xml')
  })

  it('writes Compose LightColors.kt', () => {
    const file = config.platforms.android.files[1]
    expect(file.destination).toBe('colors/LightColors.kt')
    expect(file.format).toBe('android/compose-colors')
    expect(file.options.objectName).toBe('LightColors')
  })
})

// ─── createSemanticDarkConfig ───────────────────────────────────────────────────

describe('createSemanticDarkConfig', () => {
  const config = createSemanticDarkConfig()

  it('has correct source files (primitives + dark)', () => {
    expect(config.source).toEqual([SOURCE.primitives, SOURCE.dark])
  })

  it('generates "dark" CSS with [data-theme="dark"] and .dark selectors', () => {
    const cssFile = config.platforms.css.files[0]
    expect(cssFile.destination).toBe('dark.css')
    expect(cssFile.options.selector).toBe('[data-theme="dark"], .dark')
  })

  it('uses isSemanticOrComponent as the token filter', () => {
    const cssFile = config.platforms.css.files[0]
    expect(cssFile.filter).toBe(isSemanticOrComponent)
  })

  it('writes Android night colors.xml', () => {
    const file = config.platforms.android.files[0]
    expect(file.destination).toBe('res/values-night/colors.xml')
  })

  it('writes Compose DarkColors.kt', () => {
    const file = config.platforms.android.files[1]
    expect(file.destination).toBe('colors/DarkColors.kt')
    expect(file.format).toBe('android/compose-colors')
    expect(file.options.objectName).toBe('DarkColors')
  })
})

// ─── createMobileAssetsConfig ───────────────────────────────────────────────────

describe('createMobileAssetsConfig', () => {
  const config = createMobileAssetsConfig()

  it('has a single ios platform', () => {
    expect(Object.keys(config.platforms)).toEqual(['ios'])
  })

  it('has empty files array', () => {
    expect(config.platforms.ios.files).toEqual([])
  })

  it('uses generate_ios_colorsets action', () => {
    expect(config.platforms.ios.actions).toEqual(['generate_ios_colorsets'])
  })

  it('uses BUILD_PATH.ios as buildPath', () => {
    expect(config.platforms.ios.buildPath).toBe(BUILD_PATH.ios)
  })
})

// ─── createConfigs ──────────────────────────────────────────────────────────────

describe('createConfigs', () => {
  const configs = createConfigs()

  it('returns an array of 4 entries', () => {
    expect(configs).toHaveLength(4)
  })

  it('has expected labels in order', () => {
    const labels = configs.map((c) => c.label)
    expect(labels).toEqual(['primitives', 'light', 'dark', 'ios-assets'])
  })

  it('each entry has a label and a config object', () => {
    for (const entry of configs) {
      expect(entry).toHaveProperty('label')
      expect(typeof entry.label).toBe('string')
      expect(entry).toHaveProperty('config')
      expect(typeof entry.config).toBe('object')
      expect(entry.config).toHaveProperty('platforms')
    }
  })

  it('ios-assets config runs last', () => {
    expect(configs.at(-1).label).toBe('ios-assets')
  })
})
