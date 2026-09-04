import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AdLocaleCopyEditor from '../src/advertising/AdLocaleCopyEditor.svelte'
import { fixturePlatformByKey } from './fixtures/advertising/index'

/**
 * Per-locale creative copy fields (TASK-013): limits arrive from the
 * matrix, and the counter shows the limit *that locale* carries — the
 * acceptance criterion is that identical copy passes where the limit is
 * long and fails live where it is short (Meta's headline limit is 40 in
 * English, 25 in Japanese).
 */

const META = fixturePlatformByKey('meta')!

const LIMITS: Record<string, Record<string, number>> = {
  ...META.capability_matrix.text_limits,
}

const LABELS = {
  en: 'English',
  ja: 'Japanese',
  headline: 'Headline',
  body: 'Body',
}

/** The component seeds its own entries when none are passed; the harness
 * props here always include the counter suffix the app's i18n adds. */
const COUNTER = (current: number, limit: number) => `${current} / ${limit} characters`

describe('AdLocaleCopyEditor', () => {
  it('renders one group per locale with the fields the matrix gives it', () => {
    render(AdLocaleCopyEditor, {
      props: {
        limitsByLocale: LIMITS,
        optionLabels: LABELS,
        formatCounter: COUNTER,
      },
    })

    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Japanese')).toBeInTheDocument()
    const counters = screen.getAllByText(/\/ \d+ characters/)
    // headline + body, per locale.
    expect(counters.length).toBe(4)
  })

  it("shows each locale's own limit on the same field", () => {
    render(AdLocaleCopyEditor, {
      props: {
        limitsByLocale: LIMITS,
        optionLabels: LABELS,
        formatCounter: COUNTER,
      },
    })

    const headlineBoxes = screen.getAllByLabelText('Headline')
    expect(headlineBoxes.length).toBe(2)
    // English headline: 40. Japanese headline: 25. Same field, same copy,
    // different limits — read straight from the matrix.
    expect(screen.getByText('0 / 40 characters')).toBeInTheDocument()
    expect(screen.getByText('0 / 25 characters')).toBeInTheDocument()
  })

  it('passes copy that fits the English limit and flags the same length in Japanese', async () => {
    render(AdLocaleCopyEditor, {
      props: {
        limitsByLocale: LIMITS,
        optionLabels: LABELS,
        formatCounter: COUNTER,
        formatTooLongError: (limit, current) =>
          `Over the ${limit} character limit (now ${current}).`,
      },
    })

    const thirtyCharacters = 'x'.repeat(30)
    const [englishBox, japaneseBox] = screen.getAllByLabelText('Headline')
    fireEvent.input(englishBox!, { target: { value: thirtyCharacters } })
    fireEvent.input(japaneseBox!, { target: { value: thirtyCharacters } })

    // 30 ≤ 40 — the English headline passes with no error.
    expect(screen.queryByText(/Over the 40 character limit/)).toBeNull()
    // 30 > 25 — the Japanese headline fails, live, with both numbers.
    expect(screen.getByText(/Over the 25 character limit \(now 30\)\./)).toBeInTheDocument()
  })

  it('counts code points, not UTF-16 units', async () => {
    render(AdLocaleCopyEditor, {
      props: { limitsByLocale: LIMITS, optionLabels: LABELS, formatCounter: COUNTER },
    })

    // 20 surrogate pairs = 20 code points = 40 UTF-16 units.
    const twentyEmoji = '🎉'.repeat(20)
    const [englishBox] = screen.getAllByLabelText('Headline')
    fireEvent.input(englishBox!, { target: { value: twentyEmoji } })
    expect(screen.getByText('20 / 40 characters')).toBeInTheDocument()
  })

  it('renders nothing for a locale the matrix gives no entry', () => {
    render(AdLocaleCopyEditor, {
      props: {
        entries: [
          { locale: 'en', values: {} },
          { locale: 'de', values: {} },
        ],
        limitsByLocale: { en: { ...LIMITS.en! } },
        optionLabels: { en: 'English', de: 'German', headline: 'Headline', body: 'Body' },
      },
    })

    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.queryByText('German')).toBeNull()
  })

  it('has no axe violations', async () => {
    const { container } = render(AdLocaleCopyEditor, {
      props: { limitsByLocale: LIMITS, optionLabels: LABELS, formatCounter: COUNTER },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
