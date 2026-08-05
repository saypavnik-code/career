import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLocalGuidance } from '../app/career/local-guidance.mjs'

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
