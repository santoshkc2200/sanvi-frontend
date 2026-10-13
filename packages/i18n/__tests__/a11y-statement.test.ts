import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The accessibility statement's honesty gate (TASK-027 step 10): the copy
 * must name the method actually used and the known gaps, and must never
 * claim conformance. Claiming WCAG conformance without the external audit
 * that could verify it would be "the one accessibility failure that is also
 * a false statement", so this test scans the statement copy itself in both
 * locales.
 */

const STATEMENT_KEYS = [
  'a11y.statement.title',
  'a11y.statement.updated',
  'a11y.statement.intro',
  'a11y.statement.standard',
  'a11y.statement.methodTitle',
  'a11y.statement.methodAutomated',
  'a11y.statement.methodKeyboard',
  'a11y.statement.methodLayout',
  'a11y.statement.gapsTitle',
  'a11y.statement.gapAudit',
  'a11y.statement.gapScreenReaders',
  'a11y.statement.feedbackTitle',
  'a11y.statement.feedback',
] as const

/** Copy fragments that would constitute a conformance claim, in either locale. */
const FORBIDDEN = [
  /conforms? to/i,
  /compliant with/i,
  /is accessible to WCAG/i,
  /fully accessible/i,
  /meets WCAG/i,
  /WCAG (2\.[12] )?AA (準拠|適合)/,
  /準拠しています/,
  /アクセシビリティに完全対応/,
]

const REQUIRED_PATTERNS: Record<string, RegExp[]> = {
  'a11y.statement.standard': [/WCAG 2\.2/],
  'a11y.statement.gapAudit': [/audit|監査/],
  'a11y.statement.gapScreenReaders': [/NVDA/, /VoiceOver/],
  'a11y.statement.methodAutomated': [/axe/i, /locale|ロケール|日本語/],
}

describe('accessibility statement honesty gate (TASK-027)', () => {
  for (const locale of ['en', 'ja'] as const) {
    it(`${locale}: statement copy exists for every key and claims no conformance`, () => {
      const catalog: Record<string, string> = JSON.parse(
        readFileSync(join(__dirname, `../../i18n/messages/${locale}/a11y.json`), 'utf8'),
      )
      const fullText = STATEMENT_KEYS.map((key) => catalog[key] ?? '').join('\n')

      for (const key of STATEMENT_KEYS) {
        expect(catalog[key], `${key} missing in ${locale}`).toBeTruthy()
      }
      for (const pattern of FORBIDDEN) {
        expect(fullText, `${locale} statement must not match ${pattern}`).not.toMatch(pattern)
      }
      for (const [key, patterns] of Object.entries(REQUIRED_PATTERNS)) {
        for (const pattern of patterns) {
          expect(catalog[key] ?? '', `${key} (${locale}) must match ${pattern}`).toMatch(pattern)
        }
      }
    })
  }
})
