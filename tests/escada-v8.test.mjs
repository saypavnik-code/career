import test from 'node:test'
import assert from 'node:assert/strict'
import {
  STORAGE_KEY,
  captureToIdea,
  classifyCapture,
  computeGrowthPath,
  createCapture,
  createDefaultState,
  migrateState,
  winGapHints,
} from '../app/career/career-core.mjs'
import {
  allCriteria,
  competencyKnowledge,
  knowledgeBaseVersion,
} from '../app/career/competency-knowledge.mjs'
import {
  buildClosedWorldMessages,
  parseAndValidateAiResponse,
  retrieveCriteria,
  validateAiRequest,
} from '../app/career/ai-contract.mjs'

test('v8 uses a new storage key and keeps all 12 competencies', () => {
  assert.equal(STORAGE_KEY, 'escada:v4')
  assert.equal(competencyKnowledge.length, 12)
  assert.ok(allCriteria.length > 100)
  assert.match(knowledgeBaseVersion, /competency-scale/)
  assert.ok(allCriteria.every((criterion) => criterion.id && criterion.sourcePage >= 2 && criterion.sourcePage <= 16))
})

test('quick capture remains free-form and classification is non-destructive', () => {
  assert.equal(classifyCapture('Проверить новый PR-угол на собственных данных').kind, 'idea')
  assert.equal(classifyCapture('Получила публикацию и согласованный медиаплан').kind, 'win')
  assert.equal(classifyCapture('Разговор с коллегой про формат').kind, 'note')
  const capture = createCapture('Проверить новый формат')
  const idea = captureToIdea(capture, 'senior')
  assert.equal(idea.title, capture.text)
  assert.deepEqual(idea.workItems, [])
})

test('migration from v3 preserves records and adds captures and optional evidence fields', () => {
  const migrated = migrateState({
    version: 3,
    onboardingComplete: true,
    profile: { currentLevel: 'senior', name: 'Мария', role: 'Digital Marketing Manager' },
    ideas: [{ id: 'i1', title: 'Идея', notes: [], workItems: [] }],
    wins: [{ id: 'w1', title: 'Результат' }],
    reports: [],
  }, createDefaultState())
  assert.deepEqual(migrated.captures, [])
  assert.deepEqual(migrated.ideas[0].evidenceNotes, [])
  assert.equal(migrated.wins[0].metrics, '')
  assert.equal(migrated.profile.currentLevel, 'senior')
})

test('growth path follows the profile level and never invents a level after lead', () => {
  const state = createDefaultState()
  state.profile.currentLevel = 'senior'
  state.ideas = [{ competencyIds: ['analytics'], behaviorRefs: [], workItems: [], levelSignal: 'senior' }]
  state.wins = [{ competencyIds: ['analytics'], behaviorRefs: [], evidence: 'Отчёт', impact: 'Изменение', levelSignal: 'senior' }]
  const path = computeGrowthPath(state, competencyKnowledge)
  assert.equal(path.currentLevel, 'senior')
  assert.equal(path.nextLevel, 'lead')
  assert.equal(path.strongSignals[0].id, 'analytics')
  state.profile.currentLevel = 'lead'
  assert.equal(computeGrowthPath(state, competencyKnowledge).nextLevel, null)
})

test('win hints require impact and evidence but keep KPI optional', () => {
  assert.deepEqual(winGapHints({ title: 'Запуск' }).slice(0, 2), [
    'Добавьте, почему результат важен для бизнеса, команды, пользователя или процесса.',
    'Добавьте доказательство: артефакт, ссылку, обратную связь, метрику или принятое решение.',
  ])
  assert.equal(winGapHints({ impact: 'Важно', evidence: 'Ссылка', metrics: '' }).length, 1)
})

test('closed-world retrieval only uses current and next levels', () => {
  const payload = validateAiRequest({
    action: 'idea_review',
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Проверить гипотезу роста конверсии', competencyIds: ['analytics'] },
  })
  const retrieval = retrieveCriteria(payload)
  assert.ok(retrieval.criteria.length > 0)
  assert.ok(retrieval.criteria.every((criterion) => ['specialist', 'senior'].includes(criterion.level)))
  const messages = buildClosedWorldMessages(payload, retrieval)
  assert.match(messages[0].content, /Use only the COMPETENCY CRITERIA/)
  assert.match(messages[0].content, /Never assign an official level/)
})

test('AI validator removes unsupported criterion IDs and keeps supported citations', () => {
  const payload = validateAiRequest({ action: 'idea_review', profile: { currentLevel: 'senior', role: 'Manager' }, artifact: { title: 'Анализ данных', competencyIds: ['analytics'] } })
  const retrieval = retrieveCriteria(payload)
  const allowed = retrieval.criteria[0].id
  const result = parseAndValidateAiResponse({
    headline: 'Разбор',
    strengths: [{ text: 'Есть сигнал', criterionId: allowed }, { text: 'Нельзя', criterionId: 'external.fake.01' }],
    stretch: [], evidence: ['Сохранить отчёт'], nextStep: 'Сформулировать гипотезу', rewrite: null, draftMarkdown: null, caveat: '',
  }, retrieval, 'idea_review')
  assert.equal(result.strengths.length, 1)
  assert.equal(result.strengths[0].criterionId, allowed)
})

test('report draft contract requires Markdown content', () => {
  const payload = validateAiRequest({ action: 'report_draft', profile: { currentLevel: 'senior', role: 'Manager' }, artifact: { wins: [] } })
  const retrieval = retrieveCriteria(payload)
  assert.throws(() => parseAndValidateAiResponse({ headline: 'x', strengths: [], stretch: [], evidence: [], nextStep: '', rewrite: null, draftMarkdown: null }, retrieval, 'report_draft'), /AI_DRAFT_MISSING/)
})
