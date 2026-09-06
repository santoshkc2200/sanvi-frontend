import { afterEach, describe, expect, it } from 'vitest'
import {
  builderAutosaveKey,
  builderSteps,
  clearBuilderAutosave,
  draftFromCampaign,
  draftToCreatePayload,
  draftToPatchPayload,
  loadBuilderAutosave,
  saveBuilderAutosave,
  seedAdGroupPayload,
  validateStep,
  type BuilderAutosave,
} from '../src/forms/builder'
import { campaignFormSchema, emptyDraft } from '../src/forms/schema'
import { validateDraft } from '../src/forms/validate'
import { fixturePlatformByKey } from './fixtures/advertising/index'

const GOOGLE = fixturePlatformByKey('google_ads')!.capability_matrix
const META = fixturePlatformByKey('meta')!.capability_matrix
const ASYMMETRIC = fixturePlatformByKey('asymmetric_demo')!.capability_matrix

describe('builderSteps (matrix-driven stepper composition)', () => {
  it('offers the full step set for a matrix with targeting', () => {
    expect(builderSteps(campaignFormSchema(GOOGLE))).toEqual([
      'basics',
      'targeting',
      'budget',
      'creatives',
      'review',
    ])
  })

  it('drops the targeting step for a platform with no targeting dimensions', () => {
    const bare = { ...ASYMMETRIC, targeting_dimensions: [] }
    expect(builderSteps(campaignFormSchema(bare, 'bare'))).not.toContain('targeting')
  })

  it('drops the targeting step in edit mode', () => {
    expect(builderSteps(campaignFormSchema(GOOGLE), { mode: 'edit' })).not.toContain('targeting')
  })
})

describe('validateStep (per-step gating from whole-form rules)', () => {
  const schema = campaignFormSchema(GOOGLE, 'step-google')

  it('accepts an empty draft on the first step only for what that step owns', () => {
    const draft = emptyDraft(schema)
    // Basics owns name + objective: both missing here.
    expect(validateStep(schema, draft, 'basics').map((issue) => issue.path)).toEqual([
      'name',
      'objective',
    ])
    // Budget owns the budget fields only.
    expect(validateStep(schema, draft, 'budget').map((issue) => issue.path)).toEqual([
      'budget.kind',
      'budget.amount.amount_minor',
    ])
    // Targeting and creatives own nothing that can be wrong.
    expect(validateStep(schema, draft, 'targeting')).toEqual([])
    expect(validateStep(schema, draft, 'creatives')).toEqual([])
  })

  it('re-validates everything on review regardless of step order', () => {
    const draft = emptyDraft(schema)
    expect(validateStep(schema, draft, 'review')).toEqual(validateDraft(schema, draft, 'JPY'))
  })

  it('a draft rejected by a step is rejected by the whole form (validation parity)', () => {
    const draft = emptyDraft(schema)
    draft.budgetKind = 'daily'
    draft.budgetAmountMinor = '1'
    const stepIssues = validateStep(schema, draft, 'budget', 'JPY')
    const allIssues = validateDraft(schema, draft, 'JPY')
    for (const issue of stepIssues) {
      expect(allIssues.some((candidate) => candidate.path === issue.path)).toBe(true)
    }
  })
})

describe('payload builders (draft → contract shapes)', () => {
  const schema = campaignFormSchema(GOOGLE, 'payload-google')
  const draft = emptyDraft(schema)
  draft.name = 'Summer sale'
  draft.objective = GOOGLE.objectives[0]!
  draft.budgetKind = 'daily'
  draft.budgetAmountMinor = '1000'
  draft.targeting = [GOOGLE.targeting_dimensions[0]!]

  it('builds a create payload with the ad account currency and schedule', () => {
    const payload = draftToCreatePayload(draft, {
      connectionId: 'c1',
      currency: 'JPY',
      schedule: { startsAt: null, endsAt: null },
    })
    expect(payload).toEqual({
      name: 'Summer sale',
      objective: GOOGLE.objectives[0],
      connection_id: 'c1',
      budget: { kind: 'daily', amount: { amount_minor: 1000, currency: 'JPY' } },
      schedule: null,
    })
  })

  it('carries a schedule only when a bound is set', () => {
    const payload = draftToCreatePayload(draft, {
      connectionId: 'c1',
      currency: 'JPY',
      schedule: { startsAt: '2026-09-01T00:00', endsAt: null },
    })
    expect(payload.schedule).toEqual({ starts_at: '2026-09-01T00:00', ends_at: null })
  })

  it('seeds one ad group carrying the targeting selection, no invented bid', () => {
    const seed = seedAdGroupPayload(draft, 'Ad group 1')
    expect(seed).toBeDefined()
    expect(seed!.name).toBe('Ad group 1')
    expect(seed!.bid).toEqual({ strategy: 'manual', maximum_bid: null })
    expect(Object.keys(seed!.targeting.dimensions)).toEqual([GOOGLE.targeting_dimensions[0]])
  })

  it('seeds nothing when no targeting was selected', () => {
    const bare = { ...draft, targeting: [] }
    expect(seedAdGroupPayload(bare, 'Ad group 1')).toBeUndefined()
  })

  it('builds a full-snapshot patch payload', () => {
    const patch = draftToPatchPayload(draft, {
      currency: 'JPY',
      schedule: { startsAt: null, endsAt: '2026-10-01T00:00' },
    })
    expect(patch.budget).toEqual({ kind: 'daily', amount: { amount_minor: 1000, currency: 'JPY' } })
    expect(patch.schedule).toEqual({ starts_at: null, ends_at: '2026-10-01T00:00' })
  })
})

describe('draftFromCampaign (edit-mode restore)', () => {
  it('restores values from a stored campaign and tolerates a foreign objective', () => {
    const schema = campaignFormSchema(GOOGLE, 'restore-google')
    const built = draftFromCampaign(
      {
        name: 'Retargeting',
        objective: 'not_a_real_objective',
        budget: { kind: 'lifetime', amount: { amount_minor: 5000, currency: 'JPY' } },
        schedule: { starts_at: '2026-09-01T00:00Z', ends_at: null },
      },
      schema,
    )
    expect(built.draft.name).toBe('Retargeting')
    // An objective the current matrix does not offer comes back empty — the
    // form renders matrix options, and a foreign value must not sneak in.
    expect(built.draft.objective).toBe('')
    expect(built.draft.budgetKind).toBe('lifetime')
    expect(built.draft.budgetAmountMinor).toBe('5000')
    expect(built.schedule.startsAt).toBe('2026-09-01T00:00Z')
  })
})

describe('autosave (a refresh resumes with every value intact)', () => {
  // A minimal Storage stand-in — jsdom's localStorage works too, but a
  // private map keeps the tests hermetic.
  function memoryStorage(): Storage {
    const map = new Map<string, string>()
    return {
      get length() {
        return map.size
      },
      clear: () => map.clear(),
      getItem: (key) => map.get(key) ?? null,
      key: (index) => [...map.keys()][index] ?? null,
      removeItem: (key) => void map.delete(key),
      setItem: (key, value) => void map.set(key, value),
    }
  }

  const schema = campaignFormSchema(META, 'autosave-meta')
  const envelope = {
    matrixVersion: schema.matrixVersion,
    step: 'budget' as const,
    draft: (() => {
      const draft = emptyDraft(schema)
      draft.name = 'Half-typed'
      draft.objective = META.objectives[0]!
      return draft
    })(),
    schedule: { startsAt: null, endsAt: null },
  }

  afterEach(() => {
    // Nothing persistent — the stand-in above is per-test.
  })

  it('round-trips a draft and resumes on the saved step', () => {
    const storage = memoryStorage()
    const key = builderAutosaveKey('new', 'conn-1')
    saveBuilderAutosave(storage, key, envelope)
    const restored = loadBuilderAutosave(storage, key, schema.matrixVersion)
    expect(restored?.draft.name).toBe('Half-typed')
    expect(restored?.step).toBe('budget')
    expect(restored?.draft.objective).toBe(META.objectives[0])
  })

  it('discards a draft entered against a different matrix version', () => {
    const storage = memoryStorage()
    const key = builderAutosaveKey('new', 'conn-1')
    saveBuilderAutosave(storage, key, envelope)
    expect(loadBuilderAutosave(storage, key, '2099-01-01')).toBeUndefined()
  })

  it('discard on clear, and survives corrupt envelopes', () => {
    const storage = memoryStorage()
    const key = builderAutosaveKey('edit', 'camp-1')
    saveBuilderAutosave(storage, key, envelope)
    clearBuilderAutosave(storage, key)
    expect(loadBuilderAutosave(storage, key, schema.matrixVersion)).toBeUndefined()
    storage.setItem(key, '{not json')
    expect(loadBuilderAutosave(storage, key, schema.matrixVersion)).toBeUndefined()
  })

  it('never persists across owners (connection vs campaign)', () => {
    const storage = memoryStorage()
    saveBuilderAutosave(storage, builderAutosaveKey('new', 'conn-1'), envelope)
    expect(
      loadBuilderAutosave(storage, builderAutosaveKey('new', 'conn-2'), schema.matrixVersion),
    ).toBeUndefined()
    expect(
      loadBuilderAutosave(storage, builderAutosaveKey('edit', 'conn-1'), schema.matrixVersion),
    ).toBeUndefined()
  })

  it('a saved envelope is loadable as a BuilderAutosave', () => {
    const storage = memoryStorage()
    const key = builderAutosaveKey('new', 'conn-3')
    saveBuilderAutosave(storage, key, envelope)
    const restored = loadBuilderAutosave(storage, key, schema.matrixVersion)
    expect(restored?.version).toBe(1 satisfies BuilderAutosave['version'])
    expect(typeof restored?.savedAt).toBe('string')
  })
})
