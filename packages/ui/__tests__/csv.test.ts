import { describe, expect, it } from 'vitest'
import { csvCell, csvDocument } from '../src/csv'

describe('csv helpers', () => {
  it('quotes cells and escapes embedded quotes', () => {
    expect(csvCell('plain')).toBe('"plain"')
    expect(csvCell('has "quotes"')).toBe('"has ""quotes"""')
  })

  it('renders null and undefined as empty cells', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })

  it('neutralises formula-injection prefixes', () => {
    // Operator-influenced text (tenant names, audit reasons) must not be able
    // to execute as a formula when the export opens in a spreadsheet app.
    for (const dangerous of ['=cmd|...!A1', '+1+1', '-1+1', '@x', '\tsum', '\rsum']) {
      expect(csvCell(dangerous).startsWith('"\'')).toBe(true)
    }
    expect(csvCell('normal text')).toBe('"normal text"')
  })

  it('joins rows with CRLF', () => {
    expect(
      csvDocument([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('"a","b"\r\n"c","d"')
  })
})
