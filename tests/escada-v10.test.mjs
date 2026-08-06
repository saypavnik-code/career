import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLocalGuidance } from '../app/career/local-guidance.mjs'
import { deleteWin } from '../app/career/career-core.mjs'

const profile = {
  name: 'Мария',
  role: 'Digital Marketing Manager Brazil',
  market: 'Brazil',
  currentLevel: 'specialist',
}

test('local idea guidance works without an external AI endpoint', () => {
  const result = buildLocalGuidance('idea_review', {
    profile,
    competencyIds: ['results-proactivity'],
    artifact: {
      title: 'Проверить новый PR-угол',
      details: 'Хочу сформулировать гипотезу и проверить эффект публикации.',
      nextStep: '',
      workItems: [],
      evidenceNotes: [],
    },
  })
  assert.match(result.headline, /подсказка/i)
  assert.ok(result.strengths.length > 0)
  assert.ok(result.stretch.length > 0)
  assert.ok(result.nextStep.length > 20)
  assert.ok(result.sources.every((source) => source.id && source.sourcePage > 0))
  assert.match(result.caveat, /только по шкале компетенций/i)
})

test('local report draft uses only selected facts', () => {
  const result = buildLocalGuidance('report_draft', {
    profile: { ...profile, currentLevel: 'senior' },
    competencyIds: ['content-marketing'],
    artifact: {
      reportType: 'Ежемесячный отчёт',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      wins: [{ title: 'Опубликовала исследование', impact: 'Материал использовала PR-команда', evidence: 'Ссылка на публикацию', metrics: '', confirmedBy: '' }],
      ideas: [{ title: 'Новый формат кейсов', nextStep: 'Собрать три интервью' }],
    },
  })
  assert.match(result.draftMarkdown, /Опубликовала исследование/)
  assert.match(result.draftMarkdown, /Ссылка на публикацию/)
  assert.match(result.draftMarkdown, /Новый формат кейсов/)
  assert.doesNotMatch(result.draftMarkdown, /увеличила выручку/i)
})

test('local win guidance never invents missing evidence', () => {
  const result = buildLocalGuidance('win_rewrite', {
    profile,
    artifact: { title: 'Запустила тест', impact: '', evidence: '', metrics: '', confirmedBy: '' },
    competencyIds: ['adaptability'],
  })
  assert.equal(result.rewrite.title, 'Запустила тест')
  assert.equal(result.rewrite.impact, '')
  assert.equal(result.rewrite.evidence, '')
  assert.ok(result.evidence.some((item) => /подтверждение|почему/i.test(item)))
})

test('growth guidance stays inside current and next levels', () => {
  const result = buildLocalGuidance('growth_guidance', {
    profile: { ...profile, currentLevel: 'senior' },
    artifact: { ideas: [], wins: [] },
    competencyIds: ['ownership'],
  })
  assert.ok(result.sources.length > 0)
  assert.ok(result.sources.every((source) => ['senior', 'lead'].includes(source.level)))
  assert.ok(result.stretch.length <= 2)
})


test('deleteWin removes the win and cleans up dangling report references', () => {
  const state = {
    wins: [
      { id: 'win_1', title: 'Первый' },
      { id: 'win_2', title: 'Второй' },
    ],
    reports: [
      { id: 'report_1', winIds: ['win_1', 'win_2'] },
      { id: 'report_2', winIds: ['win_2'] },
    ],
  }
  const result = deleteWin(state, 'win_1')
  assert.equal(result.wins.length, 1)
  assert.equal(result.wins[0].id, 'win_2')
  assert.deepEqual(result.reports[0].winIds, ['win_2'])
  assert.deepEqual(result.reports[1].winIds, ['win_2'])
})

test('weekly report draft stays short and skips full report ceremony', () => {
  const result = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager Brazil', market: 'Brazil', currentLevel: 'specialist' },
    competencyIds: [],
    artifact: {
      reportType: 'Недельный отчёт',
      periodStart: '2026-08-03',
      periodEnd: '2026-08-09',
      wins: [{ title: 'Запустила тест заголовков', impact: 'Ускорила проверку гипотезы', evidence: '', metrics: '', confirmedBy: '' }],
      ideas: [{ title: 'Новый лендинг', nextStep: 'Согласовать макет' }],
    },
  })
  assert.match(result.draftMarkdown, /Недельный отчёт/)
  assert.match(result.draftMarkdown, /Запустила тест заголовков/)
  assert.doesNotMatch(result.draftMarkdown, /Сигналы профессионального роста/)
})

test('performance review draft includes a competency-signal summary from real data only', () => {
  const result = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager Brazil', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: ['content-marketing'],
    artifact: {
      reportType: 'Performance review',
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
      wins: [
        { title: 'Опубликовала гайд', impact: 'Использует команда поддержки', evidence: 'Ссылка на гайд', competencyIds: ['content-marketing'], competencyTitle: 'Контент-маркетинг и продакшен экспертных материалов' },
      ],
      ideas: [],
    },
  })
  assert.match(result.draftMarkdown, /Performance review/)
  assert.match(result.draftMarkdown, /Сигналы по компетенциям/)
  assert.match(result.draftMarkdown, /Контент-маркетинг/)
  assert.doesNotMatch(result.draftMarkdown, /%/)
})

test('promotion case draft leads with signals and ends with a verification checklist', () => {
  const result = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager Brazil', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: ['results-proactivity'],
    artifact: {
      reportType: 'Promotion case',
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
      wins: [
        { title: 'Выросла конверсия лендинга', impact: 'Команда приняла подход как стандарт', evidence: 'Дашборд аналитики', competencyIds: ['results-proactivity'], competencyTitle: 'Ориентация на результат и проактивность' },
      ],
      ideas: [],
    },
  })
  assert.match(result.draftMarkdown, /Promotion case/)
  assert.match(result.draftMarkdown, /Сильнейшие сигналы/)
  assert.match(result.draftMarkdown, /Не забудьте перед отправкой/)
})
