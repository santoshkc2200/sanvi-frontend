import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import PlacementPreview from '../src/advertising/PlacementPreview.svelte'
import { fixturePlatformByKey } from './fixtures/advertising/index'

/**
 * The placement preview frame (TASK-013): spec-driven shape, real copy,
 * themed through tokens. The CJK assertions are the phase-06 contract —
 * the frame clips rather than grows, so a headline that overflows in
 * Japanese is visible here instead of on the platform.
 */

const META = fixturePlatformByKey('meta')!

function spec(key: string) {
  const placement = META.capability_matrix.creative_placements.find(
    (candidate) => candidate.key === key,
  )
  if (!placement) throw new Error(`fixture is missing the ${key} placement`)
  return placement.asset_spec
}

describe('PlacementPreview', () => {
  it('renders the placement label, copy lines, and image from its props', () => {
    render(PlacementPreview, {
      props: {
        placementKey: 'feed',
        placementLabel: 'Feed',
        spec: spec('feed'),
        copyLines: ['Summer sale', 'Up to 50% off everything'],
        imageUrl: 'blob:preview',
        imageAlt: 'Summer sale banner',
        locale: 'en',
      },
    })

    expect(screen.getByText('Summer sale')).toBeInTheDocument()
    expect(screen.getByText('Up to 50% off everything')).toBeInTheDocument()
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'blob:preview')
    expect(image).toHaveAttribute('alt', 'Summer sale banner')
  })

  it('sets the copy block lang so CJK line-breaking rules apply', () => {
    const { container } = render(PlacementPreview, {
      props: {
        placementKey: 'stories',
        placementLabel: 'Stories',
        spec: spec('stories'),
        copyLines: ['夏の大セール、最大50%オフ'],
        locale: 'ja',
      },
    })

    const copy = container.querySelector('.sanvi-ad-preview__copy')
    expect(copy).toHaveAttribute('lang', 'ja')
    // The component's stylesheet (compiled out under vitest) clips the copy
    // block rather than growing the frame — `overflow: hidden` with
    // `overflow-wrap: anywhere` — so long Japanese copy visibly clips the
    // way a real placement would. Pixel-level CJK snapshots are TASK-018's.
  })

  it('shapes the frame from the spec allowed ratio', () => {
    const { container } = render(PlacementPreview, {
      props: {
        placementKey: 'stories',
        placementLabel: 'Stories',
        spec: spec('stories'),
        copyLines: [],
      },
    })

    const frame = container.querySelector('.sanvi-ad-preview__frame') as HTMLElement
    expect(frame.style.aspectRatio).toBe('9 / 16')
  })

  it('renders placeholders when nothing has been entered yet', () => {
    render(PlacementPreview, {
      props: {
        placementKey: 'feed',
        placementLabel: 'Feed',
        spec: spec('feed'),
        copyLines: [],
        labels: { noImageLabel: 'No image yet', emptyCopyLabel: '—' },
      },
    })

    expect(screen.getByText('No image yet')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('names the preview for assistive tech', () => {
    const { container } = render(PlacementPreview, {
      props: {
        placementKey: 'feed',
        placementLabel: 'Feed',
        spec: spec('feed'),
        copyLines: ['Hello'],
        labels: { frameLabel: 'Feed placement preview' },
      },
    })

    expect(container.querySelector('figure')).toHaveAttribute(
      'aria-label',
      'Feed placement preview',
    )
  })

  it('has no axe violations', async () => {
    const { container } = render(PlacementPreview, {
      props: {
        placementKey: 'feed',
        placementLabel: 'Feed',
        spec: spec('feed'),
        copyLines: ['Summer sale', 'Up to 50% off'],
        imageUrl: 'blob:preview',
        imageAlt: 'Summer sale banner',
        locale: 'ja',
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
