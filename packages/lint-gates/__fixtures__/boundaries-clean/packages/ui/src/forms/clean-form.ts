// Clean form-path file: option values are reached through data, never spelled.
export function firstOptionLabel(options: string[], labels: Record<string, string>): string {
  const value = options[0]
  if (value === undefined) return ''
  return labels[value] ?? value
}
