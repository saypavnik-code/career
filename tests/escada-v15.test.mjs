import test from 'node:test'
import assert from 'node:assert/strict'
import { retrieveCriteria, validateAiRequest } from '../app/career/ai-contract.mjs'
import { buildLocalGuidance } from '../app/career/local-guidance.mjs'

// Fable roadmap — Patch B (P0-2): retrieval admission filter + provenance.

test('golden: an artifact with no topical overlap and no explicit competency yields empty strengths', () => {
  // Deliberately inert text — no substring of any built-in competency
  // keyword appears anywhere in it, and no competencyIds are supplied.
  const result = buildLocalGuidance('idea_review', {
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Купил хлеб и молоко в магазине по пути домой' },
  })
  assert.equal(result.strengths.length, 0)
})

test('retrieveCriteria admits a criterion with zero overlap only via explicit competency match', () => {
  const payload = validateAiRequest({
    action: 'idea_review',
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Купил хлеб и молоко в магазине по пути домой', competencyIds: ['analytics'] },
  })
  const retrieval = retrieveCriteria(payload)
  assert.ok(retrieval.matches.length > 0)
  assert.ok(retrieval.matches.every((item) => item.overlap > 0 || item.explicit))
  assert.ok(retrieval.matches.some((item) => item.explicit === true))
})

test('retrieveCriteria rejects a current-level criterion that has neither overlap nor explicit match', () => {
  const payload = validateAiRequest({
    action: 'idea_review',
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Купил хлеб и молоко в магазине по пути домой' },
  })
  const retrieval = retrieveCriteria(payload)
  // No matches at all -> falls back to context filler, which must be marked
  // as such (overlap 0, explicit false) rather than silently admitted.
  assert.ok(retrieval.matches.every((item) => item.overlap === 0 && item.explicit === false))
})

test('retrieval.criteria stays a backward-compatible bare-criterion array', () => {
  const payload = validateAiRequest({
    action: 'idea_review',
    profile: { currentLevel: 'senior', role: 'Manager' },
    artifact: { title: 'Анализ данных', competencyIds: ['analytics'] },
  })
  const retrieval = retrieveCriteria(payload)
  assert.ok(retrieval.criteria.length > 0)
  assert.equal(retrieval.criteria.length, retrieval.matches.length)
  for (let i = 0; i < retrieval.criteria.length; i += 1) {
    assert.equal(retrieval.criteria[i], retrieval.matches[i].criterion)
  }
})

test('an artifact with real topical overlap still produces strengths', () => {
  const result = buildLocalGuidance('idea_review', {
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Улучшить конверсию воронки и вырастить результат кампании' },
  })
  assert.ok(result.strengths.length > 0)
})
