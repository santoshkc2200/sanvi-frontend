/**
 * Re-export of the shared contrast engine (TASK-027 step 6). The math and
 * the pair list live in `@sanvi/design-tokens` so the live draft checker
 * here, the publish gate, and the `check:contrast` harness all run the same
 * rules; this module keeps the console's import paths stable. The backend
 * mirror is `crates/contexts/theming/src/domain/{tokens,contrast}.rs`.
 */
export {
  CONTRAST_PAIRS,
  checkContrast,
  contrastRatio,
  parseHexColor,
  relativeLuminance,
} from '@sanvi/design-tokens'
export type { ContrastPairConfig, ContrastViolation } from '@sanvi/design-tokens'
