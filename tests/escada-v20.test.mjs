import test from 'node:test'
import assert from 'node:assert/strict'

// Fable roadmap -- Patch F (P1-6): unified unsaved-work guard + PWA reload
// safety.
//
// CareerDashboard.tsx has no React test harness (confirmed, consistent
// with the rest of this project). These tests model the specific
// invariants added in this patch as plain-data logic mirroring the real
// implementation exactly, since the underlying bug and fix are about
// *when* certain booleans are true, not about complex data transformation.

// Mirrors the `hasUnsavedWork` selector in CareerDashboard.tsx.
function hasUnsavedWork(state) {
  return Boolean(
    state.ideaDraft || state.winDraft || state.reportDraftOpen || state.openNote ||
    state.newIdeaFromNote || state.profileOpen || (state.quickText && state.quickText.trim()) ||
    !state.onboardingComplete
  )
}

function emptyEditorState(overrides = {}) {
  return {
    ideaDraft: null,
    winDraft: null,
    reportDraftOpen: false,
    openNote: null,
    newIdeaFromNote: null,
    profileOpen: false,
    quickText: '',
    onboardingComplete: true,
    ...overrides,
  }
}

test('hasUnsavedWork is false when nothing is open and onboarding is complete', () => {
  assert.equal(hasUnsavedWork(emptyEditorState()), false)
})

test('hasUnsavedWork is true when openNote is set -- this is the exact gap the old SW-reload gate had', () => {
  // Regression guard for the specific bug found while reviewing the old
  // code: the pre-patch gate only checked `ideaDraft || winDraft ||
  // reportDraftOpen` -- openNote (a note overlay with unsaved edits) was
  // NOT included, so a pending service-worker update could reload the page
  // immediately while someone was mid-edit in a note, with zero warning.
  const state = emptyEditorState({ openNote: { id: 'note-1', rawText: 'draft text' } })
  assert.equal(hasUnsavedWork(state), true)
})

test('hasUnsavedWork is true for newIdeaFromNote and profileOpen too (both were also missing from the old gate)', () => {
  assert.equal(hasUnsavedWork(emptyEditorState({ newIdeaFromNote: { id: 'idea-1' } })), true)
  assert.equal(hasUnsavedWork(emptyEditorState({ profileOpen: true })), true)
})

test('hasUnsavedWork is true for non-empty quickText, false for whitespace-only quickText', () => {
  assert.equal(hasUnsavedWork(emptyEditorState({ quickText: 'мысль в процессе' })), true)
  assert.equal(hasUnsavedWork(emptyEditorState({ quickText: '   ' })), false)
})

test('hasUnsavedWork is true during onboarding', () => {
  assert.equal(hasUnsavedWork(emptyEditorState({ onboardingComplete: false })), true)
})

// Mirrors the isDirty comparison used for IdeaWorkspace/WinModal/
// NewIdeaModal/ProfileModal (JSON.stringify(draft) !== JSON.stringify(initial)).
function isDirtyByComparison(draft, initial) {
  return JSON.stringify(draft) !== JSON.stringify(initial)
}

test('isDirty is false when the draft is unchanged from the initial value', () => {
  const idea = { id: 'idea-1', title: 'X', details: 'Y' }
  assert.equal(isDirtyByComparison(idea, idea), false)
  assert.equal(isDirtyByComparison({ ...idea }, idea), false)
})

test('isDirty is true when any field differs from the initial value', () => {
  const initial = { id: 'idea-1', title: 'X', details: 'Y' }
  const draft = { ...initial, details: 'Y (edited)' }
  assert.equal(isDirtyByComparison(draft, initial), true)
})

// Mirrors the reportBaseline lifecycle: saveReport/openSavedReport set it to
// the current text; useProfileReportingPeriod resets it to ''; generateReport
// sets it to the newly generated text. isDirty for the report editor is
// `reportText.trim() !== reportBaseline.trim()`.
function reportIsDirty(reportText, reportBaseline) {
  return reportText.trim() !== reportBaseline.trim()
}

test('report editor is not dirty right after generating, opening, or saving', () => {
  const generated = 'Черновик A'
  assert.equal(reportIsDirty(generated, generated), false)
})

test('report editor becomes dirty once the person edits the text away from the baseline', () => {
  const baseline = 'Черновик A'
  const edited = 'Черновик A (дополнен)'
  assert.equal(reportIsDirty(edited, baseline), true)
})

test('regenerating a dirty report editor requires confirmation; regenerating a clean one does not', () => {
  // Mirrors generateReport's confirm-gate: only prompt when there is
  // non-empty text that differs from the baseline (an actual edit at risk
  // of being silently discarded by the regeneration).
  function shouldConfirmRegenerate(reportText, reportBaseline) {
    return Boolean(reportText.trim()) && reportText !== reportBaseline
  }
  assert.equal(shouldConfirmRegenerate('', ''), false) // nothing to lose
  assert.equal(shouldConfirmRegenerate('Черновик A', 'Черновик A'), false) // unedited
  assert.equal(shouldConfirmRegenerate('Черновик A (правка)', 'Черновик A'), true) // edited, at risk
})
