import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCustomScaleMock,
  createCustomScaleDraft,
  CUSTOM_SCALE_MIN_CHARS,
} from '../app/career/custom-scale.mjs'
import {
  createDefaultState,
  normalizeCustomCompetencyScale,
  resetCycleForNewScale,
  migrateState,
} from '../app/career/career-core.mjs'

const SAMPLE_INSTRUCTIONS = `# Управление проектами
- Специалист: ведёт задачи по чек-листу
- Специалист: фиксирует статус в трекере
- Senior: самостоятельно приоритизирует бэклог
- Senior: договаривается со смежными командами
- Lead: выстраивает процесс для команды
- Lead: определяет приоритеты на квартал

## Работа с данными
Строит базовые отчёты по метрикам
Предлагает гипотезы на основе данных
Настраивает сквозную аналитику
Формирует data-driven культуру в команде
`

test('parseCustomScaleMock produces one competency per heading with three levels', () => {
  const result = parseCustomScaleMock(SAMPLE_INSTRUCTIONS, 'Тестовая шкала')
  assert.equal(result.competencies.length, 2)
  for (const competency of result.competencies) {
    assert.ok(competency.id)
    assert.ok(competency.title)
    assert.ok(competency.levels.specialist.length > 0)
    assert.ok(competency.levels.senior.length > 0)
    assert.ok(competency.levels.lead.length > 0)
  }
  assert.match(result.knowledgeBaseVersion, /^custom-scale-mock-/)
})

test('parseCustomScaleMock routes explicitly hinted lines to the right level', () => {
  const result = parseCustomScaleMock(SAMPLE_INSTRUCTIONS, 'Тестовая шкала')
  const projectMgmt = result.competencies.find((item) => item.title.includes('Управление'))
  assert.ok(projectMgmt)
  assert.ok(projectMgmt.levels.specialist.some((c) => c.text.includes('чек-листу')))
  assert.ok(projectMgmt.levels.senior.some((c) => c.text.includes('приоритизирует')))
  assert.ok(projectMgmt.levels.lead.some((c) => c.text.includes('приоритеты на квартал')))
})

test('parseCustomScaleMock generates unique competency ids even with duplicate headings', () => {
  const dup = '# Аналитика\n- пункт один\n\n# Аналитика\n- пункт два\n'
  const result = parseCustomScaleMock(dup, 'Дубликаты')
  const ids = result.competencies.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('parseCustomScaleMock never leaves a level with zero criteria', () => {
  const sparse = '# Одна компетенция\nПросто один пункт без уровней.'
  const result = parseCustomScaleMock(sparse, 'Мало данных')
  const [competency] = result.competencies
  assert.ok(competency.levels.specialist.length > 0)
  assert.ok(competency.levels.senior.length > 0)
  assert.ok(competency.levels.lead.length > 0)
})

test('parseCustomScaleMock falls back to a single competency when no structure is found', () => {
  const flat = 'a'.repeat(CUSTOM_SCALE_MIN_CHARS + 5)
  const result = parseCustomScaleMock(flat, 'Плоский текст')
  assert.equal(result.competencies.length, 1)
})

test('createCustomScaleDraft starts in draft status with no parsed competencies', () => {
  const draft = createCustomScaleDraft(SAMPLE_INSTRUCTIONS, 'text', null, 'Моя шкала')
  assert.equal(draft.status, 'draft')
  assert.equal(draft.competencies, null)
  assert.equal(draft.isMock, true)
  assert.equal(draft.sourceType, 'text')
})

test('normalizeCustomCompetencyScale returns null for missing or malformed input', () => {
  assert.equal(normalizeCustomCompetencyScale(null), null)
  assert.equal(normalizeCustomCompetencyScale(undefined), null)
  assert.equal(normalizeCustomCompetencyScale('not an object'), null)
})

test('normalizeCustomCompetencyScale defends against an unknown status value', () => {
  const normalized = normalizeCustomCompetencyScale({ status: 'nonsense', competencies: [] })
  assert.equal(normalized.status, 'draft')
})

test('resetCycleForNewScale clears ideas, wins, notes and reports but keeps the profile', () => {
  const before = createDefaultState()
  before.profile.name = 'Павел'
  before.profile.market = 'LATAM'
  before.ideas = [{ id: 'idea-1' }]
  before.wins = [{ id: 'win-1' }]
  before.notes = [{ id: 'note-1' }]
  before.reports = [{ id: 'report-1' }]

  const parsed = parseCustomScaleMock(SAMPLE_INSTRUCTIONS, 'Новая шкала')
  const scaleDraft = createCustomScaleDraft(SAMPLE_INSTRUCTIONS, 'text', null, 'Новая шкала')
  const readyScale = { ...scaleDraft, status: 'ready', competencies: parsed.competencies, knowledgeBaseVersion: parsed.knowledgeBaseVersion }

  const after = resetCycleForNewScale(before, readyScale)

  assert.deepEqual(after.ideas, [])
  assert.deepEqual(after.wins, [])
  assert.deepEqual(after.notes, [])
  assert.deepEqual(after.reports, [])
  assert.equal(after.profile.name, 'Павел')
  assert.equal(after.profile.market, 'LATAM')
  assert.equal(after.customCompetencyScale.status, 'ready')
  assert.equal(after.customCompetencyScale.competencies.length, 2)
})

test('resetCycleForNewScale with a null scale clears the cycle and restores the default scale', () => {
  const before = createDefaultState()
  before.ideas = [{ id: 'idea-1' }]
  const after = resetCycleForNewScale(before, null)
  assert.deepEqual(after.ideas, [])
  assert.equal(after.customCompetencyScale, null)
})

test('migrateState preserves a previously saved custom competency scale', () => {
  const parsed = parseCustomScaleMock(SAMPLE_INSTRUCTIONS, 'Сохранённая шкала')
  const saved = {
    ...createDefaultState(),
    ideas: [],
    wins: [],
    customCompetencyScale: {
      id: 'custom-scale-1',
      title: 'Сохранённая шкала',
      sourceType: 'text',
      sourceFileName: null,
      rawInput: SAMPLE_INSTRUCTIONS,
      status: 'ready',
      competencies: parsed.competencies,
      knowledgeBaseVersion: parsed.knowledgeBaseVersion,
      parseNotes: [],
      errorMessage: null,
      createdAt: new Date().toISOString(),
      isMock: true,
    },
  }
  const migrated = migrateState(saved, createDefaultState())
  assert.equal(migrated.customCompetencyScale.status, 'ready')
  assert.equal(migrated.customCompetencyScale.competencies.length, 2)
})

test('migrateState defaults customCompetencyScale to null for pre-v31 saved state', () => {
  const legacy = { ...createDefaultState() }
  delete legacy.customCompetencyScale
  const migrated = migrateState(legacy, createDefaultState())
  assert.equal(migrated.customCompetencyScale, null)
})
