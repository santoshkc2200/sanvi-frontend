/**
 * Input normalisation for CJK keyboards (phase 06): Japanese IMEs emit
 * full-width forms for ASCII (`ｕｓｅｒ＠ｅｘａｍｐｌｅ．ｃｏｍ`, `１２３`), and
 * `＠` vs `@` compares as a different character for every byte-oriented
 * matcher on the backend. These helpers produce the canonical form for
 * *matching* — the original input is preserved for display.
 */

/** Unicode Normalization Form KC: full-width → half-width, composed forms. */
export function nfkc(value: string): string {
  return value.normalize('NFKC')
}

/**
 * Emails: NFKC (full-width letters/digits/symbols → ASCII), trim, lowercase.
 * Local parts are technically case-sensitive; in practice every provider
 * treats them insensitively, and sign-in that punishes case is worse.
 */
export function normalizeEmail(value: string): string {
  return nfkc(value).trim().toLowerCase()
}

/** Phone numbers: NFKC, strip the separators humans type between digit groups. */
export function normalizeTel(value: string): string {
  return nfkc(value).replace(/[\s\-‐―–—（）().]/g, '')
}

/** Slugs and other machine identifiers: NFKC, trim, lowercase. */
export function normalizeSlug(value: string): string {
  return nfkc(value).trim().toLowerCase()
}
