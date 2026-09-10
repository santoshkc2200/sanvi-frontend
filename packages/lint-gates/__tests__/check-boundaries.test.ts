import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkWorkspace } from '../src/check-boundaries.mjs'
import { scanWorkspace as scanBlendedAttribution } from '../src/check-no-blended-attribution.mjs'
import { isFormPath, scanWorkspace } from '../src/check-platform-literals.mjs'

const FIXTURES = fileURLToPath(new URL('../__fixtures__/', import.meta.url))

describe('check:boundaries gate', () => {
  it('fails on its violation fixture — a lint nobody has seen fail is a lint nobody trusts', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.length).toBe(5)
  })

  it('catches ui importing api-client', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(
      violations.some((v) => v.file.includes('/ui/src/') && v.specifier === '@sanvi/api-client'),
    ).toBe(true)
  })

  it('catches one app importing another', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.some((v) => v.specifier === '@sanvi/storefront')).toBe(true)
  })

  it('catches a deep import into another package src', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.some((v) => v.specifier === '@sanvi/ui/src/Button.svelte')).toBe(true)
  })

  it('catches a dynamic deep import into another package src', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.some((v) => v.specifier === '@sanvi/ui/src/index.ts')).toBe(true)
  })

  it('catches a package importing an app — dependencies never point upward', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.some((v) => v.specifier === '@sanvi/marketing')).toBe(true)
  })

  it('passes on its clean fixture', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-clean`)
    expect(violations).toEqual([])
  })
})

describe('check:platform-literals gate (phase 10, TASK-010)', () => {
  it('fails on its violation fixture — a lint nobody has seen fail is a lint nobody trusts', () => {
    const violations = scanWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('catches a platform identifier in a form path (tier 1)', () => {
    const violations = scanWorkspace(`${FIXTURES}boundaries-violation`)
    const hit = violations.find(
      (v) => v.literal === 'google_ads' && v.file.includes('forms/special-case.ts'),
    )
    expect(hit).toBeDefined()
    expect(hit?.tier).toBe(1)
  })

  it('catches a platform identifier in a .svelte template expression, but not in its comment', () => {
    const violations = scanWorkspace(`${FIXTURES}boundaries-violation`)
    const svelteHits = violations.filter((v) => v.file.endsWith('AdvertisingPanel.svelte'))
    // 'meta_ads' in code, double-quoted 'reels', and double-quoted attribute 'sales'
    // — the commented google_ads must not appear.
    expect(svelteHits.map((v) => v.literal).sort()).toEqual(['meta_ads', 'reels', 'sales'])
  })

  it('catches double-quoted matrix values and double-quoted Svelte attributes in form paths', () => {
    const violations = scanWorkspace(`${FIXTURES}boundaries-violation`)
    const svelteHits = violations.filter((v) => v.file.endsWith('AdvertisingPanel.svelte'))
    expect(svelteHits.find((v) => v.literal === 'reels')).toBeDefined()
    expect(svelteHits.find((v) => v.literal === 'sales')).toBeDefined()
  })

  it('catches matrix values (objective literals) inside form paths (tier 2)', () => {
    const violations = scanWorkspace(`${FIXTURES}boundaries-violation`)
    const literals = violations.filter((v) => v.file.includes('forms/special-case.ts'))
    expect(new Set(literals.map((v) => v.literal))).toEqual(
      new Set(['app_promotion', 'google_ads', 'sales']),
    )
    expect(literals.filter((v) => v.tier === 2).every((v) => v.scope === 'form path')).toBe(true)
  })

  it('passes on its clean fixture — comments may speak the contract, code may not', () => {
    const violations = scanWorkspace(`${FIXTURES}boundaries-clean`)
    expect(violations).toEqual([])
  })

  it('form-path scope covers forms/ and advertising/ trees and advertising filenames', () => {
    expect(isFormPath('packages/ui/src/forms/schema.ts')).toBe(true)
    expect(isFormPath('packages/ui/src/advertising/AdPlatformCard.svelte')).toBe(true)
    expect(isFormPath('apps/admin/src/routes/AdvertisingSettings.svelte')).toBe(true)
    expect(isFormPath('apps/admin/src/lib/payments/helpers.ts')).toBe(false)
  })
})

describe('check:no-blended-attribution gate (phase 10, TASK-016, NFR-1002)', () => {
  it('fails on its violation fixture — a lint nobody has seen fail is a lint nobody trusts', () => {
    const violations = scanBlendedAttribution(`${FIXTURES}attribution`)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('catches both spellings of a blended figure in code', () => {
    const violations = scanBlendedAttribution(`${FIXTURES}attribution`)
    const identifiers = [...new Set(violations.map((v) => v.identifier))].sort()
    expect(identifiers).toEqual(['blended_roas', 'totalConversionValue'])
  })

  it('exempts comments — documentation may speak the rule code may not', () => {
    const violations = scanBlendedAttribution(`${FIXTURES}attribution`)
    const svelteHits = violations.filter((v) => v.file.endsWith('TwoNumbers.svelte'))
    expect(svelteHits).toEqual([])
  })
})
