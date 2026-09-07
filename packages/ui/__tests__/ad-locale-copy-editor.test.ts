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

  it('keeps entries a parent restores after first render', async () => {
    // The autosave-resume path: the parent renders unbound, then assigns the
    // restored copy. A seeding effect that re-runs on that assignment would
    // discard exactly the copy it was asked to show.
    const { rerender } = render(AdLocaleCopyEditor, {
      props: { limitsByLocale: LIMITS, optionLabels: LABELS, formatCounter: COUNTER },
    })
    await rerender({
      entries: [{ locale: 'en', values: { headline: 'Restored headline' } }],
      limitsByLocale: LIMITS,
      optionLabels: LABELS,
      formatCounter: COUNTER,
    })

    const [englishBox] = screen.getAllByLabelText('Headline')
    expect((englishBox as HTMLTextAreaElement).value).toBe('Restored headline')
  })

  it('discards entries only when the limits themselves change', async () => {
    // A binding parent always passes `entries` back; what varies is whether
    // the limits object is merely a new object or a genuinely new matrix.
    const entries = [{ locale: 'en', values: { headline: 'Typed copy' } }]
    const props = (limitsByLocale: Record<string, Record<string, number>>) => ({
      entries,
      limitsByLocale,
      optionLabels: LABELS,
      formatCounter: COUNTER,
    })
    const { rerender } = render(AdLocaleCopyEditor, { props: props(LIMITS) })
    expect((screen.getAllByLabelText('Headline')[0] as HTMLTextAreaElement).value).toBe(
      'Typed copy',
    )

    // A fresh object with the same locales and fields is not a matrix change
    // — the parent rebuilds this object on every recompute.
    await rerender(props(structuredClone(LIMITS)))
    expect((screen.getAllByLabelText('Headline')[0] as HTMLTextAreaElement).value).toBe(
      'Typed copy',
    )

    // Dropping a locale is a real change: stale entries would bind to fields
    // the new matrix does not have, so they go.
    await rerender(props({ en: { ...LIMITS.en! } }))
    expect((screen.getAllByLabelText('Headline')[0] as HTMLTextAreaElement).value).toBe('')
    expect(screen.queryByText('Japanese')).toBeNull()
  })

  it('has no axe violations', async () => {
    const { container } = render(AdLocaleCopyEditor, {
      props: { limitsByLocale: LIMITS, optionLabels: LABELS, formatCounter: COUNTER },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
