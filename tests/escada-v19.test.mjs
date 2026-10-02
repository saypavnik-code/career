import test from 'node:test'
import assert from 'node:assert/strict'
import { noteToIdea, deriveNoteTitle, inferLevelSignal } from '../app/career/career-core.mjs'

// Fable roadmap -- Patch E (P1-5, part of P1-6): editor identity / stale
// snapshot bugs.
//
// CareerDashboard.tsx has no React test harness (confirmed, consistent with
// the rest of this project's test files). These tests exercise the actual
// pure logic (noteToIdea, deriveNoteTitle) the way convertNoteToIdea now
// calls them, to lock down the specific bug that was reproduced concretely
// before this patch: editing a note's text, then clicking "Это идея!"
// without first clicking "Сохранить", silently used the pre-edit text
// because the note object was a stale snapshot passed by reference rather
// than looked up fresh (or, for unsaved edits, passed through explicitly).

function buildEffectiveNote(note, pendingText) {
  // Mirrors convertNoteToIdea's effectiveNote construction in
  // CareerDashboard.tsx exactly.
  const effectiveText = pendingText && pendingText.trim() ? pendingText : note.rawText
  const derived = pendingText && pendingText.trim() ? deriveNoteTitle(effectiveText) : { title: note.title, body: note.body }
  return { ...note, title: derived.title || effectiveText.slice(0, 40), body: derived.body, rawText: effectiveText }
}

function baseNote(overrides = {}) {
  return {
    id: 'note-1',
    title: 'Купил хлеб',
    body: 'Купил хлеб',
    rawText: 'Купил хлеб',
    convertedIdeaId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

test('converting a note with an unsaved pending edit uses the NEW text, not the stale saved text', () => {
  const note = baseNote()
  const pendingText = 'Провели эксперимент с гипотезой роста конверсии'
  const effectiveNote = buildEffectiveNote(note, pendingText)
  const result = noteToIdea(effectiveNote, 'specialist')
  assert.ok(result.idea.details.includes('эксперимент') || result.idea.details.includes('конверсии'))
  assert.equal(result.idea.details.includes('Купил хлеб'), false)
})

test('converting a note with no pending edit (already saved) uses the current saved text', () => {
  const note = baseNote({ rawText: 'Провели эксперимент с гипотезой роста', title: 'Провели эксперимент', body: 'Провели эксперимент с гипотезой роста' })
  const effectiveNote = buildEffectiveNote(note, undefined)
  const result = noteToIdea(effectiveNote, 'specialist')
  assert.ok(result.idea.details.includes('эксперимент'))
})

test('the level signal on the resulting idea reflects the pending text, not the stale one', () => {
  // Regression guard for the concrete bug: before the fix, the level signal
  // (and therefore the whole "career signal" shown to the person) was
  // computed from stale text whenever an edit hadn't been explicitly saved
  // before clicking convert.
  const note = baseNote({ rawText: 'Купил хлеб и молоко' }) // no career signal at all
  const pendingText = 'Разработали стратегию выхода на новый рынок для всей команды'
  const effectiveNote = buildEffectiveNote(note, pendingText)
  const result = noteToIdea(effectiveNote, 'specialist')
  // The pending text has strong "lead"-level signals (стратегия, рынок,
  // команда); the stale text has none. If the bug were still present, this
  // would incorrectly compute a signal from "Купил хлеб и молоко".
  assert.equal(result.idea.levelSignal, 'lead')
})

test('sanity: the stale-text path would have produced a different, wrong signal (documents the bug this patch fixes)', () => {
  const note = baseNote({ rawText: 'Купил хлеб и молоко' })
  const staleSignal = inferLevelSignal(note.rawText, 'specialist')
  assert.equal(staleSignal.level, 'specialist') // no signal in the stale text at all
  // Contrast with the pending text's actual signal, confirmed in the test above.
})
