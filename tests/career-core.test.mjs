import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCoachNotes,
  buildReportMarkdown,
  computeProgress,
  createDefaultState,
  inferLevelSignal,
  migrateState,
  promoteIdeaToWin,
  suggestBehaviorRefs,
  suggestCompetencyIds,
} from '../app/career/career-core.mjs'

const competencies = [
  {
    id: 'analytics',
    shortTitle: 'Аналитика',
    title: 'Аналитика',
    levels: {
      specialist: ['Собирает данные и отчёты'],
      senior: ['Выявляет причинно-следственные связи и строит гипотезы'],
      lead: ['Формирует методологию и прогнозирует влияние стратегии'],
    },
  },
  {
    id: 'pr',
    shortTitle: 'PR',
    title: 'PR',
    levels: {
      specialist: ['Готовит базовые PR-материалы'],
      senior: ['Разрабатывает PR-планы и работает со СМИ'],
      lead: ['Формирует репутационную стратегию региона'],
    },
  },
]
const keywords = { analytics: ['данн', 'метрик'], pr: ['сми', 'журналист'] }

test('competency suggestions remain non-blocking and ranked', () => {
  assert.deepEqual(suggestCompetencyIds('Проверить данные и метрики, затем отправить журналистам', competencies, keywords, 2), ['analytics', 'pr'])
})

test('level inference distinguishes execution, ownership and scale', () => {
  assert.equal(inferLevelSignal('Подготовить и опубликовать материал').level, 'specialist')
  assert.equal(inferLevelSignal('Проверить гипотезу и оптимизировать процесс по метрикам').level, 'senior')
  assert.equal(inferLevelSignal('Сформировать стратегию и стандарты для команды региона').level, 'lead')
})

test('behavior suggestions point to relevant level signals without requiring them', () => {
  const refs = suggestBehaviorRefs('Проверить гипотезу и причинно-следственные связи', ['analytics'], competencies, 'senior')
  assert.deepEqual(refs, ['analytics:senior:0'])
})

test('promoting an idea carries completed work and level context into a win', () => {
  const win = promoteIdeaToWin({
    id: 'idea-1',
    title: 'Новый PR-угол',
    competencyIds: ['pr'],
    behaviorRefs: ['pr:senior:0'],
    levelSignal: 'senior',
    workItems: [
      { title: 'Выбрать факты', status: 'done' },
      { title: 'Отправить письма', status: 'doing' },
    ],
    notes: [{ text: 'Лучше работает бизнес-угол' }],
  })
  assert.equal(win.sourceIdeaId, 'idea-1')
  assert.equal(win.levelSignal, 'senior')
  assert.deepEqual(win.workSummary, ['Выбрать факты'])
  assert.deepEqual(win.noteSummary, ['Лучше работает бизнес-угол'])
})

test('report builder includes completed work details', () => {
  const report = buildReportMarkdown({
    profile: { name: 'Павел', role: 'Маркетолог' },
    ideas: [],
    wins: [{
      title: 'Улучшил воронку',
      impact: 'Конверсия +10%',
      evidence: 'Дашборд',
      competencyIds: ['analytics'],
      levelSignal: 'senior',
      workSummary: ['Провёл аудит', 'Запустил эксперимент'],
    }],
    competencies,
    periodLabel: 'Q3 2026',
  })
  assert.match(report, /Провёл аудит/)
  assert.match(report, /Запустил эксперимент/)
  assert.match(report, /Старший специалист/)
})

test('v2 state migrates to Escada schema without data loss', () => {
  const migrated = migrateState({
    version: 2,
    profile: { name: 'Павел', role: 'Маркетолог' },
    ideas: [{ id: '1', title: 'Тест', status: 'exploring', competencyIds: ['analytics'], createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' }],
    wins: [],
    reports: [],
  }, createDefaultState(new Date('2026-08-04T00:00:00Z')))
  assert.equal(migrated.version, 3)
  assert.equal(migrated.ideas[0].title, 'Тест')
  assert.deepEqual(migrated.ideas[0].workItems, [])
  assert.deepEqual(migrated.ideas[0].notes, [])
  assert.equal(migrated.profile.currentLevel, 'specialist')
})

test('progress is evidence coverage rather than an official checklist score', () => {
  const progress = computeProgress({
    profile: { currentLevel: 'specialist' },
    ideas: [{ competencyIds: ['analytics'], levelSignal: 'senior', behaviorRefs: ['analytics:senior:0'], workItems: [{ status: 'done' }] }],
    wins: [{ competencyIds: ['pr'], levelSignal: 'lead', behaviorRefs: ['pr:lead:0'] }],
  }, competencies)
  assert.equal(progress.coverage.senior, 50)
  assert.equal(progress.coverage.lead, 50)
  assert.equal(progress.competencies.find((row) => row.competencyId === 'analytics').completedWork, 1)
})

test('coach notes surface next-level behavior and work ready for a win', () => {
  const state = {
    profile: { currentLevel: 'specialist' },
    ideas: [{
      id: 'idea-1',
      title: 'Стратегия команды',
      status: 'exploring',
      levelSignal: 'lead',
      levelReason: 'Масштабирование команды',
      workItems: [{ status: 'done' }, { status: 'done' }],
      updatedAt: '2026-08-04T00:00:00Z',
    }],
    wins: [],
  }
  const notes = buildCoachNotes(state, competencies, new Date('2026-08-04T12:00:00Z'))
  assert.equal(notes[0].kind, 'level')
  assert.equal(notes[1].kind, 'win')
})
