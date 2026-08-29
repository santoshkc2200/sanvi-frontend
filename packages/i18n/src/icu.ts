/**
 * A compiled-format subset of ICU MessageFormat — the same syntax family the
 * backend catalogs use (`docs/phase-06-i18n-l10n/implementation-plan.md`),
 * covering what UI copy actually needs and no more:
 *
 * - `Hello {name}` — named arguments
 * - `{count, plural, =0 {No items} one {# item} other {# items}}` — plural
 *   categories via `Intl.PluralRules` for the *rendering* locale (so `ja`
 *   always takes `other`, `en` takes `one`/`other`), `=N` exact matches, and
 *   `#` for the counted value. An optional `offset:N` shifts both.
 * - `{role, select, admin {…} other {…}}` — arbitrary alternatives, `other`
 *   required as the fallback.
 *
 * Patterns are parsed once per catalog load and cached; a malformed pattern
 * throws {@link IcuParseError} at parse time — the `i18n:check` gate runs
 * every catalog string through this parser, so a broken message fails CI
 * instead of a user's screen. Not supported (and rejected by the gate rather
 * than mis-rendered here): number/date sub-formats (`{n, number, ::…}`),
 * `selectOrdinal`, and quote-escaping — apostrophes are always literal, and
 * `{`/`}` may not appear in text.
 */

export class IcuParseError extends Error {
  constructor(message: string) {
    super(`ICU parse error: ${message}`)
    this.name = 'IcuParseError'
  }
}

/** Thrown at format time when a pattern references a param the caller didn't pass. */
export class MissingParamError extends Error {
  constructor(name: string) {
    super(`Missing message param "${name}"`)
    this.name = 'MissingParamError'
  }
}

export type PatternNode =
  | { kind: 'text'; value: string }
  | { kind: 'arg'; name: string }
  | { kind: 'plural'; name: string; offset: number; options: Map<string, PatternNode[]> }
  | { kind: 'select'; name: string; options: Map<string, PatternNode[]> }

export type MessageParams = Record<string, string | number>

const ARG_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const PLURAL_CATEGORY = /^(zero|one|two|few|many|other)$/

class Parser {
  readonly source: string
  pos = 0
  /** Enclosing plural args, innermost last — `#` resolves to the innermost. */
  readonly #pluralStack: string[] = []

  constructor(source: string) {
    this.source = source
  }

  #error(message: string): never {
    throw new IcuParseError(`${message} at position ${this.pos} in ${JSON.stringify(this.source)}`)
  }

  #peek(): string | undefined {
    return this.source[this.pos]
  }

  parseTopLevel(): PatternNode[] {
    const nodes = this.#parseNodes(false)
    if (this.pos < this.source.length) this.#error('Unexpected trailing input')
    return nodes
  }

  /** Parses until end of source (top level) or the closing `}` of a nested body. */
  #parseNodes(nested: boolean): PatternNode[] {
    const nodes: PatternNode[] = []
    let text = ''
    const flush = (): void => {
      if (text !== '') {
        nodes.push({ kind: 'text', value: text })
        text = ''
      }
    }

    while (this.pos < this.source.length) {
      const ch = this.#peek()
      if (ch === '}') {
        if (!nested) this.#error('Unexpected "}"')
        break
      }
      if (ch === '{') {
        flush()
        nodes.push(this.#parseArgument())
      } else if (ch === '#' && this.#pluralStack.length > 0) {
        flush()
        const name = this.#pluralStack[this.#pluralStack.length - 1] ?? ''
        nodes.push({ kind: 'arg', name: `#${name}` })
        this.pos += 1
      } else {
        text += ch
        this.pos += 1
      }
    }
    if (nested && this.#peek() !== '}') this.#error('Expected "}"')
    flush()
    return nodes
  }

  #parseArgument(): PatternNode {
    this.pos += 1 // "{"
    const name = this.#readUntil(',', '}')
    if (this.#peek() === '}') {
      this.pos += 1
      if (!ARG_NAME.test(name)) this.#error(`Invalid argument name "${name}"`)
      return { kind: 'arg', name }
    }
    this.pos += 1 // ","

    const type = this.#readUntil(',', '}')
    if (this.#peek() !== ',') this.#error(`Expected "," after argument type`)
    this.pos += 1 // ","
    if (type !== 'plural' && type !== 'select') {
      this.#error(`Unsupported argument type "${type}" (only plural and select)`)
    }

    let offset = 0
    if (type === 'plural') {
      const offsetMatch = /^\s*offset\s*:\s*(\d+)/.exec(this.source.slice(this.pos))
      if (offsetMatch) {
        offset = Number.parseInt(offsetMatch[1] ?? '0', 10)
        this.pos += offsetMatch[0].length
      }
    }

    const options = new Map<string, PatternNode[]>()
    let sawOther = false
    for (;;) {
      this.#skipWhitespace()
      if (this.pos >= this.source.length || this.#peek() === '}') break
      const selector = this.#readSelector()
      if (type === 'plural') {
        if (!selector.startsWith('=') && !PLURAL_CATEGORY.test(selector)) {
          this.#error(`Invalid plural selector "${selector}"`)
        }
      } else if (!ARG_NAME.test(selector) && !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(selector)) {
        this.#error(`Invalid select selector "${selector}"`)
      }
      if (selector === 'other') sawOther = true

      this.#skipWhitespace()
      if (this.#peek() !== '{') this.#error(`Expected "{" after selector "${selector}"`)
      this.pos += 1
      if (type === 'plural') this.#pluralStack.push(name)
      try {
        options.set(selector, this.#parseNodes(true))
      } finally {
        if (type === 'plural') this.#pluralStack.pop()
      }
      this.pos += 1 // the body's "}"
    }
    if (this.#peek() !== '}') this.#error('Expected "}" to close the argument')
    this.pos += 1 // the argument's own "}"
    if (!sawOther) this.#error(`"${type}" for "${name}" is missing the required "other" selector`)

    return type === 'plural'
      ? { kind: 'plural', name, offset, options }
      : { kind: 'select', name, options }
  }

  #readUntil(...stopChars: string[]): string {
    const start = this.pos
    while (this.pos < this.source.length && !stopChars.includes(this.#peek() ?? '')) {
      this.pos += 1
    }
    if (this.pos >= this.source.length) this.#error('Unexpected end of pattern')
    return this.source.slice(start, this.pos).trim()
  }

  #readSelector(): string {
    const start = this.pos
    while (this.pos < this.source.length && !/[\s{]/.test(this.#peek() ?? '')) this.pos += 1
    const selector = this.source.slice(start, this.pos)
    if (!selector) this.#error('Expected a selector')
    return selector
  }

  #skipWhitespace(): boolean {
    while (/[\s]/.test(this.#peek() ?? '')) this.pos += 1
    return this.pos < this.source.length
  }
}

const patternCache = new Map<string, PatternNode[]>()

/** Parses a pattern to AST (memoized) — the entry point catalog compilation uses. */
export function parsePattern(source: string): PatternNode[] {
  const cached = patternCache.get(source)
  if (cached) return cached
  const nodes = new Parser(source).parseTopLevel()
  patternCache.set(source, nodes)
  return nodes
}

/** Formats a parsed pattern. Throws {@link MissingParamError} when a referenced param is absent. */
export function formatPattern(
  nodes: PatternNode[],
  params: MessageParams | undefined,
  locale: string,
): string {
  let out = ''
  for (const node of nodes) {
    if (node.kind === 'text') {
      out += node.value
    } else if (node.kind === 'arg') {
      out += resolveArg(node.name, params, locale)
    } else {
      const value = params?.[node.name]
      if (value === undefined || value === '') throw new MissingParamError(node.name)
      let branch: PatternNode[] | undefined
      let count = 0
      if (node.kind === 'select') {
        branch = node.options.get(String(value))
      } else {
        count = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(count)) throw new MissingParamError(node.name)
        branch = node.options.get(`=${count}`)
        branch ??= node.options.get(new Intl.PluralRules(locale).select(count))
      }
      branch ??= node.options.get('other')
      if (!branch) throw new IcuParseError(`No "other" branch for "${node.name}"`)
      const childParams =
        node.kind === 'plural' ? { ...params, [`#${node.name}`]: count - node.offset } : params
      out += formatPattern(branch, childParams, locale)
    }
  }
  return out
}

function resolveArg(name: string, params: MessageParams | undefined, locale: string): string {
  const value = params?.[name]
  if (value === undefined) throw new MissingParamError(name.replace(/^#/, ''))
  if (name.startsWith('#')) {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? new Intl.NumberFormat(locale).format(numeric) : String(value)
  }
  return String(value)
}

/** Every param name a pattern reads; `#`-bound plural args are reported bare. */
export function extractParams(source: string): Set<string> {
  const params = new Set<string>()
  const walk = (nodes: PatternNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'text') continue
      params.add(node.name.replace(/^#/, ''))
      if (node.kind !== 'arg') {
        for (const branch of node.options.values()) walk(branch)
      }
    }
  }
  walk(parsePattern(source))
  return params
}
