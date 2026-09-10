import type { BudgetPeriod } from '@sanvi/api-client'

/**
 * The contract's budget-period values, named once.
 *
 * This file sits outside the lint gate's "form path" set (no
 * `advertising`/`forms` segment — see `check-platform-literals.mjs`) because
 * the gate rightly bans spelling matrix-shaped values as literals inside
 * advertising code: the screens import these names instead of quoting the
 * values, and a period the backend stops sending fails to compile here
 * rather than silently comparing false.
 */
export const BUDGET_PERIOD_DAILY: BudgetPeriod = 'daily'
export const BUDGET_PERIOD_MONTHLY: BudgetPeriod = 'monthly'

export const BUDGET_PERIODS: readonly BudgetPeriod[] = [BUDGET_PERIOD_MONTHLY, BUDGET_PERIOD_DAILY]
