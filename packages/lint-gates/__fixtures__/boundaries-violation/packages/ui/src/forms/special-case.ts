// Violation fixture — deliberately wrong. The matrix is the only source; a
// platform special case in a form path must fail check:boundaries.
export const PLATFORMSpecial = 'google_ads'

export function isSupportedObjective(objective: string): boolean {
  return objective === 'sales' || objective === app_promotion
}

const app_promotion = 'app_promotion'
