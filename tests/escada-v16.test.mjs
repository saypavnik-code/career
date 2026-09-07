import test from 'node:test'
import assert from 'node:assert/strict'
import { inferLevelSignal, suggestBehaviorRefs } from '../app/career/career-core.mjs'

// Fable roadmap — Patch C, math-only half (P0-3): tie-break + fallback fixes.
// This patch deliberately does NOT touch the accept/confirm UX for AI
// suggestions (levelSignal/behaviorRefs are still auto-saved without a
// confirmation step) — that is a separate patch (v37).

// Genuine 3-way score tie: specialist=2 ('обнов', 'провер'),
// senior=2 ('гипотез', 'эксперимент'), lead=2 ('стратег', 'направлен').
const TIED_TEXT = 'Проверили гипотезу через эксперимент и обновили стратегию направления'

test('inferLevelSignal: on a tie, stays at the profile level rather than jumping to lead', () => {
  const result = inferLevelSignal(TIED_TEXT, 'specialist')
  assert.equal(result.level, 'specialist')
})

test('inferLevelSignal: on the same tie with a senior profile, resolves to senior (nearest tied level)', () => {
  const result = inferLevelSignal(TIED_TEXT, 'senior')
  assert.equal(result.level, 'senior')
})

test('inferLevelSignal: on the same tie with a lead profile, stays at lead', () => {
  const result = inferLevelSignal(TIED_TEXT, 'lead')
  assert.equal(result.level, 'lead')
})

test('inferLevelSignal: a clear single-level signal still wins regardless of profile level', () => {
  const result = inferLevelSignal('Проверили гипотезу и провели эксперимент с оптимизацией конверсии', 'specialist')
  assert.equal(result.level, 'senior')
})

test('inferLevelSignal: no textual signal at all still falls back to the profile level', () => {
  const result = inferLevelSignal('Купил хлеб и молоко в магазине по пути домой', 'senior')
  assert.equal(result.level, 'senior')
})

test('suggestBehaviorRefs: zero-overlap fallback ranks by score across ALL competencies, not insertion order', () => {
  const competencies = [
    { id: 'a', levels: { senior: ['Совершенно нерелевантный текст один', 'Совершенно нерелевантный текст два', 'Совершенно нерелевантный текст три'] } },
    { id: 'b', levels: { senior: ['Абсолютно другой нерелевантный текст'] } },
  ]
  const text = 'Полили цветы на подоконнике сегодня утром'
  const result = suggestBehaviorRefs(text, ['a', 'b'], competencies, 'senior', 4)
  // Both a:senior:0 and b:senior:0 carry the same small first-signal
  // tiebreak score (0.05); a:senior:1 has a strictly lower score (0) and
  // must not be preferred over b:senior:0 just because it was inserted
  // earlier.
  assert.ok(result.includes('a:senior:0'))
  assert.ok(result.includes('b:senior:0'))
  assert.equal(result.includes('a:senior:1'), false)
})

test('suggestBehaviorRefs: a real text match still outranks the fallback', () => {
  const competencies = [
    {
      id: 'analytics',
      levels: {
        senior: [
          'Строит воронку и анализирует конверсию по этапам',
          'Формулирует гипотезы роста на основе данных',
          'Настраивает сквозную аналитику для команды и процессов',
        ],
      },
    },
  ]
  const text = 'Настроили сквозную аналитику для всей команды и процессов'
  const result = suggestBehaviorRefs(text, ['analytics'], competencies, 'senior')
  assert.equal(result[0], 'analytics:senior:2')
})
