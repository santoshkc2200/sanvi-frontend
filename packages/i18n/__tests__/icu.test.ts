import { describe, expect, it } from 'vitest'
import {
  extractParams,
  formatPattern,
  IcuParseError,
  MissingParamError,
  parsePattern,
} from '../src/icu'

describe('ICU subset', () => {
  describe('plain text and args', () => {
    it('formats named arguments', () => {
      const nodes = parsePattern('Hello {name}, you have {count} messages')
      expect(formatPattern(nodes, { name: 'Ada', count: 3 }, 'en')).toBe(
        'Hello Ada, you have 3 messages',
      )
    })

    it('keeps apostrophes literal', () => {
      expect(formatPattern(parsePattern("Don't worry — it's fine"), {}, 'en')).toBe(
        "Don't worry — it's fine",
      )
    })

    it('throws MissingParamError for absent params', () => {
      expect(() => formatPattern(parsePattern('Hello {name}'), {}, 'en')).toThrow(MissingParamError)
    })
  })

  describe('plural', () => {
    const items = '{count, plural, =0 {No items} one {# item} other {# items}}'

    it('uses exact =N matches first', () => {
      expect(formatPattern(parsePattern(items), { count: 0 }, 'en')).toBe('No items')
      expect(formatPattern(parsePattern(items), { count: 5 }, 'en')).toBe('5 items')
    })

    it('selects the locale plural category — en has one/other', () => {
      expect(formatPattern(parsePattern(items), { count: 1 }, 'en')).toBe('1 item')
      expect(formatPattern(parsePattern(items), { count: 3 }, 'en')).toBe('3 items')
    })

    it('ja always takes other — Japanese has no plural categories', () => {
      expect(formatPattern(parsePattern(items), { count: 1 }, 'ja')).toBe('1 items')
      expect(formatPattern(parsePattern(items), { count: 3 }, 'ja')).toBe('3 items')
    })

    it('supports offset:N — # shifts by the offset', () => {
      const cart =
        '{count, plural, offset:1 =0 {Empty} =1 {Just yours} one {Yours and # other} other {Yours and # others}}'
      expect(formatPattern(parsePattern(cart), { count: 0 }, 'en')).toBe('Empty')
      expect(formatPattern(parsePattern(cart), { count: 1 }, 'en')).toBe('Just yours')
      expect(formatPattern(parsePattern(cart), { count: 3 }, 'en')).toBe('Yours and 2 others')
    })

    it('counts render through the locale number format', () => {
      const pattern = '{count, plural, other {# users}}'
      expect(formatPattern(parsePattern(pattern), { count: 1500 }, 'en')).toBe('1,500 users')
    })

    it('rejects a plural without other', () => {
      expect(() => parsePattern('{count, plural, one {#}}')).toThrow(IcuParseError)
    })

    it('rejects an unknown category', () => {
      expect(() => parsePattern('{count, plural, several {#} other {#}}')).toThrow(IcuParseError)
    })
  })

  describe('select', () => {
    const plan = '{role, select, admin {Administrator} viewer {Viewer} other {Member}}'

    it('matches exact selectors and falls back to other', () => {
      expect(formatPattern(parsePattern(plan), { role: 'admin' }, 'en')).toBe('Administrator')
      expect(formatPattern(parsePattern(plan), { role: 'owner' }, 'en')).toBe('Member')
    })

    it('rejects a select without other', () => {
      expect(() => parsePattern('{role, select, admin {A}}')).toThrow(IcuParseError)
    })
  })

  describe('nesting', () => {
    it('formats arguments inside branches', () => {
      const pattern = '{count, plural, one {One {thing}} other {{thing}s}}'
      expect(formatPattern(parsePattern(pattern), { count: 1, thing: 'cat' }, 'en')).toBe('One cat')
      expect(formatPattern(parsePattern(pattern), { count: 2, thing: 'cat' }, 'en')).toBe('cats')
    })

    it('nests select inside plural', () => {
      const pattern = '{n, plural, other {{role, select, admin {Admins: #} other {Users: #}}}}'
      expect(formatPattern(parsePattern(pattern), { n: 4, role: 'admin' }, 'en')).toBe('Admins: 4')
    })
  })

  describe('malformed patterns', () => {
    const bad = [
      'Hello {name',
      'Hello } name',
      '{name, number}',
      '{count, plural, one {#}',
      '{a, plural, other {b}',
      '{a b}',
      '{}',
      '{n, plural, other {unbalanced {select, other {x}}}',
    ]
    for (const pattern of bad) {
      it(`rejects ${JSON.stringify(pattern)}`, () => {
        expect(() => parsePattern(pattern)).toThrow(IcuParseError)
      })
    }
  })

  it('extractParams reports every param, with # bound to its plural arg', () => {
    expect(extractParams('Hello {name}')).toEqual(new Set(['name']))
    expect(extractParams('{count, plural, =0 {No items} one {# item} other {# items}}')).toEqual(
      new Set(['count']),
    )
    expect(extractParams('{n, plural, other {{role, select, admin {#} other {x}}}}')).toEqual(
      new Set(['n', 'role']),
    )
  })

  it('caches parses (same AST object back)', () => {
    expect(parsePattern('Hello {name}')).toBe(parsePattern('Hello {name}'))
  })
})
