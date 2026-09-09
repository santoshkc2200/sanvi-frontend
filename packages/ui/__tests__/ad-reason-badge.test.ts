import { axe } from '@sanvi/test-config/axe'
import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import ReasonBadge from '../src/advertising/ReasonBadge.svelte'
import {
  AD_DIRECTIVE_CATEGORIES,
  AD_REASON_CATEGORIES,
  AD_REASON_TONES,
  isDirectiveCategory,
} from '../src/advertising/reasons'

/**
 * The reason taxonomy's presentational layer (TASK-015). The load-bearing
 * assertions: every category renders a badge, the four directive-decided
 * categories never share an alert tone with the fixable ones, and the tone
 * record is exhaustive over the taxonomy.
 */

afterEach(cleanup)

describe('ReasonBadge', () => {
  it('renders every taxonomy category — exhaustive over the enum', () => {
    for (const category of AD_REASON_CATEGORIES) {
      const { unmount } = render(ReasonBadge, { category, label: `label:${category}` })
      expect(screen.getByText(`label:${category}`)).toBeTruthy()
      unmount()
    }
  })

  it('gives directive-decided categories a neutral tone — working privacy is not an incident', () => {
    for (const category of AD_DIRECTIVE_CATEGORIES) {
      expect(AD_REASON_TONES[category], category).toBe('neutral')
    }
  })

  it('never gives a fixable category the neutral tone', () => {
    const fixable = AD_REASON_CATEGORIES.filter((c) => !isDirectiveCategory(c))
    expect(fixable).toEqual(['missing_click_id', 'token_expired', 'upload_error'])
    for (const category of fixable) {
      expect(AD_REASON_TONES[category], category).not.toBe('neutral')
    }
  })

  it('passes axe', async () => {
    const { container } = render(ReasonBadge, { category: 'upload_error', label: 'Upload error' })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
