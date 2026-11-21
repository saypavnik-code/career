import assert from 'node:assert/strict'
import { test } from 'node:test'
import { REVIEW_VERSION, SELF_REVIEW_VERSION, PEER_SECTIONS, validateReviewRequest, validateReviewResponse } from '../app/performance-review/review-contract.mjs'
import { getReviewRubric, REVIEW_LEVEL_LABELS } from '../app/performance-review/review-rubric.mjs'
import { buildReviewMessages } from '../server/review-prompts.mjs'

const input = {
  version: SELF_REVIEW_VERSION,
  mode: 'self',
  level: 'senior',
  action: 'next',
  period: 'H2 2026',
  points: ['Результаты', 'Зоны роста'],
  turns: [],
}

test('the interview asks one question tied to a supplied point before closing', () => {
  const request = validateReviewRequest(input)
  const question = { version: SELF_REVIEW_VERSION, kind: 'question', question: { point: 1, text: 'Какой результат вы наблюдали?' }, covered: [], missing: [] }
  assert.deepEqual(validateReviewResponse(question, request), question)
  assert.throws(() => validateReviewResponse({ ...question, question: { point: 99, text: 'Что ещё?' } }, request))
  assert.throws(() => validateReviewResponse({ ...question, covered: [1] }, request))
  const ready = { version: SELF_REVIEW_VERSION, kind: 'ready', covered: [1], missing: [2] }
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
  })
  const rubric = getReviewRubric('senior')
  const assessment = rubric.competencies.map((competency, index) => ({
    competencyId: competency.id,
    status: index === 0 ? 'evidenced' : 'insufficient',
    note: index === 0 ? 'Сотрудник сократил ручную обработку.' : 'Нужен конкретный пример.',
    criterionIds: index === 0 ? [competency.criteria[0].id] : [],
    turnIds: index === 0 ? [1] : [],
  }))
  const draft = {
    version: SELF_REVIEW_VERSION,
    kind: 'draft',
    diagnostics: 'Для сигнала Lead нужны доказательства внедрения.',
    assessment,
    sections: [{ id: 1, text: 'Описал процесс.' }, { id: 2, text: 'Стоит проверить применение командой.' }],
  }
  assert.deepEqual(validateReviewResponse(draft, request), draft)
  assert.throws(() => validateReviewResponse({ ...draft, diagnostics: '' }, request))
  assert.throws(() => validateReviewResponse({ ...draft, sections: [draft.sections[0], draft.sections[0]] }, request))
  const [system, user] = buildReviewMessages(request)
  assert.match(system.content, /5–7 strongest achievements/)
  const context = JSON.parse(user.content)
  assert.deepEqual(context.competencyRubric, rubric)
  assert.equal(context.transcript[0].id, 1)
  assert.match(system.content, /mandatory standard/)
  assert.throws(() => validateReviewResponse({ ...draft, assessment: undefined }, request))
  assert.throws(() => validateReviewResponse({ ...draft, assessment: assessment.slice(1) }, request))
  const [first, ...rest] = assessment
  for (const bad of [
    { ...first, criterionIds: [] },
    { ...first, criterionIds: [rubric.competencies[0].nextCriteria[0].id] },
    { ...first, criterionIds: [rubric.competencies[1].criteria[0].id] },
    { ...first, turnIds: [2] },
    { ...first, turnIds: [100] },
    { ...first, status: 'not_applicable' },
    { ...first, competencyId: rest[0].competencyId },
  ]) {
    assert.throws(() => validateReviewResponse({ ...draft, assessment: [bad, ...rest] }, request))
  }
})

test('peer reviews use four fixed final sections and exclude competency data', () => {
  const request = validateReviewRequest({
    ...input, version: REVIEW_VERSION, mode: 'peer', subject: 'Саша', action: 'draft', points: ['Проект: PR', 'Как улучшить обратную связь?'],
    turns: [{ point: 1, text: 'Где вы работали вместе?', answer: 'Готовили публикацию.' }, { point: 2, text: 'Что стоит улучшить?', answer: null }],
    matrix: [{ id: 'ignored' }],
  })
  assert.deepEqual(request.matrix, [])
  assert.doesNotMatch(JSON.stringify(request), /level/)
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

test('each selectable level has all 12 competency areas for interview and drafting', () => {
  assert.deepEqual(Object.keys(REVIEW_LEVEL_LABELS), ['junior', 'specialist', 'senior', 'lead'])
  const totals = { junior: 12, specialist: 58, senior: 52, lead: 42 }
  for (const [level, count] of Object.entries(totals)) {
    const request = validateReviewRequest({ ...input, level, matrix: [{ id: 'forged' }] })
    assert.equal(request.level, level)
    assert.equal(request.matrix, undefined)
    const [, user] = buildReviewMessages(request)
    const rubric = JSON.parse(user.content).competencyRubric
    assert.equal(rubric.level, level)
    assert.equal(rubric.competencies.length, 12)
    assert.equal(rubric.competencies.flatMap(({ criteria }) => criteria).length, count)
    assert.ok(rubric.competencies.every(({ criteria }) => criteria.length > 0))
    assert.ok(rubric.competencies.flatMap(({ criteria }) => criteria)
      .every(({ sourcePage }) => level === 'junior' ? sourcePage === undefined : sourcePage >= 2 && sourcePage <= 16))
  }
  assert.equal(getReviewRubric('junior').source, 'working_guidance')
  assert.equal(getReviewRubric('lead').nextLevel, null)
  assert.throws(() => validateReviewRequest({ ...input, level: undefined }))
  assert.throws(() => validateReviewRequest({ ...input, level: 'manager' }))
  assert.throws(() => validateReviewRequest({ ...input, version: REVIEW_VERSION }))
})
