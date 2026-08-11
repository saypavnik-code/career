import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLocalGuidance } from '../app/career/local-guidance.mjs'
import {
  createDefaultState,
  createNote,
  deleteWin,
  deriveNoteTitle,
  migrateIdeaStatus,
  migrateState,
  noteToIdea,
  promoteIdeaToWin,
  updateNote,
} from '../app/career/career-core.mjs'

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
  assert.match(result.draftMarkdown, /Сигналы по компетенциям/i)
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
  assert.match(result.draftMarkdown, /Сильнейшие сигналы/i)
  assert.match(result.draftMarkdown, /Не забудьте перед отправкой/i)
})


test('deriveNoteTitle matches the roadmap worked example exactly', () => {
  const input = 'Новый подход к PR-рассылкам для локальных медиа\n\nМожно использовать собственные исследования и отдельные углы для разных типов изданий.'
  const { title, body } = deriveNoteTitle(input)
  assert.equal(title, 'Новый подход к PR-рассылкам')
  assert.equal(body, 'для локальных медиа\n\nМожно использовать собственные исследования и отдельные углы для разных типов изданий.')
})

test('deriveNoteTitle uses all words when the first line has fewer than four', () => {
  assert.deepEqual(deriveNoteTitle('Два слова'), { title: 'Два слова', body: '' })
  assert.deepEqual(deriveNoteTitle('Одно'), { title: 'Одно', body: '' })
})

test('deriveNoteTitle produces a title-only note when nothing follows', () => {
  const { title, body } = deriveNoteTitle('Ровно четыре слова тут')
  assert.equal(title, 'Ровно четыре слова тут')
  assert.equal(body, '')
})

test('deriveNoteTitle returns empty title for empty input', () => {
  assert.deepEqual(deriveNoteTitle(''), { title: '', body: '' })
  assert.deepEqual(deriveNoteTitle('   \n  '), { title: '', body: '' })
})

test('migrateState converts v4 captures into v5 notes without losing wins, ideas, or reports', () => {
  const v4State = {
    version: 4,
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'senior', reportingRhythm: 'monthly', cycleEnd: '2026-12-31' },
    captures: [
      { id: 'capture-1', text: 'Новый подход к PR-рассылкам для локальных медиа', suggestedKind: 'idea', status: 'unclassified', createdAt: '2026-08-01T00:00:00.000Z' },
    ],
    ideas: [
      { id: 'idea-1', title: 'Существующая идея', details: '', nextStep: '', status: 'inbox', competencyIds: [], levelSignal: 'specialist', levelReason: '', behaviorRefs: [], workItems: [], notes: [], evidenceNotes: [], createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' },
    ],
    wins: [
      { id: 'win-1', title: 'Существующий win', impact: 'x', evidence: 'y', metrics: '', confirmedBy: '', competencyIds: [], behaviorRefs: [], levelSignal: 'senior', sourceIdeaId: null, workSummary: [], noteSummary: [], date: '2026-07-15', reportReady: true, createdAt: '2026-07-15T00:00:00.000Z' },
    ],
    reports: [{ id: 'report-1', title: 'Старый отчёт', type: 'monthly', periodStart: '2026-06-01', periodEnd: '2026-06-30', winIds: ['win-1'], ideaIds: [], content: 'x', createdAt: '2026-07-01T00:00:00.000Z' }],
  }
  const migrated = migrateState(v4State)
  assert.equal(migrated.version, 5)
  assert.equal(migrated.notes.length, 1)
  assert.equal(migrated.notes[0].title, 'Новый подход к PR-рассылкам')
  assert.equal(migrated.ideas.length, 1)
  assert.equal(migrated.wins.length, 1)
  assert.equal(migrated.reports.length, 1)
  assert.equal(migrated.captures, undefined)
})

test('migrateState is idempotent on an already-v5 state', () => {
  const v5State = {
    version: 5,
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'senior', reportingRhythm: 'monthly', cycleEnd: '2026-12-31' },
    notes: [{ id: 'note-1', title: 'Заметка', body: '', rawText: 'Заметка', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', convertedIdeaId: null }],
    ideas: [],
    wins: [],
    reports: [],
  }
  const migratedOnce = migrateState(v5State)
  const migratedTwice = migrateState(migratedOnce)
  assert.deepEqual(migratedOnce.notes, migratedTwice.notes)
  assert.equal(migratedTwice.version, 5)
})


test('migrateIdeaStatus maps every legacy status per the roadmap migration table', () => {
  assert.equal(migrateIdeaStatus('inbox'), 'concept')
  assert.equal(migrateIdeaStatus(undefined), 'concept')
  assert.equal(migrateIdeaStatus('exploring', []), 'preparation')
  assert.equal(migrateIdeaStatus('exploring', [{ status: 'backlog' }]), 'preparation')
  assert.equal(migrateIdeaStatus('exploring', [{ status: 'doing' }]), 'in_progress')
  assert.equal(migrateIdeaStatus('exploring', [{ status: 'done' }, { status: 'backlog' }]), 'in_progress')
  assert.equal(migrateIdeaStatus('exploring', [{ status: 'done' }]), 'outcomes')
  assert.equal(migrateIdeaStatus('exploring', [{ status: 'done' }, { status: 'done' }]), 'outcomes')
  assert.equal(migrateIdeaStatus('won'), 'won')
  assert.equal(migrateIdeaStatus('archived'), 'archived')
})

test('migrateIdeaStatus is idempotent on every current-vocabulary value', () => {
  for (const status of ['concept', 'preparation', 'in_progress', 'outcomes', 'won', 'archived']) {
    assert.equal(migrateIdeaStatus(status), status)
  }
})

test('migrateState routes a v4-era idea status through migrateIdeaStatus end to end', () => {
  const migrated = migrateState({
    version: 4,
    profile: { currentLevel: 'senior', name: 'Мария', role: 'Digital Marketing Manager' },
    notes: [],
    ideas: [
      { id: 'i1', title: 'Задумка без работы', status: 'inbox', workItems: [] },
      { id: 'i2', title: 'В процессе', status: 'exploring', workItems: [{ status: 'doing' }] },
      { id: 'i3', title: 'Готова к win', status: 'exploring', workItems: [{ status: 'done' }] },
    ],
    wins: [],
    reports: [],
  })
  assert.equal(migrated.ideas.find((idea) => idea.id === 'i1').status, 'concept')
  assert.equal(migrated.ideas.find((idea) => idea.id === 'i2').status, 'in_progress')
  assert.equal(migrated.ideas.find((idea) => idea.id === 'i3').status, 'outcomes')
})


test('promoteIdeaToWin carries idea.details into win.sourceContext', () => {
  const idea = {
    id: 'idea-1',
    title: 'Обучить региональные команды',
    details: 'Хочу выстроить процесс обучения новых аналитиков в трёх регионах.',
    competencyIds: ['analytics'],
    behaviorRefs: [],
    levelSignal: 'senior',
    workItems: [],
    notes: [],
    evidenceNotes: [],
  }
  const win = promoteIdeaToWin(idea, {})
  assert.equal(win.sourceContext, idea.details)
  assert.equal(win.sourceIdeaId, 'idea-1')
})

test('promoteIdeaToWin respects an explicit sourceContext override in patch', () => {
  const idea = { id: 'idea-2', title: 'X', details: 'original', competencyIds: [], behaviorRefs: [], levelSignal: 'senior', workItems: [], notes: [], evidenceNotes: [] }
  const win = promoteIdeaToWin(idea, { sourceContext: 'overridden' })
  assert.equal(win.sourceContext, 'overridden')
})

test('updateNote re-derives title/body from edited raw text', () => {
  const state = {
    notes: [
      { id: 'note-1', title: 'Старый заголовок', body: 'старое тело', rawText: 'Старый заголовок старое тело', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', convertedIdeaId: null },
    ],
  }
  const updated = updateNote(state, 'note-1', 'Новый подход к PR-рассылкам для локальных медиа')
  const note = updated.notes.find((item) => item.id === 'note-1')
  assert.equal(note.title, 'Новый подход к PR-рассылкам')
  assert.equal(note.body, 'для локальных медиа')
  assert.equal(note.rawText, 'Новый подход к PR-рассылкам для локальных медиа')
})

test('updateNote preserves convertedIdeaId and is a safe no-op for an unknown note id', () => {
  const state = {
    notes: [
      { id: 'note-1', title: 'X', body: '', rawText: 'X', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', convertedIdeaId: 'idea-9' },
    ],
  }
  const updated = updateNote(state, 'note-1', 'X переработано полностью')
  assert.equal(updated.notes[0].convertedIdeaId, 'idea-9')

  const untouched = updateNote(state, 'does-not-exist', 'irrelevant')
  assert.deepEqual(untouched, state)

  const emptyText = updateNote(state, 'note-1', '   ')
  assert.deepEqual(emptyText, state)
})


// --- Phase 7 QA: the 8 mandatory scenarios from roadmap section 11, run
// end to end through the real state functions (not mocks), so a future
// change that breaks one of them fails a test instead of only being caught
// by a person manually clicking through the app.

test('QA scenario 1-2: записать мысль, затем открыть её по id', () => {
  let state = createDefaultState()
  const note = createNote('Проверить гипотезу роста конверсии на лендинге для рынка Бразилии')
  state = { ...state, notes: [note, ...state.notes] }
  assert.equal(state.notes.length, 1)

  const opened = state.notes.find((item) => item.id === note.id)
  assert.ok(opened)
  assert.equal(opened.title, 'Проверить гипотезу роста конверсии')
})

test('QA scenario 3: превратить заметку в идею без повторного ввода данных', () => {
  const note = createNote('Запустить серию PR материалов для локальных медиа')
  const { idea, note: updatedNote } = noteToIdea(note, 'senior')
  assert.equal(idea.title, note.title)
  assert.equal(idea.details, note.body)
  assert.equal(idea.status, 'concept')
  assert.equal(updatedNote.convertedIdeaId, idea.id)
})

test('QA scenario 4: изменить статус идеи через словарь активных статусов', () => {
  for (const status of ['concept', 'preparation', 'in_progress', 'outcomes']) {
    assert.equal(migrateIdeaStatus(status), status)
  }
})

test('QA scenario 5: карьерная подсказка отвечает без внешнего AI endpoint', () => {
  const result = buildLocalGuidance('idea_review', {
    profile: { name: 'Мария', role: 'Senior Marketer', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: [],
    artifact: { title: 'Запустить A/B тест заголовков', details: 'Проверить гипотезу роста open rate.' },
  })
  assert.ok(result.headline)
  assert.ok(result.strengths.length > 0)
  assert.ok(result.caveat)
})

test('QA scenario 6-7: превратить идею в win и найти его в Wins', () => {
  let state = createDefaultState()
  const note = createNote('Обучить региональные команды единым стандартам отчётности')
  const { idea } = noteToIdea(note, 'senior')
  state = { ...state, ideas: [idea] }

  const win = promoteIdeaToWin(idea, {})
  state = {
    ...state,
    wins: [win, ...state.wins],
    ideas: state.ideas.map((item) => item.id === idea.id ? { ...item, status: 'won' } : item),
  }

  assert.ok(state.wins.some((item) => item.id === win.id), 'win must be findable in Wins')
  assert.equal(win.sourceContext, idea.details, 'Смысл переносится в Исходный контекст')
  const activeKanban = state.ideas.filter((item) => item.status !== 'won' && item.status !== 'archived')
  assert.equal(activeKanban.length, 0, 'идея покидает активный канбан после Win!')
})

test('QA scenario 8: данные переживают перезагрузку (persist + migrateState round-trip)', () => {
  let state = createDefaultState()
  const note = createNote('Мысль перед перезагрузкой страницы браузера')
  state = { ...state, notes: [note] }

  const persisted = JSON.stringify(state)
  const reloaded = migrateState(JSON.parse(persisted), createDefaultState())

  assert.equal(reloaded.notes.length, 1)
  assert.equal(reloaded.notes[0].title, note.title)
  assert.equal(reloaded.version, 5)
})

test('QA fix: normalizeWin initializes sourceContext for wins migrated from pre-v18 storage', () => {
  const legacyV4State = {
    version: 4,
    profile: { currentLevel: 'senior', name: 'X', role: 'Y' },
    notes: [],
    ideas: [],
    wins: [
      { id: 'win-old', title: 'Старый win без sourceContext', impact: 'важно', evidence: 'было', sourceIdeaId: null },
    ],
    reports: [],
  }
  const migrated = migrateState(legacyV4State)
  assert.equal(migrated.wins[0].sourceContext, '')
})


test('generated report drafts contain no Markdown syntax (plain text only)', () => {
  const markdownPattern = /(^|\n)#{1,6}\s|\*\*[^*]+\*\*|(^|\n)-\s/

  const weekly = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'specialist' },
    competencyIds: [],
    artifact: { reportType: 'Недельный отчёт', periodStart: '2026-08-03', periodEnd: '2026-08-09', wins: [{ title: 'X', impact: 'Y' }], ideas: [{ title: 'Z', nextStep: 'W' }] },
  })
  assert.doesNotMatch(weekly.draftMarkdown, markdownPattern)

  const monthly = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: [],
    artifact: { reportType: 'Ежемесячный отчёт', periodStart: '2026-07-01', periodEnd: '2026-07-31', wins: [{ title: 'X', impact: 'Y', evidence: 'Z' }], ideas: [] },
  })
  assert.doesNotMatch(monthly.draftMarkdown, markdownPattern)

  const performance = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: ['content-marketing'],
    artifact: { reportType: 'Performance review', periodStart: '2026-01-01', periodEnd: '2026-06-30', wins: [{ title: 'X', impact: 'Y', evidence: 'Z', competencyIds: ['content-marketing'], competencyTitle: 'Контент-маркетинг' }], ideas: [] },
  })
  assert.doesNotMatch(performance.draftMarkdown, markdownPattern)

  const promotion = buildLocalGuidance('report_draft', {
    profile: { name: 'Мария', role: 'Digital Marketing Manager', market: 'Brazil', currentLevel: 'senior' },
    competencyIds: ['results-proactivity'],
    artifact: { reportType: 'Promotion case', periodStart: '2026-01-01', periodEnd: '2026-06-30', wins: [{ title: 'X', impact: 'Y', evidence: 'Z', competencyIds: ['results-proactivity'], competencyTitle: 'Ориентация на результат' }], ideas: [] },
  })
  assert.doesNotMatch(promotion.draftMarkdown, markdownPattern)
})
