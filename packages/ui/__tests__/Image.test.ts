import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Image from '../src/Image.svelte'
import { axe } from '@sanvi/test-config/axe'

describe('Image — the image-contract component (TASK-022)', () => {
  it('always renders explicit width and height attributes', () => {
    const { getByRole } = render(Image, {
      src: '/photo.jpg',
      alt: 'A product photo',
      width: 1200,
      height: 800,
    })
    const img = getByRole('img', { name: 'A product photo' }) as HTMLImageElement
    expect(img.getAttribute('width')).toBe('1200')
    expect(img.getAttribute('height')).toBe('800')
  })

  it('defaults to lazy loading and async decoding — the below-the-fold common case', () => {
    const { getByRole } = render(Image, {
      src: '/photo.jpg',
      alt: 'lazy',
      width: 100,
      height: 100,
    })
    const img = getByRole('img') as HTMLImageElement
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('decoding')).toBe('async')
    expect(img.getAttribute('fetchpriority')).toBeNull()
  })

  it('passes the LCP combination through — eager + fetchpriority=high', () => {
    const { getByRole } = render(Image, {
      src: '/hero.jpg',
      alt: 'hero',
      width: 1600,
      height: 900,
      loading: 'eager',
      fetchpriority: 'high',
    })
    const img = getByRole('img') as HTMLImageElement
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('fetchpriority')).toBe('high')
  })

  it('marks an empty alt as presentation instead of exposing an image role', () => {
    const { container } = render(Image, {
      src: '/divider.jpg',
      alt: '',
      width: 10,
      height: 10,
    })
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('role')).toBe('presentation')
  })

  it('passes srcset and sizes through untouched', () => {
    const { getByRole } = render(Image, {
      src: '/photo.jpg',
      alt: 'responsive',
      width: 800,
      height: 600,
      srcset: '/photo-400.jpg 400w, /photo-800.jpg 800w',
      sizes: '(max-width: 600px) 400px, 800px',
    })
    const img = getByRole('img') as HTMLImageElement
    expect(img.getAttribute('srcset')).toContain('photo-800.jpg')
    expect(img.getAttribute('sizes')).toBe('(max-width: 600px) 400px, 800px')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(Image, {
      src: '/photo.jpg',
      alt: 'An accessible product photo',
      width: 600,
      height: 400,
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})
