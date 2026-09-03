/**
 * Presentation fallback for option values that arrive as matrix data
 * (`app_promotion` → "App promotion"). An app that has an localized label
 * for a value passes it via its `optionLabels` map; the humanized value is
 * what renders when it does not — a new value from a backend matrix update
 * still renders something readable, never a blank or a crash.
 */
export function humanizeOptionValue(value: string): string {
  const words = value
    .split(/[\s_-]+/)
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  return words.join(' ')
}
