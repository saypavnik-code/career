import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inferLevelSignal,
  migrateState,
  createDefaultState,
  demoState,
  promoteIdeaToWin,
  captureToIdea,
  captureToWinDraft,
  noteToIdea,
} from '../app/career/career-core.mjs'

// Fable roadmap — Patch C, UI half (P0-3 provenance): accept-chip for
// AI-suggested career level signals.
//
// Root bug this closes: saveIdea/saveWin previously recomputed levelSignal
// unconditionally on every save, silently discarding any confirmation the
// person had given. There was also no field anywhere distinguishing "the
// person confirmed this" from "the algorithm guessed this".

function idea(overrides = {}) {
  return {
    id: 'idea-1', title: '', details: '', nextStep: '', status: 'concept',
    competencyIds: [], levelSignal: 'specialist', levelReason: '',
    levelSignalConfirmed: false, behaviorRefs: [], workItems: [], notes: [],
    evidenceNotes: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  }
}

// This mirrors the `stillMatches` guard added to saveIdea/saveWin in
// CareerDashboard.tsx — re-implemented here so the invariant is covered by
// a fast unit test independent of React rendering.
function resolveLevelSignalOnSave(draft, fallbackLevel) {
  const text = [draft.title, draft.details, draft.nextStep].join(' ')
  const inferred = inferLevelSignal(text, fallbackLevel)
  const stillMatches = draft.levelSignalConfirmed && draft.levelSignal === inferred.level
  return {
    levelSignal: stillMatches ? draft.levelSignal : inferred.level,
    levelReason: stillMatches ? draft.levelReason : inferred.reason,
    levelSignalConfirmed: Boolean(stillMatches),
  }
}

test('a confirmed level signal survives save when the text still supports it', () => {
  const draft = idea({
    title: 'Провели эксперимент с гипотезой роста',
    levelSignal: 'senior',
    levelReason: 'Пользователь подтвердил уровень senior',
    levelSignalConfirmed: true,
  })
  const result = resolveLevelSignalOnSave(draft, 'specialist')
  assert.equal(result.levelSignal, 'senior')
  assert.equal(result.levelSignalConfirmed, true)
  assert.equal(result.levelReason, 'Пользователь подтвердил уровень senior')
})

test('a confirmed level signal resets when later edits no longer support it', () => {
  const draft = idea({
    title: 'Купил хлеб и молоко в магазине по пути домой',
    levelSignal: 'senior',
    levelReason: 'Пользователь подтвердил уровень senior (по старому тексту)',
    levelSignalConfirmed: true,
  })
  // Profile fallback is 'specialist', not 'senior' — this isolates the
  // reset from the coincidental case where the neutral-text fallback would
  // otherwise happen to equal the stale confirmed level.
  const result = resolveLevelSignalOnSave(draft, 'specialist')
  assert.equal(result.levelSignalConfirmed, false)
  assert.equal(result.levelSignal, 'specialist') // profile fallback, not the stale confirmed value
  assert.notEqual(result.levelReason, 'Пользователь подтвердил уровень senior (по старому тексту)')
})

test('an unconfirmed level signal is always recomputed fresh on save', () => {
  const draft = idea({
    title: 'Провели эксперимент с гипотезой роста',
    levelSignal: 'specialist', // stale/wrong guess, never confirmed
    levelSignalConfirmed: false,
  })
  const result = resolveLevelSignalOnSave(draft, 'specialist')
  assert.equal(result.levelSignal, 'senior')
  assert.equal(result.levelSignalConfirmed, false)
})

test('promoteIdeaToWin carries a confirmed level signal through to the win', () => {
  const confirmedIdea = idea({ levelSignal: 'senior', levelSignalConfirmed: true })
  const win = promoteIdeaToWin(confirmedIdea)
  assert.equal(win.levelSignalConfirmed, true)
  assert.equal(win.levelSignal, 'senior')
})

test('promoteIdeaToWin does not fabricate a confirmation for an unconfirmed idea', () => {
  const unconfirmedIdea = idea({ levelSignal: 'senior', levelSignalConfirmed: false })
  const win = promoteIdeaToWin(unconfirmedIdea)
  assert.equal(win.levelSignalConfirmed, false)
})

test('migrateState defaults levelSignalConfirmed to false for a single legacy idea missing the field', () => {
  const legacyState = {
    ...createDefaultState(),
    ideas: [{ id: 'old-idea', title: 'Old', levelSignal: 'senior' }],
  }
  const migrated = migrateState(legacyState, createDefaultState())
  assert.equal(migrated.ideas[0].levelSignalConfirmed, false)
})

test('migrateState defaults levelSignalConfirmed to false for imported ideas/wins predating this field', () => {
  const legacyState = {
    ...createDefaultState(),
    ideas: [{
      id: 'old-idea', title: 'Old', details: '', nextStep: '', status: 'concept',
      competencyIds: [], levelSignal: 'senior', levelReason: 'old reason',
      behaviorRefs: [], workItems: [], notes: [], evidenceNotes: [],
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    }],
    wins: [{
      id: 'old-win', title: 'Old win', impact: '', evidence: '', sourceContext: '',
      metrics: '', confirmedBy: '', competencyIds: [], behaviorRefs: [],
      levelSignal: 'senior', sourceIdeaId: null, workSummary: [], noteSummary: [],
      date: '2024-01-01', reportReady: true, createdAt: '2024-01-01',
    }],
  }
  const migrated = migrateState(legacyState, createDefaultState())
  assert.equal(migrated.ideas[0].levelSignalConfirmed, false)
  assert.equal(migrated.wins[0].levelSignalConfirmed, false)
})

test('demoState fixtures have levelSignalConfirmed explicitly set to false, not undefined', () => {
  const state = demoState()
  assert.ok(state.ideas.length > 0)
  assert.ok(state.wins.length > 0)
  for (const item of state.ideas) assert.equal(item.levelSignalConfirmed, false)
  for (const item of state.wins) assert.equal(item.levelSignalConfirmed, false)
})

test('captureToIdea, captureToWinDraft, and noteToIdea all default levelSignalConfirmed to false', () => {
  const fromCapture = captureToIdea({ text: 'Быстрая мысль' }, 'specialist')
  assert.equal(fromCapture.levelSignalConfirmed, false)

  const winDraft = captureToWinDraft({ text: 'Быстрая мысль' })
  assert.equal(winDraft.levelSignalConfirmed, false)

  const { idea: fromNote } = noteToIdea({ title: 'Заметка', body: 'Текст заметки' }, 'specialist')
  assert.equal(fromNote.levelSignalConfirmed, false)
})
