import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const camelToSnake = (s) => s.replace(/([A-Z])/g, '_$1').toLowerCase()

// ─── Constants ────────────────────────────────────────────────────────────────

export const BUILD_PATH = {
  css: path.join(ROOT, 'dist/css/'),
  ts: path.join(ROOT, 'dist/ts/'),
  json: path.join(ROOT, 'dist/json/'),
  ios: path.join(ROOT, 'dist/ios/'),
  android: path.join(ROOT, 'dist/android/'),
}

export const SOURCE = {
  primitives: path.join(ROOT, 'tokens/primitives.json'),
  semantic: path.join(ROOT, 'tokens/semantic.json'),
  dark: path.join(ROOT, 'tokens/dark.json'),
}

// ─── Extension readers ─────────────────────────────────────────
export const getExtensions = (token) => (token.$extensions ?? token.extensions)?.sanvi ?? {}

export const getPlatformTags = (token) => getExtensions(token).platforms ?? []
export const isIosExported = (token) => getPlatformTags(token).includes('ios')
export const isAndroidExported = (token) => getPlatformTags(token).includes('android')

// ─── Token layer predicates ────────────────────────────────────────────────────

export const isPrimitive = (t) => t.path?.[0] === 'primitive'
export const isComponent = (t) => t.path?.[0] === 'color' && t.path?.[1] === 'component'
export const isSemantic = (t) => !isPrimitive(t) && !isComponent(t)
export const isSemanticOrComponent = (t) => isSemantic(t) || isComponent(t)

// ─── Token type helpers ────────────────────────────────────────────────────────

export const getTokenType = (token) => token.$type ?? token.type

// export const isColorToken = (token) => getTokenType(token) === 'color'

export const isDimensionToken = (token) =>
  ['spacing', 'dimension', 'borderRadius'].includes(getTokenType(token))

// ─── Transform stacks ─────────────────────────────────────────────────────────

export const CSS_TRANSFORMS = [
  'ts/descriptionToComment',
  'ts/resolveMath',
  'ts/size/px',
  'ts/opacity',
  'ts/size/lineheight',
  'ts/size/css/letterspacing',
  'ts/typography/fontWeight',
  'ts/color/css/hexrgba',
  'ts/color/modifiers',
  'name/kebab-strip-primitive',
]

export const JS_TRANSFORMS = [
  'ts/descriptionToComment',
  'ts/resolveMath',
  'ts/size/px',
  'ts/opacity',
  'ts/color/css/hexrgba',
  'ts/color/modifiers',
  'name/camel-strip-primitive',
]

export const IOS_TRANSFORMS = [
  'ts/resolveMath',
  'ts/size/px',
  'ts/color/css/hexrgba',
  'name/camel-strip-primitive',
]

// ─── iOS colour helper ─────────────────────────────────────────────────────────

export function hexToXcodeColor(hex) {
  const h = hex.replace('#', '')
  let r, g, b, a

  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16)
    g = parseInt(h[1] + h[1], 16)
    b = parseInt(h[2] + h[2], 16)
    a = 255
  } else if (h.length === 6) {
    r = parseInt(h.substring(0, 2), 16)
    g = parseInt(h.substring(2, 4), 16)
    b = parseInt(h.substring(4, 6), 16)
    a = 255
  } else if (h.length === 8) {
    r = parseInt(h.substring(0, 2), 16)
    g = parseInt(h.substring(2, 4), 16)
    b = parseInt(h.substring(4, 6), 16)
    a = parseInt(h.substring(6, 8), 16)
  } else {
    throw new Error(`hexToXcodeColor: unexpected hex length for "${hex}"`)
  }

  return {
    'color-space': 'srgb',
    components: {
      red: (r / 255).toFixed(3),
      green: (g / 255).toFixed(3),
      blue: (b / 255).toFixed(3),
      alpha: (a / 255).toFixed(3),
    },
  }
}

// ─── Compose colour helper ─────────────────────────────────────────────────────

export function hexToComposeColor(hex) {
  const raw = hex.replace('#', '').toUpperCase()

  if (raw.length === 3) {
    const r = raw[0].repeat(2)
    const g = raw[1].repeat(2)
    const b = raw[2].repeat(2)
    return `0xFF${r}${g}${b}`
  }

  if (raw.length === 6) {
    return `0xFF${raw}`
  }

  if (raw.length === 8) {
    const rr = raw.slice(0, 2)
    const gg = raw.slice(2, 4)
    const bb = raw.slice(4, 6)
    const aa = raw.slice(6, 8)
    return `0x${aa}${rr}${gg}${bb}`
  }

  throw new Error(
    `hexToComposeColor: unexpected hex format "${hex}". Expected #RGB, #RRGGBB, or #RRGGBBAA.`,
  )
}

// ─── Name transforms (pure, does not call SD.registerTransform) ────────────────

export function transformKebabStripPrimitive(token) {
  const parts = token.path.filter((p) => p !== 'primitive')
  return `sanvi-${parts.join('-')}`
}

export function transformCamelStripPrimitive(token) {
  const parts = token.path.filter((p) => p !== 'primitive')
  return `sanvi${parts
    .map((p, i) =>
      i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join('')}`
}

// ─── Platform factory ──────────────────────────────────────────────────────────

export function makePlatforms({
  name,
  cssSelector,
  androidColorPath,
  androidKotlinPath = null,
  androidKotlinObjectName,
  androidKotlinPackageName = 'com.sanvi.designtokens.colors',
  iosJsonName = null,
  filter = () => true,
}) {
  return {
    css: {
      transforms: CSS_TRANSFORMS,
      buildPath: BUILD_PATH.css,
      prefix: 'sanvi',
      files: [
        {
          destination: `${name}.css`,
          format: 'custom/css-variables',
          filter,
          options: {
            selector: cssSelector,
            outputReferences: false,
          },
        },
      ],
    },

    ts: {
      transforms: JS_TRANSFORMS,
      buildPath: BUILD_PATH.ts,
      files: [
        {
          destination: `${name}.ts`,
          format: 'custom/typescript-esm',
          filter,
        },
      ],
    },

    json: {
      transforms: JS_TRANSFORMS,
      buildPath: BUILD_PATH.json,
      files: [
        {
          destination: `${name}.json`,
          format: 'custom/json-flat',
          filter,
        },
        ...(iosJsonName
          ? [
              {
                destination: `${iosJsonName}.json`,
                format: 'custom/json-flat',
                filter: (t) => filter(t) && isIosExported(t),
              },
            ]
          : []),
      ],
    },

    android: {
      transforms: [
        'ts/resolveMath',
        'ts/size/px',
        'ts/color/css/hexrgba',
        'name/camel-strip-primitive',
      ],
      buildPath: BUILD_PATH.android,
      files: [
        ...(androidColorPath
          ? [
              {
                destination: `${androidColorPath}colors.xml`,
                format: 'custom/android-colors-xml',
                filter: (token) => filter(token) && isAndroidExported(token),
              },
            ]
          : []),
        ...(androidKotlinPath && androidKotlinObjectName
          ? [
              {
                destination: `${androidKotlinPath}${androidKotlinObjectName}.kt`,
                format: 'android/compose-colors',
                filter: (token) => filter(token) && isAndroidExported(token),
                options: {
                  packageName: androidKotlinPackageName,
                  objectName: androidKotlinObjectName,
                },
              },
            ]
          : []),
      ],
    },
  }
}

// ─── Build configurations (data-only, no side effects) ─────────────────────────

export function createPrimitiveConfig() {
  return {
    log: { verbosity: 'default' },
    preprocessors: ['tokens-studio'],
    source: [SOURCE.primitives],
    platforms: makePlatforms({
      name: 'primitives',
      cssSelector: ':root',
      androidColorPath: null,
      filter: isPrimitive,
    }),
  }
}

export function createSemanticLightConfig() {
  return {
    log: { verbosity: 'default' },
    preprocessors: ['tokens-studio'],
    source: [SOURCE.primitives, SOURCE.semantic],
    platforms: makePlatforms({
      name: 'light',
      cssSelector: ':root, [data-theme="light"]',
      androidColorPath: 'res/values/',
      androidKotlinPath: 'colors/',
      androidKotlinObjectName: 'LightColors',
      iosJsonName: 'light-ios',
      filter: isSemanticOrComponent,
    }),
  }
}

export function createSemanticDarkConfig() {
  return {
    log: { verbosity: 'default' },
    preprocessors: ['tokens-studio'],
    source: [SOURCE.primitives, SOURCE.dark],
    platforms: makePlatforms({
      name: 'dark',
      cssSelector: '[data-theme="dark"], .dark',
      androidColorPath: 'res/values-night/',
      androidKotlinPath: 'colors/',
      androidKotlinObjectName: 'DarkColors',
      iosJsonName: 'dark-ios',
      filter: isSemanticOrComponent,
    }),
  }
}

export function createMobileAssetsConfig() {
  return {
    log: { verbosity: 'default' },
    platforms: {
      ios: {
        buildPath: BUILD_PATH.ios,
        files: [],
        actions: ['generate_ios_colorsets'],
      },
    },
  }
}

export function createConfigs() {
  return [
    { label: 'primitives', config: createPrimitiveConfig() },
    { label: 'light', config: createSemanticLightConfig() },
    { label: 'dark', config: createSemanticDarkConfig() },
    { label: 'ios-assets', config: createMobileAssetsConfig() },
  ]
}
