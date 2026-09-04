import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDefaultState,
  normalizeFocusCompetencyIds,
  computeGrowthPath,
  resetCycleForNewScale,
  migrateState,
} from '../app/career/career-core.mjs'
import { competencyKnowledge } from '../app/career/competency-knowledge.mjs'

function idea(competencyIds, overrides = {}) {
  return { id: 'idea-1', competencyIds, behaviorRefs: [], impact: '', evidence: '', ...overrides }
}

function win(competencyIds, overrides = {}) {
  return { id: 'win-1', competencyIds, behaviorRefs: [], impact: 'Grew conversion by 12%', evidence: 'Dashboard link', ...overrides }
}

test('normalizeFocusCompetencyIds returns an empty array for non-array input', () => {
  assert.deepEqual(normalizeFocusCompetencyIds(null), [])
  assert.deepEqual(normalizeFocusCompetencyIds(undefined), [])
  assert.deepEqual(normalizeFocusCompetencyIds('not an array'), [])
})

test('normalizeFocusCompetencyIds strips empty/non-string entries', () => {
  const result = normalizeFocusCompetencyIds(['analytics', '', null, 42, 'web-product'])
  assert.deepEqual(result, ['analytics', 'web-product'])
})

test('normalizeFocusCompetencyIds deduplicates', () => {
  const result = normalizeFocusCompetencyIds(['analytics', 'analytics', 'web-product'])
  assert.deepEqual(result, ['analytics', 'web-product'])
})

test('normalizeFocusCompetencyIds caps at 3', () => {
  const result = normalizeFocusCompetencyIds(['a', 'b', 'c', 'd', 'e'])
  assert.equal(result.length, 3)
  assert.deepEqual(result, ['a', 'b', 'c'])
})

test('computeGrowthPath with no focus behaves exactly as before (backward compatible)', () => {
  const state = { profile: { currentLevel: 'specialist' }, ideas: [], wins: [] }
  const path = computeGrowthPath(state, competencyKnowledge)
  assert.equal(path.isFocused, false)
  assert.equal(path.underdocumented.length, 3)
})

test('computeGrowthPath scopes underdocumented to the focus set when focus is valid', () => {
  const state = { profile: { currentLevel: 'specialist' }, ideas: [], wins: [] }
  const path = computeGrowthPath(state, competencyKnowledge, ['analytics', 'web-product'])
  assert.equal(path.isFocused, true)
  assert.equal(path.underdocumented.length, 2)
  assert.deepEqual(new Set(path.underdocumented.map((item) => item.id)), new Set(['analytics', 'web-product']))
})

test('computeGrowthPath scopes directions to the focus set when focus is valid', () => {
  const state = { profile: { currentLevel: 'specialist' }, ideas: [], wins: [] }
  const path = computeGrowthPath(state, competencyKnowledge, ['analytics'])
  assert.equal(path.directions.length, 1)
  assert.equal(path.directions[0].competencyId, 'analytics')
})

test('computeGrowthPath does not hide strongSignals outside the focus set', () => {
  const state = {
    profile: { currentLevel: 'specialist' },
    ideas: [idea(['strategic-thinking'])],
    wins: [win(['strategic-thinking'])],
  }
  // Focus is on analytics, but a real signal on strategic-thinking exists —
  // it should still show up as a strong signal, not be hidden by focus.
  const path = computeGrowthPath(state, competencyKnowledge, ['analytics'])
  assert.ok(path.strongSignals.some((item) => item.id === 'strategic-thinking'))
})

test('computeGrowthPath treats focus ids that do not exist in the active scale as no focus', () => {
  const state = { profile: { currentLevel: 'specialist' }, ideas: [], wins: [] }
  const path = computeGrowthPath(state, competencyKnowledge, ['nonexistent-competency-id'])
  assert.equal(path.isFocused, false)
  assert.equal(path.underdocumented.length, 3)
})

test('computeGrowthPath underdocumented only lists focus competencies with zero evidence', () => {
  const state = {
    profile: { currentLevel: 'specialist' },
    ideas: [idea(['analytics'])],
    wins: [],
  }
  const path = computeGrowthPath(state, competencyKnowledge, ['analytics', 'web-product'])
  assert.deepEqual(path.underdocumented.map((item) => item.id), ['web-product'])
})

test('resetCycleForNewScale clears focusCompetencyIds along with the rest of the cycle', () => {
  const before = createDefaultState()
  before.focusCompetencyIds = ['analytics', 'web-product']
  const after = resetCycleForNewScale(before, null)
  assert.deepEqual(after.focusCompetencyIds, [])
})

test('migrateState preserves a previously saved focus selection', () => {
  const saved = { ...createDefaultState(), focusCompetencyIds: ['analytics', 'strategic-thinking'] }
  const migrated = migrateState(saved, createDefaultState())
  assert.deepEqual(migrated.focusCompetencyIds, ['analytics', 'strategic-thinking'])
})

test('migrateState defaults focusCompetencyIds to an empty array for pre-v33 saved state', () => {
  const legacy = { ...createDefaultState() }
  delete legacy.focusCompetencyIds
  const migrated = migrateState(legacy, createDefaultState())
  assert.deepEqual(migrated.focusCompetencyIds, [])
})

test('migrateState sanitizes a malformed focusCompetencyIds field instead of throwing', () => {
  const corrupted = { ...createDefaultState(), focusCompetencyIds: 'not-an-array' }
  const migrated = migrateState(corrupted, createDefaultState())
  assert.deepEqual(migrated.focusCompetencyIds, [])
})
