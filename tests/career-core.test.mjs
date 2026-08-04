import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportMarkdown,
  computeInsights,
  createDefaultState,
  migrateState,
  promoteIdeaToWin,
  selectWinsForPeriod,
  suggestCompetencyIds,
} from '../app/career/career-core.mjs'

const competencies = [
  { id: 'analytics', shortTitle: 'Аналитика', title: 'Аналитика' },
  { id: 'pr', shortTitle: 'PR', title: 'PR' },
]
const keywords = { analytics: ['данн', 'метрик'], pr: ['сми', 'журналист'] }

test('suggestCompetencyIds returns ranked non-blocking suggestions', () => {
  assert.deepEqual(
    suggestCompetencyIds('Проверить данные и метрики, затем отправить журналистам', competencies, keywords, 2),
    ['analytics', 'pr'],
  )
})

test('promoteIdeaToWin preserves source and competency context', () => {
  const win = promoteIdeaToWin({ id: 'idea-1', title: 'Test idea', competencyIds: ['analytics'] }, { impact: '10% growth' })
  assert.equal(win.sourceIdeaId, 'idea-1')
  assert.equal(win.title, 'Test idea')
  assert.deepEqual(win.competencyIds, ['analytics'])
})

test('report builder uses evidence and competency signals', () => {
  const report = buildReportMarkdown({
    profile: { name: 'Pavel', role: 'Marketer' },
    wins: [{ title: 'Improved funnel', impact: 'Conversion +10%', evidence: 'Dashboard', competencyIds: ['analytics'] }],
    competencies,
    periodLabel: 'Q3 2026',
  })
  assert.match(report, /Improved funnel/)
  assert.match(report, /Conversion \+10%/)
  assert.match(report, /Аналитика/)
})

test('period selection excludes hidden and out-of-range wins', () => {
  const wins = [
    { id: 'a', date: '2026-07-10', reportReady: true },
    { id: 'b', date: '2026-06-10', reportReady: true },
    { id: 'c', date: '2026-07-20', reportReady: false },
  ]
  assert.deepEqual(selectWinsForPeriod(wins, '2026-07-01', '2026-07-31').map((item) => item.id), ['a'])
})

test('legacy v1 state migrates tasks into ideas without forcing a checklist', () => {
  const migrated = migrateState({
    profile: { name: 'Pavel' },
    tasks: [{ id: '1', title: 'Run test', status: 'in_progress', competencyId: 'analytics', potentialWin: 'Learn result' }],
    wins: [],
  }, createDefaultState(new Date('2026-08-04T00:00:00Z')))
  assert.equal(migrated.version, 2)
  assert.equal(migrated.ideas[0].status, 'exploring')
  assert.deepEqual(migrated.ideas[0].competencyIds, ['analytics'])
})

test('insights reflect the idea to win to report loop', () => {
  const insights = computeInsights({
    ideas: [{ status: 'inbox' }, { status: 'won' }],
    wins: [{ reportReady: true, competencyIds: ['analytics'] }],
    reports: [{ id: 'report-1' }],
  })
  assert.deepEqual(insights, {
    activeIdeas: 1,
    exploredIdeas: 0,
    wins: 1,
    reportReadyWins: 1,
    reports: 1,
    topCompetencies: [{ id: 'analytics', count: 1 }],
  })
})
