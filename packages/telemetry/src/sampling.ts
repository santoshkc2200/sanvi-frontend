/**
 * Per-page-load sampling, decided once at init: a page either participates
 * for its whole lifetime or never starts a source. Sampling configured here
 * (TASK-019), not bolted on at the endpoint later.
 */
export function shouldSample(sampleRate: number, rng: number): boolean {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return false
  if (sampleRate >= 1) return true
  return rng < sampleRate
}
