import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAndValidateAiResponse, retrieveCriteria, validateAiRequest } from '../app/career/ai-contract.mjs'

// Fable roadmap -- Patch G (P1-1): AI response validation.
//
// Confirmed real gap before this patch: parseAndValidateAiResponse existed
// fully implemented in ai-contract.mjs (citation-id allowlisting, per-field
// length clamps, action-specific required-field checks) but was NEVER
// called from CareerDashboard.tsx -- an external AI endpoint's raw response
// flowed straight into the UI unvalidated. requestAi now calls it.
//
// CareerDashboard.tsx has no React test harness (confirmed, consistent with
// the rest of this project). These tests exercise the real
// parseAndValidateAiResponse/retrieveCriteria functions directly against
// the exact malformed-response scenarios requestAi now guards against, plus
// a standalone test of the nonEmptyFields merge helper used for applying a
// partial AI rewrite without blanking existing draft content.

function ideaPayload() {
  return validateAiRequest({
    action: 'idea_review',
    profile: { currentLevel: 'senior', role: 'Manager' },
    artifact: { title: 'Улучшить конверсию воронки', competencyIds: ['analytics'] },
  })
}

test('parseAndValidateAiResponse strips a strength citing a criterion ID that does not exist in retrieval', () => {
  const payload = ideaPayload()
  const retrieval = retrieveCriteria(payload)
  const maliciousResponse = {
    headline: 'Test',
    strengths: [{ text: 'Fabricated strength', criterionId: 'fake-criterion-id-that-does-not-exist' }],
    stretch: [],
    evidence: [],
    nextStep: 'Do something',
    caveat: 'test',
  }
  const validated = parseAndValidateAiResponse(maliciousResponse, retrieval, 'idea_review')
  assert.equal(validated.strengths.length, 0)
})

test('parseAndValidateAiResponse keeps a strength citing a real, allowed criterion ID', () => {
  const payload = ideaPayload()
  const retrieval = retrieveCriteria(payload)
  const realId = retrieval.criteria[0].id
  const response = {
    headline: 'Test',
    strengths: [{ text: 'Real strength', criterionId: realId }],
    stretch: [],
    evidence: [],
    nextStep: 'Do something',
    caveat: 'test',
  }
  const validated = parseAndValidateAiResponse(response, retrieval, 'idea_review')
  assert.equal(validated.strengths.length, 1)
  assert.equal(validated.strengths[0].criterionId, realId)
})

test('parseAndValidateAiResponse throws AI_REWRITE_MISSING for win_rewrite with no rewrite object, instead of crashing on missing fields downstream', () => {
  const payload = validateAiRequest({
    action: 'win_rewrite',
    profile: { currentLevel: 'senior' },
    artifact: { title: 'Test win' },
  })
  const retrieval = retrieveCriteria(payload)
  assert.throws(
    () => parseAndValidateAiResponse({ headline: 'x', strengths: [], stretch: [], evidence: [] }, retrieval, 'win_rewrite'),
    /AI_REWRITE_MISSING/,
  )
})

test('parseAndValidateAiResponse normalizes a partial rewrite (missing impact/evidence) to empty strings, not undefined', () => {
  const payload = validateAiRequest({
    action: 'win_rewrite',
    profile: { currentLevel: 'senior' },
    artifact: { title: 'Test win' },
  })
  const retrieval = retrieveCriteria(payload)
  const response = { headline: 'x', strengths: [], stretch: [], evidence: [], rewrite: { title: 'New title' } }
  const validated = parseAndValidateAiResponse(response, retrieval, 'win_rewrite')
  assert.equal(validated.rewrite.title, 'New title')
  assert.equal(validated.rewrite.impact, '')
  assert.equal(validated.rewrite.evidence, '')
})

// Mirrors the nonEmptyFields helper added to CareerDashboard.tsx for
// applying a rewrite without blanking existing draft content.
function nonEmptyFields(source) {
  const result = {}
  if (!source) return result
  for (const key of Object.keys(source)) {
    const value = source[key]
    if (typeof value === 'string' ? value.trim() : value != null) result[key] = value
  }
  return result
}

test('nonEmptyFields merge preserves existing draft content when the AI rewrite only supplies a title', () => {
  // Regression guard for the specific bug: a plain object spread
  // (`{...draft, ...rewrite}`) would overwrite impact/evidence with empty
  // strings whenever the rewrite only had a title, since
  // parseAndValidateAiResponse normalizes missing fields to '' rather than
  // omitting them.
  const draft = { title: 'Original title', impact: 'Original impact', evidence: 'Original evidence' }
  const partialRewrite = { title: 'New title', impact: '', evidence: '' }
  const merged = { ...draft, ...nonEmptyFields(partialRewrite) }
  assert.equal(merged.title, 'New title')
  assert.equal(merged.impact, 'Original impact')
  assert.equal(merged.evidence, 'Original evidence')
})

test('nonEmptyFields merge applies all fields when the rewrite is fully populated', () => {
  const draft = { title: 'Old', impact: 'Old', evidence: 'Old' }
  const fullRewrite = { title: 'New title', impact: 'New impact', evidence: 'New evidence' }
  const merged = { ...draft, ...nonEmptyFields(fullRewrite) }
  assert.deepEqual(merged, fullRewrite)
})
