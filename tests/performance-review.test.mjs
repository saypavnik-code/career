import assert from 'node:assert/strict'
import { test } from 'node:test'
import { REVIEW_VERSION, PEER_SECTIONS, validateReviewRequest, validateReviewResponse } from '../app/performance-review/review-contract.mjs'
import { buildReviewMessages } from '../server/review-prompts.mjs'

const input = {
  version: REVIEW_VERSION,
  mode: 'self',
  action: 'next',
  period: 'H2 2026',
  points: ['Результаты', 'Зоны роста'],
  turns: [],
}

test('the interview asks one question tied to a supplied point before closing', () => {
  const request = validateReviewRequest(input)
  const question = { version: REVIEW_VERSION, kind: 'question', question: { point: 1, text: 'Какой результат вы наблюдали?' }, covered: [], missing: [] }
  assert.deepEqual(validateReviewResponse(question, request), question)
  assert.throws(() => validateReviewResponse({ ...question, question: { point: 99, text: 'Что ещё?' } }, request))
  assert.throws(() => validateReviewResponse({ ...question, covered: [1] }, request))
  const ready = { version: REVIEW_VERSION, kind: 'ready', covered: [1], missing: [2] }
  assert.throws(() => validateReviewResponse(ready, request))
  const answered = validateReviewRequest({
    ...input,
    turns: [{ ...question.question, answer: 'Сократил ручную обработку.' }, { point: 2, text: 'Что можно улучшить?', answer: null }],
  })
  assert.throws(() => validateReviewResponse(question, answered))
  assert.throws(() => validateReviewResponse({ ...ready, covered: [1, 2], missing: [] }, answered))
  assert.deepEqual(validateReviewResponse(ready, answered), ready)
})

test('a self review requires evidence, diagnostics and a section for each supplied point', () => {
  assert.throws(() => validateReviewRequest({ ...input, action: 'draft' }))
  const request = validateReviewRequest({
    ...input, action: 'draft',
    turns: [{ point: 1, text: 'Какой результат вы наблюдали?', answer: 'Сократил ручную обработку.' }, { point: 2, text: 'Что можно улучшить?', answer: null }],
    matrix: [{ id: 'example', competency: 'Автоматизация', level: 'lead', text: 'Описывает воспроизводимый процесс.' }],
  })
  const draft = {
    version: REVIEW_VERSION,
    kind: 'draft',
    diagnostics: 'Для сигнала Lead нужны доказательства внедрения.',
    sections: [{ id: 1, text: 'Описал процесс.' }, { id: 2, text: 'Стоит проверить применение командой.' }],
  }
  assert.deepEqual(validateReviewResponse(draft, request), draft)
  assert.throws(() => validateReviewResponse({ ...draft, diagnostics: '' }, request))
  assert.throws(() => validateReviewResponse({ ...draft, sections: [draft.sections[0], draft.sections[0]] }, request))
  const [system, user] = buildReviewMessages(request)
  assert.match(system.content, /5–7 strongest achievements/)
  assert.deepEqual(JSON.parse(user.content).competencyMatrix, request.matrix)
})

test('peer reviews use four fixed final sections and exclude competency data', () => {
  const request = validateReviewRequest({
    ...input, mode: 'peer', subject: 'Саша', action: 'draft', points: ['Проект: PR', 'Как улучшить обратную связь?'],
    turns: [{ point: 1, text: 'Где вы работали вместе?', answer: 'Готовили публикацию.' }, { point: 2, text: 'Что стоит улучшить?', answer: null }],
    matrix: [{ id: 'ignored' }],
  })
  assert.deepEqual(request.matrix, [])
  const [system, user] = buildReviewMessages(request)
  assert.match(system.content, /7–10 questions/)
  assert.equal(user.role, 'user')
  assert.deepEqual(JSON.parse(user.content).draftSections.map(({ title }) => title), PEER_SECTIONS)
  const draft = {
    version: REVIEW_VERSION, kind: 'draft', diagnostics: '',
    sections: PEER_SECTIONS.map((_, index) => ({ id: index + 1, text: 'Наблюдение.' })).reverse(),
  }
  assert.deepEqual(validateReviewResponse(draft, request).sections.map(({ id }) => id), [1, 2, 3, 4])
  assert.throws(() => validateReviewResponse({ ...draft, sections: draft.sections.slice(0, 3) }, request))
})
