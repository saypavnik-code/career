import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDefaultState,
  isEscadaState,
  migrateState,
} from '../app/career/career-core.mjs'

// Fable roadmap — Patch A (P0-1): guarded import + hydration safety.

test('isEscadaState accepts a valid default state', () => {
  assert.equal(isEscadaState(createDefaultState()), true)
})

test('isEscadaState rejects an empty object', () => {
  assert.equal(isEscadaState({}), false)
})

test('isEscadaState rejects an array', () => {
  assert.equal(isEscadaState([]), false)
})

test('isEscadaState rejects an object with the wrong shape', () => {
  assert.equal(isEscadaState({ version: 9 }), false)
})

test('migrateState({}) returns the fallback unchanged rather than merging garbage', () => {
  const fallback = createDefaultState()
  fallback.profile.name = 'Павел'
  fallback.ideas = [{ id: 'idea-1' }]
  const migrated = migrateState({}, fallback)
  assert.deepEqual(migrated, fallback)
})

test('migrateState([]) returns the fallback unchanged', () => {
  const fallback = createDefaultState()
  fallback.profile.name = 'Павел'
  const migrated = migrateState([], fallback)
  assert.deepEqual(migrated, fallback)
})

test('migrateState({version: 9}) with no ideas/wins arrays returns the fallback unchanged', () => {
  const fallback = createDefaultState()
  fallback.profile.name = 'Павел'
  const migrated = migrateState({ version: 9 }, fallback)
  assert.deepEqual(migrated, fallback)
})

test('migrateState still accepts a valid current-shape state', () => {
  const valid = { ...createDefaultState(), ideas: [{ id: 'idea-1' }], wins: [] }
  const migrated = migrateState(valid, createDefaultState())
  assert.equal(migrated.ideas.length, 1)
})

test('migrateState still accepts a legacy v1-v4 shape (tasks/profile, no ideas array)', () => {
  const legacy = { profile: { currentLevel: 'senior' }, tasks: [{ id: 't1', title: 'Old task' }] }
  const migrated = migrateState(legacy, createDefaultState())
  assert.equal(migrated.onboardingComplete, true)
  assert.equal(migrated.ideas.length, 1)
})
