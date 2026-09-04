import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveActiveScale } from '../app/career/active-scale.mjs'
import { retrieveCriteria, validateAiRequest } from '../app/career/ai-contract.mjs'
import { buildLocalGuidance } from '../app/career/local-guidance.mjs'
import { parseCustomScaleMock, createCustomScaleDraft } from '../app/career/custom-scale.mjs'

const SAMPLE_INSTRUCTIONS = `# Управление проектами
- Специалист: ведёт задачи по чек-листу
- Специалист: фиксирует статус в трекере
- Senior: самостоятельно приоритизирует бэклог
- Senior: договаривается со смежными командами
- Lead: выстраивает процесс для команды
- Lead: определяет приоритеты на квартал

## Работа с данными
- Строит базовые отчёты по метрикам
- Предлагает гипотезы на основе данных
- Настраивает сквозную аналитику
- Формирует data-driven культуру в команде
`

function readyCustomScale() {
  const parsed = parseCustomScaleMock(SAMPLE_INSTRUCTIONS, 'Тестовая шкала')
  const draft = createCustomScaleDraft(SAMPLE_INSTRUCTIONS, 'text', null, 'Тестовая шкала')
  return { ...draft, status: 'ready', competencies: parsed.competencies, knowledgeBaseVersion: parsed.knowledgeBaseVersion }
}

test('deriveActiveScale(null) returns the built-in 12x3 scale', () => {
  const scale = deriveActiveScale(null)
  assert.equal(scale.isCustom, false)
  assert.equal(scale.allCriteria.length, 149)
  assert.match(scale.knowledgeBaseVersion, /^digital-marketing-competency-scale-/)
})

test('deriveActiveScale falls back to default for a draft (not-ready) custom scale', () => {
  const draft = createCustomScaleDraft(SAMPLE_INSTRUCTIONS, 'text', null, 'Черновик')
  const scale = deriveActiveScale(draft)
  assert.equal(scale.isCustom, false)
})

test('deriveActiveScale switches to the custom scale once status is ready', () => {
  const scale = deriveActiveScale(readyCustomScale())
  assert.equal(scale.isCustom, true)
  assert.equal(scale.allCriteria.length, 10)
  assert.match(scale.knowledgeBaseVersion, /^custom-scale-mock-/)
})

test('deriveActiveScale generates non-empty keywords for every custom competency', () => {
  const scale = deriveActiveScale(readyCustomScale())
  for (const competency of scale.competencies) {
    assert.ok(scale.competencyKeywords[competency.id])
    assert.ok(scale.competencyKeywords[competency.id].length > 0)
  }
})

test('retrieveCriteria with no activeScale argument defaults to the built-in scale (backward compatible)', () => {
  const payload = validateAiRequest({
    action: 'idea_review',
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Проверить гипотезу роста конверсии', competencyIds: ['analytics'] },
  })
  const retrieval = retrieveCriteria(payload)
  assert.match(retrieval.knowledgeBaseVersion, /^digital-marketing-competency-scale-/)
})

test('retrieveCriteria only returns criteria from the custom scale when one is active', () => {
  const activeScale = deriveActiveScale(readyCustomScale())
  const payload = validateAiRequest({
    action: 'idea_review',
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Строим отчёты по данным', competencyIds: [activeScale.competencies[1].id] },
  })
  const retrieval = retrieveCriteria(payload, activeScale)
  assert.ok(retrieval.criteria.length > 0)
  const defaultIds = new Set(deriveActiveScale(null).allCriteria.map((c) => c.id))
  for (const criterion of retrieval.criteria) {
    assert.equal(defaultIds.has(criterion.id), false, `${criterion.id} should not come from the default scale`)
  }
  assert.match(retrieval.knowledgeBaseVersion, /^custom-scale-mock-/)
})

test('retrieveCriteria only uses current and next levels regardless of which scale is active', () => {
  const activeScale = deriveActiveScale(readyCustomScale())
  const payload = validateAiRequest({
    action: 'idea_review',
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Проверить гипотезу', competencyIds: [activeScale.competencies[0].id] },
  })
  const retrieval = retrieveCriteria(payload, activeScale)
  assert.ok(retrieval.criteria.every((criterion) => ['specialist', 'senior'].includes(criterion.level)))
})

test('buildLocalGuidance with no activeScale argument still works against the built-in scale', () => {
  const result = buildLocalGuidance('idea_review', {
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Настроить аналитику воронки', competencyIds: ['analytics'] },
  })
  assert.match(result.knowledgeBaseVersion, /^digital-marketing-competency-scale-/)
  assert.ok(result.sources.length > 0)
})

test('buildLocalGuidance sources come from the custom scale once one is active', () => {
  const activeScale = deriveActiveScale(readyCustomScale())
  const result = buildLocalGuidance('idea_review', {
    profile: { currentLevel: 'specialist', role: 'Digital Marketing Specialist' },
    artifact: { title: 'Настроить сквозную аналитику', competencyIds: [activeScale.competencies[1].id] },
  }, activeScale)
  assert.match(result.knowledgeBaseVersion, /^custom-scale-mock-/)
  assert.ok(result.sources.length > 0)
  for (const source of result.sources) {
    assert.ok(activeScale.allCriteria.some((c) => c.id === source.id))
  }
})

test('buildLocalGuidance report draft still requires markdown content when a custom scale is active', () => {
  const activeScale = deriveActiveScale(readyCustomScale())
  const result = buildLocalGuidance('report_draft', {
    profile: { currentLevel: 'senior', role: 'Manager' },
    artifact: { reportType: 'monthly', wins: [] },
  }, activeScale)
  assert.ok(typeof result.draftMarkdown === 'string')
})
