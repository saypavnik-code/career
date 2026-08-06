export const STORAGE_KEY = 'escada:v4'
export const PREVIOUS_STORAGE_KEYS = ['escada:v3', 'career-os:v2', 'career-os:v1']
export const LEGACY_STORAGE_KEY = 'career-os:v1'
export const SCHEMA_VERSION = 4

const DAY_MS = 24 * 60 * 60 * 1000
const LEVEL_ORDER = ['specialist', 'senior', 'lead']

export function createId(prefix = 'item') {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now()}-${random}`
}

export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function normalizeText(value = '') {
  return String(value).trim().toLocaleLowerCase('ru-RU')
}

function tokenize(value = '') {
  return normalizeText(value)
    .replace(/[^a-zа-яё0-9]+/giu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4)
}

export function suggestCompetencyIds(text, competencies, keywordMap, limit = 3) {
  const haystack = normalizeText(text)
  if (!haystack) return []

  return competencies
    .map((competency) => {
      const keywords = keywordMap[competency.id] ?? []
      const score = keywords.reduce((total, keyword) => (
        haystack.includes(normalizeText(keyword)) ? total + Math.max(1, keyword.length / 5) : total
      ), 0)
      return { id: competency.id, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.id)
}

const LEVEL_PATTERNS = {
  specialist: [
    'подготов', 'собрат', 'обнов', 'опубликов', 'провер', 'напис', 'запуст', 'монитор', 'выполн', 'локализ', 'создат',
  ],
  senior: [
    'гипотез', 'эксперимент', 'оптимиз', 'проанализ', 'адаптир', 'управ', 'метрик', 'конверси', 'процесс', 'инициатив', 'a/b', 'пилот', 'причин', 'кросс',
  ],
  lead: [
    'стратег', 'методолог', 'стандарт', 'масштаб', 'команд', 'рынок', 'регион', 'портфел', 'бюджет', 'архитект', 'долгосроч', 'культур', 'прогноз', 'экосистем', 'направлен',
  ],
}

export function inferLevelSignal(text, fallback = 'specialist') {
  const haystack = normalizeText(text)
  if (!haystack) {
    return { level: fallback, reason: 'Уровень пока основан на текущем профиле: добавьте контекст и ход работы для более точной подсказки.' }
  }

  const scores = Object.fromEntries(LEVEL_ORDER.map((level) => [level, 0]))
  for (const [level, patterns] of Object.entries(LEVEL_PATTERNS)) {
    for (const pattern of patterns) {
      if (haystack.includes(pattern)) scores[level] += 1
    }
  }

  const winner = [...LEVEL_ORDER].sort((a, b) => scores[b] - scores[a] || LEVEL_ORDER.indexOf(b) - LEVEL_ORDER.indexOf(a))[0]
  if (scores[winner] === 0) {
    return { level: fallback, reason: 'Недостаточно текстовых сигналов для уверенного вывода; используем уровень профиля как нейтральную отправную точку.' }
  }

  const reasons = {
    specialist: 'Похоже на качественное исполнение, подготовку или запуск конкретного результата.',
    senior: 'В идее видны самостоятельная гипотеза, оптимизация процесса или управление измеримым результатом.',
    lead: 'Идея затрагивает стратегию, стандарты, масштабирование, команду или долгосрочное развитие направления.',
  }
  return { level: winner, reason: reasons[winner] }
}

function behaviorRef(competencyId, level, index) {
  return `${competencyId}:${level}:${index}`
}

export function parseBehaviorRef(ref) {
  const [competencyId, level, rawIndex] = String(ref).split(':')
  return { competencyId, level, index: Number(rawIndex) }
}

export function suggestBehaviorRefs(text, competencyIds, competencies, level, limit = 4) {
  const haystackTokens = new Set(tokenize(text))
  const candidates = []

  for (const competencyId of competencyIds ?? []) {
    const competency = (competencies ?? []).find((item) => item.id === competencyId)
    const signals = competency?.levels?.[level] ?? []
    signals.forEach((signal, index) => {
      const signalText = typeof signal === 'string' ? signal : signal.text
      const signalRef = typeof signal === 'string' ? behaviorRef(competencyId, level, index) : signal.id
      const signalTokens = tokenize(signalText)
      const overlap = signalTokens.reduce((total, token) => total + (haystackTokens.has(token) ? 1 : 0), 0)
      const score = overlap + (index === 0 ? 0.05 : 0)
      candidates.push({ ref: signalRef, score })
    })
  }

  const positive = candidates.filter((item) => item.score > 0.1)
  const source = positive.length ? positive : candidates.slice(0, Math.min(competencyIds?.length ?? 0, 2))
  return source.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.ref)
}

export function computeInsights(state) {
  const ideas = Array.isArray(state?.ideas) ? state.ideas : []
  const wins = Array.isArray(state?.wins) ? state.wins : []
  const reports = Array.isArray(state?.reports) ? state.reports : []
  const captures = Array.isArray(state?.captures) ? state.captures : []
  const activeIdeas = ideas.filter((idea) => idea.status !== 'archived' && idea.status !== 'won')
  const reportReadyWins = wins.filter((win) => win.reportReady !== false)
  const completedWork = ideas.flatMap((idea) => idea.workItems ?? []).filter((item) => item.status === 'done')

  const competencyCounts = new Map()
  for (const win of wins) {
    for (const id of win.competencyIds ?? []) {
      competencyCounts.set(id, (competencyCounts.get(id) ?? 0) + 1)
    }
  }

  const topCompetencies = [...competencyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ id, count }))

  return {
    captures: captures.length,
    activeIdeas: activeIdeas.length,
    exploredIdeas: ideas.filter((idea) => idea.status === 'exploring').length,
    wins: wins.length,
    reportReadyWins: reportReadyWins.length,
    reports: reports.length,
    completedWork: completedWork.length,
    topCompetencies,
  }
}

export function promoteIdeaToWin(idea, patch = {}) {
  if (!idea || !idea.id) throw new Error('A valid idea is required')
  const completedWork = (idea.workItems ?? []).filter((item) => item.status === 'done').map((item) => item.title)
  const recentNotes = (idea.notes ?? []).slice(-3).map((item) => item.text)
  const evidenceNotes = (idea.evidenceNotes ?? []).map((item) => item.text ?? item).filter(Boolean)
  return {
    id: patch.id ?? createId('win'),
    title: patch.title ?? idea.title,
    impact: patch.impact ?? '',
    evidence: patch.evidence ?? evidenceNotes.join('\n'),
    competencyIds: patch.competencyIds ?? idea.competencyIds ?? [],
    behaviorRefs: patch.behaviorRefs ?? idea.behaviorRefs ?? [],
    levelSignal: patch.levelSignal ?? idea.levelSignal ?? 'specialist',
    sourceIdeaId: idea.id,
    workSummary: patch.workSummary ?? completedWork,
    noteSummary: patch.noteSummary ?? recentNotes,
    date: patch.date ?? todayIso(),
    reportReady: patch.reportReady ?? true,
    createdAt: patch.createdAt ?? new Date().toISOString(),
  }
}

function inPeriod(date, start, end) {
  if (!date) return false
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

export function selectWinsForPeriod(wins, start, end) {
  return (wins ?? [])
    .filter((win) => win.reportReady !== false && inPeriod(win.date, start, end))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export function buildReportMarkdown({ profile, wins, ideas = [], competencies, periodLabel, nextFocus = '' }) {
  const safeWins = Array.isArray(wins) ? wins : []
  const ideaById = new Map((ideas ?? []).map((item) => [item.id, item]))
  const competencyById = new Map((competencies ?? []).map((item) => [item.id, item.shortTitle ?? item.title]))
  const title = `Отчёт о результатах — ${periodLabel}`
  const roleLine = [profile?.role, profile?.market].filter(Boolean).join(' · ')

  const impactLines = safeWins.length
    ? safeWins.map((win, index) => {
        const competenciesText = (win.competencyIds ?? [])
          .map((id) => competencyById.get(id))
          .filter(Boolean)
          .join(', ')
        const sourceIdea = win.sourceIdeaId ? ideaById.get(win.sourceIdeaId) : null
        const completedWork = win.workSummary?.length
          ? win.workSummary
          : (sourceIdea?.workItems ?? []).filter((item) => item.status === 'done').map((item) => item.title)
        const details = [
          win.impact ? `Влияние: ${win.impact}` : '',
          win.evidence ? `Доказательство: ${win.evidence}` : '',
          competenciesText ? `Связанные компетенции: ${competenciesText}` : '',
          win.levelSignal ? `Сигнал уровня: ${levelLabel(win.levelSignal)}` : '',
        ].filter(Boolean)
        const workBlock = completedWork?.length
          ? `\n   - Проделанная работа:\n${completedWork.map((item) => `     - ${item}`).join('\n')}`
          : ''
        return `${index + 1}. **${win.title}**\n${details.map((item) => `   - ${item}`).join('\n')}${workBlock}`
      }).join('\n\n')
    : 'За выбранный период wins пока не добавлены.'

  const competencyCounts = new Map()
  for (const win of safeWins) {
    for (const id of win.competencyIds ?? []) competencyCounts.set(id, (competencyCounts.get(id) ?? 0) + 1)
  }
  const signals = [...competencyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `- ${competencyById.get(id) ?? id}: ${count} подтверждён${count === 1 ? 'ный win' : 'ных wins'}`)
    .join('\n') || '- Недостаточно данных: добавьте компетенции к wins, когда связь очевидна.'

  return `# ${title}\n\n${profile?.name ? `**Сотрудник:** ${profile.name}\n` : ''}${roleLine ? `**Контекст:** ${roleLine}\n` : ''}\n## Краткое резюме\n\nЗа период зафиксировано ${safeWins.length} ${pluralizeRu(safeWins.length, 'результативное достижение', 'результативных достижения', 'результативных достижений')}. Ниже перечислены результаты, их влияние, доказательства и выполненная работа.\n\n## Основные wins\n\n${impactLines}\n\n## Сигналы развития компетенций\n\n${signals}\n\n## Следующий фокус\n\n${nextFocus || 'Определить 1–3 идеи, которые могут привести к следующему измеримому результату.'}\n`
}

function levelLabel(level) {
  return { specialist: 'Специалист', senior: 'Старший специалист', lead: 'Ведущий специалист' }[level] ?? level
}

export function pluralizeRu(value, one, few, many) {
  const n = Math.abs(Number(value)) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return many
  if (n1 > 1 && n1 < 5) return few
  if (n1 === 1) return one
  return many
}

export function computeProgress(state, competencies) {
  const ideas = Array.isArray(state?.ideas) ? state.ideas : []
  const wins = Array.isArray(state?.wins) ? state.wins : []
  const total = Math.max(1, competencies?.length ?? 0)
  const levelSets = Object.fromEntries(LEVEL_ORDER.map((level) => [level, new Set()]))
  const byCompetency = new Map((competencies ?? []).map((item) => [item.id, {
    competencyId: item.id,
    ideas: 0,
    wins: 0,
    completedWork: 0,
    highestLevel: null,
    behaviorRefs: new Set(),
  }]))

  function register(artifact, weight = 'idea') {
    const level = LEVEL_ORDER.includes(artifact.levelSignal) ? artifact.levelSignal : 'specialist'
    for (const competencyId of artifact.competencyIds ?? []) {
      levelSets[level].add(competencyId)
      const row = byCompetency.get(competencyId)
      if (!row) continue
      if (weight === 'win') row.wins += 1
      else row.ideas += 1
      row.completedWork += (artifact.workItems ?? []).filter((item) => item.status === 'done').length
      if (!row.highestLevel || LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(row.highestLevel)) row.highestLevel = level
      for (const ref of artifact.behaviorRefs ?? []) row.behaviorRefs.add(ref)
    }
  }

  ideas.forEach((idea) => register(idea, 'idea'))
  wins.forEach((win) => register(win, 'win'))

  const weighted = { specialist: 0, senior: 0, lead: 0 }
  for (const idea of ideas) weighted[idea.levelSignal ?? 'specialist'] += 1
  for (const win of wins) weighted[win.levelSignal ?? 'specialist'] += 3
  const evidenceCount = ideas.length + wins.length * 3
  const inferredLevel = evidenceCount < 3
    ? state?.profile?.currentLevel ?? 'specialist'
    : [...LEVEL_ORDER].sort((a, b) => weighted[b] - weighted[a] || LEVEL_ORDER.indexOf(b) - LEVEL_ORDER.indexOf(a))[0]
  const confidence = evidenceCount >= 12 ? 'high' : evidenceCount >= 5 ? 'medium' : 'low'

  return {
    coverage: Object.fromEntries(LEVEL_ORDER.map((level) => [level, Math.round(levelSets[level].size / total * 100)])),
    coveredCounts: Object.fromEntries(LEVEL_ORDER.map((level) => [level, levelSets[level].size])),
    inferredLevel,
    confidence,
    evidenceCount,
    competencies: [...byCompetency.values()].map((row) => ({ ...row, behaviorRefs: [...row.behaviorRefs] })),
  }
}

export function buildCoachNotes(state, competencies, now = new Date()) {
  const ideas = Array.isArray(state?.ideas) ? state.ideas : []
  const wins = Array.isArray(state?.wins) ? state.wins : []
  const profileLevel = state?.profile?.currentLevel ?? 'specialist'
  const notes = []

  const nextLevelIdea = ideas.find((idea) => (
    idea.status !== 'won' && idea.status !== 'archived' && LEVEL_ORDER.indexOf(idea.levelSignal ?? 'specialist') > LEVEL_ORDER.indexOf(profileLevel)
  ))
  if (nextLevelIdea) {
    notes.push({
      kind: 'level',
      title: `Сигнал следующего уровня: ${levelLabel(nextLevelIdea.levelSignal)}`,
      text: `Идея «${nextLevelIdea.title}» выходит за рамки текущего уровня профиля. ${nextLevelIdea.levelReason ?? ''}`.trim(),
      ideaId: nextLevelIdea.id,
    })
  }

  const readyIdea = ideas.find((idea) => idea.status !== 'won' && (idea.workItems ?? []).filter((item) => item.status === 'done').length >= 2)
  if (readyIdea) {
    notes.push({
      kind: 'win',
      title: 'Похоже, здесь уже формируется win',
      text: `В идее «${readyIdea.title}» завершено несколько этапов работы. Проверьте, появилось ли изменение, которое стоит зафиксировать.`,
      ideaId: readyIdea.id,
    })
  }

  const staleIdea = ideas.find((idea) => {
    if (idea.status !== 'exploring') return false
    const updated = new Date(idea.updatedAt ?? idea.createdAt ?? now).getTime()
    return now.getTime() - updated > 14 * DAY_MS
  })
  if (staleIdea) {
    notes.push({
      kind: 'stale',
      title: 'Идея давно без движения',
      text: `«${staleIdea.title}» не обновлялась больше двух недель. Добавьте следующий этап, перенесите в архив или сформулируйте win.`,
      ideaId: staleIdea.id,
    })
  }

  const weakWin = wins.find((win) => !win.evidence?.trim())
  if (weakWin) {
    notes.push({
      kind: 'evidence',
      title: 'Усилите доказательство результата',
      text: `У win «${weakWin.title}» пока нет артефакта, метрики или обратной связи. Это сделает будущий отчёт убедительнее.`,
      winId: weakWin.id,
    })
  }

  if (!notes.length) {
    const progress = computeProgress(state, competencies)
    notes.push({
      kind: 'reflection',
      title: `Текущий профиль сигналов: ${levelLabel(progress.inferredLevel)}`,
      text: 'Это не формальная оценка. Она основана только на записанных идеях, выполненной работе и wins — добавляйте контекст, чтобы подсказки становились точнее.',
    })
  }
  return notes.slice(0, 3)
}

export function createDefaultState(now = new Date()) {
  const end = new Date(now.getTime() + 90 * DAY_MS)
  return {
    version: SCHEMA_VERSION,
    onboardingComplete: false,
    profile: {
      name: '',
      role: 'Digital Marketing Specialist',
      market: '',
      currentLevel: 'specialist',
      reportingRhythm: 'monthly',
      cycleEnd: end.toISOString().slice(0, 10),
    },
    captures: [],
    ideas: [],
    wins: [],
    reports: [],
  }
}

export function demoState(now = new Date()) {
  const base = createDefaultState(now)
  const day = (offset) => new Date(now.getTime() - offset * DAY_MS).toISOString().slice(0, 10)
  return {
    ...base,
    onboardingComplete: true,
    profile: {
      ...base.profile,
      name: 'Павел',
      role: 'Digital Marketing Manager',
      market: 'Бразилия',
      currentLevel: 'senior',
      reportingRhythm: 'monthly',
    },
    captures: [
      { id: 'capture-demo-1', text: 'Проверить, можно ли превратить данные исследования в серию PR-углов', suggestedKind: 'idea', status: 'unclassified', createdAt: new Date(now.getTime() - DAY_MS).toISOString() },
    ],
    ideas: [
      {
        id: 'idea-demo-1',
        title: 'Собрать PR-угол вокруг собственных данных для PME',
        details: 'Найти неожиданный вывод в исследовании и превратить его в локальный медиапитч.',
        nextStep: 'Проверить интерес через пять журналистов.',
        status: 'exploring',
        competencyIds: ['strategic-thinking', 'pr-reputation', 'analytics'],
        levelSignal: 'senior',
        levelReason: 'Есть самостоятельная гипотеза, проверка через рынок и измеримый результат.',
        behaviorRefs: ['strategic-thinking:senior:1', 'pr-reputation:senior:1'],
        workItems: [
          { id: 'work-demo-1', title: 'Выбрать 3 сильных факта исследования', status: 'done', createdAt: new Date(now.getTime() - 5 * DAY_MS).toISOString(), completedAt: new Date(now.getTime() - 4 * DAY_MS).toISOString() },
          { id: 'work-demo-2', title: 'Собрать список из 15 релевантных СМИ', status: 'doing', createdAt: new Date(now.getTime() - 3 * DAY_MS).toISOString(), completedAt: null },
          { id: 'work-demo-3', title: 'Провести тестовый outreach', status: 'backlog', createdAt: new Date(now.getTime() - 2 * DAY_MS).toISOString(), completedAt: null },
        ],
        notes: [{ id: 'note-demo-1', text: 'Лучше работает угол про потерю времени, а не про удалённую работу как таковую.', createdAt: new Date(now.getTime() - 2 * DAY_MS).toISOString() }],
        evidenceNotes: [],
        createdAt: new Date(now.getTime() - 5 * DAY_MS).toISOString(),
        updatedAt: new Date(now.getTime() - 2 * DAY_MS).toISOString(),
      },
      {
        id: 'idea-demo-2',
        title: 'Автоматизировать еженедельный разбор поисковых запросов',
        details: 'Собрать лёгкий workflow, который группирует новые запросы по намерению.',
        nextStep: 'Сделать прототип на одном рекламном аккаунте.',
        status: 'inbox',
        competencyIds: ['analytics', 'paid-acquisition'],
        levelSignal: 'senior',
        levelReason: 'Идея про оптимизацию процесса и самостоятельный эксперимент.',
        behaviorRefs: ['analytics:senior:0'],
        workItems: [],
        notes: [],
        evidenceNotes: [],
        createdAt: new Date(now.getTime() - 1 * DAY_MS).toISOString(),
        updatedAt: new Date(now.getTime() - 1 * DAY_MS).toISOString(),
      },
    ],
    wins: [
      {
        id: 'win-demo-1',
        title: 'Перестроил структуру CRM-кампаний по намерению пользователя',
        impact: 'Упростил управление группами и создал основу для более точной оптимизации CPA и retention.',
        evidence: 'Новая структура кампаний, список минус-слов и план A/B-тестов согласованы с командой.',
        metrics: '',
        confirmedBy: 'Команда онлайн-маркетинга',
        competencyIds: ['paid-acquisition', 'analytics', 'ownership'],
        behaviorRefs: ['paid-acquisition:senior:0', 'analytics:senior:1'],
        levelSignal: 'senior',
        sourceIdeaId: null,
        workSummary: ['Провёл аудит поисковых запросов', 'Разделил кампании по намерению', 'Собрал план A/B-тестов'],
        noteSummary: [],
        date: day(12),
        reportReady: true,
        createdAt: new Date(now.getTime() - 12 * DAY_MS).toISOString(),
      },
      {
        id: 'win-demo-2',
        title: 'Сформировал региональные правила LinkedIn-контента',
        impact: 'Команда получила единый шаблон hook, структуры, CTA и alt-text для рынка Бразилии.',
        evidence: 'Гайд используется в регулярном контент-плане и уменьшает число редакторских итераций.',
        metrics: '',
        confirmedBy: 'Контент-команда',
        competencyIds: ['content-marketing', 'smm-community', 'intercultural'],
        behaviorRefs: ['content-marketing:lead:1'],
        levelSignal: 'lead',
        sourceIdeaId: null,
        workSummary: ['Собрал лучшие практики', 'Провёл тест форматов', 'Оформил единый гайд'],
        noteSummary: [],
        date: day(28),
        reportReady: true,
        createdAt: new Date(now.getTime() - 28 * DAY_MS).toISOString(),
      },
    ],
  }
}

function normalizeCapture(capture) {
  const classification = classifyCapture(capture?.text ?? '')
  return {
    id: capture?.id ?? createId('capture'),
    text: capture?.text ?? '',
    suggestedKind: capture?.suggestedKind ?? classification.kind,
    status: capture?.status ?? 'unclassified',
    createdAt: capture?.createdAt ?? new Date().toISOString(),
  }
}

function normalizeIdea(idea, fallbackLevel = 'specialist') {
  const text = `${idea?.title ?? ''} ${idea?.details ?? ''} ${idea?.nextStep ?? ''}`
  const inferred = inferLevelSignal(text, fallbackLevel)
  return {
    id: idea?.id ?? createId('idea'),
    title: idea?.title ?? 'Импортированная идея',
    details: idea?.details ?? '',
    nextStep: idea?.nextStep ?? '',
    status: idea?.status ?? 'inbox',
    competencyIds: Array.isArray(idea?.competencyIds) ? idea.competencyIds : [],
    levelSignal: idea?.levelSignal ?? inferred.level,
    levelReason: idea?.levelReason ?? inferred.reason,
    behaviorRefs: Array.isArray(idea?.behaviorRefs) ? idea.behaviorRefs : [],
    workItems: Array.isArray(idea?.workItems) ? idea.workItems : [],
    notes: Array.isArray(idea?.notes) ? idea.notes : [],
    evidenceNotes: Array.isArray(idea?.evidenceNotes) ? idea.evidenceNotes : [],
    createdAt: idea?.createdAt ?? new Date().toISOString(),
    updatedAt: idea?.updatedAt ?? new Date().toISOString(),
  }
}

function normalizeWin(win) {
  return {
    id: win?.id ?? createId('win'),
    title: win?.title ?? 'Импортированный win',
    impact: win?.impact ?? '',
    evidence: win?.evidence ?? '',
    metrics: win?.metrics ?? '',
    confirmedBy: win?.confirmedBy ?? '',
    competencyIds: Array.isArray(win?.competencyIds) ? win.competencyIds : [],
    behaviorRefs: Array.isArray(win?.behaviorRefs) ? win.behaviorRefs : [],
    levelSignal: win?.levelSignal ?? 'specialist',
    sourceIdeaId: win?.sourceIdeaId ?? null,
    workSummary: Array.isArray(win?.workSummary) ? win.workSummary : [],
    noteSummary: Array.isArray(win?.noteSummary) ? win.noteSummary : [],
    date: win?.date ?? todayIso(),
    reportReady: win?.reportReady !== false,
    createdAt: win?.createdAt ?? new Date().toISOString(),
  }
}

function migrateLegacyTask(task, fallbackLevel) {
  return normalizeIdea({
    id: `legacy-${task.id ?? createId('idea')}`,
    title: task.title ?? 'Импортированная идея',
    details: task.potentialWin ? `Ожидаемый результат: ${task.potentialWin}` : '',
    nextStep: task.due ? `Срок из предыдущей версии: ${task.due}` : '',
    status: task.status === 'done' ? 'won' : task.status === 'in_progress' ? 'exploring' : 'inbox',
    competencyIds: task.competencyId ? [task.competencyId] : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, fallbackLevel)
}

export function migrateState(raw, fallback = createDefaultState()) {
  if (!raw || typeof raw !== 'object') return fallback
  const fallbackLevel = raw?.profile?.currentLevel ?? fallback.profile.currentLevel

  if (Array.isArray(raw.ideas) && Array.isArray(raw.wins)) {
    return {
      ...fallback,
      ...raw,
      version: SCHEMA_VERSION,
      profile: { ...fallback.profile, ...(raw.profile ?? {}), currentLevel: fallbackLevel },
      captures: Array.isArray(raw.captures) ? raw.captures.map(normalizeCapture) : [],
      ideas: raw.ideas.map((idea) => normalizeIdea(idea, fallbackLevel)),
      wins: raw.wins.map(normalizeWin),
      reports: Array.isArray(raw.reports) ? raw.reports : [],
    }
  }

  const legacyTasks = Array.isArray(raw.tasks) ? raw.tasks : []
  const legacyWins = Array.isArray(raw.wins) ? raw.wins : []
  return {
    ...fallback,
    onboardingComplete: Boolean(raw.profile),
    profile: { ...fallback.profile, ...(raw.profile ?? {}), currentLevel: fallbackLevel },
    captures: [],
    ideas: legacyTasks.map((task) => migrateLegacyTask(task, fallbackLevel)),
    wins: legacyWins.map(normalizeWin),
    reports: [],
  }
}


const RESULT_PATTERNS = ['получил', 'получила', 'вырос', 'снизил', 'снизила', 'запустил', 'запустила', 'согласован', 'опубликован', 'завершил', 'завершила', 'результат', 'достиг', 'достигла']
const IDEA_PATTERNS = ['идея', 'проверить', 'попробовать', 'гипотез', 'можно ли', 'предлагаю', 'улучшить', 'создать', 'сделать', 'исследовать']

export function classifyCapture(text) {
  const value = normalizeText(text)
  const resultScore = RESULT_PATTERNS.reduce((sum, item) => sum + (value.includes(item) ? 1 : 0), 0)
  const ideaScore = IDEA_PATTERNS.reduce((sum, item) => sum + (value.includes(item) ? 1 : 0), 0)
  if (resultScore > ideaScore && resultScore > 0) return { kind: 'win', reason: 'В записи есть формулировка завершённого результата.' }
  if (ideaScore > 0) return { kind: 'idea', reason: 'В записи есть гипотеза, возможность или действие для проверки.' }
  return { kind: 'note', reason: 'Запись сохранена как свободная заметка — тип можно выбрать позже.' }
}

export function createCapture(text, now = new Date()) {
  const classification = classifyCapture(text)
  return { id: createId('capture'), text: String(text).trim(), suggestedKind: classification.kind, status: 'unclassified', createdAt: now.toISOString() }
}

export function captureToIdea(capture, currentLevel = 'specialist') {
  const inferred = inferLevelSignal(capture?.text ?? '', currentLevel)
  const now = new Date().toISOString()
  return {
    id: createId('idea'), title: capture?.text ?? '', details: '', nextStep: '', status: 'inbox', competencyIds: [],
    levelSignal: inferred.level, levelReason: inferred.reason, behaviorRefs: [], workItems: [], notes: [], evidenceNotes: [],
    createdAt: now, updatedAt: now,
  }
}

export function captureToWinDraft(capture) {
  return { sourceIdeaId: null, title: capture?.text ?? '', impact: '', evidence: '', metrics: '', confirmedBy: '', date: todayIso(), competencyIds: [], behaviorRefs: [], levelSignal: 'specialist', workSummary: [], noteSummary: [], reportReady: true }
}

export function winGapHints(win) {
  const hints = []
  if (!String(win?.impact ?? '').trim()) hints.push('Добавьте, почему результат важен для бизнеса, команды, пользователя или процесса.')
  if (!String(win?.evidence ?? '').trim()) hints.push('Добавьте доказательство: артефакт, ссылку, обратную связь, метрику или принятое решение.')
  if (!String(win?.metrics ?? '').trim()) hints.push('Если результат изменил показатель, сохраните исходное и итоговое значение. Поле необязательное.')
  return hints.slice(0, 3)
}

export function deleteWin(state, winId) {
  const wins = Array.isArray(state?.wins) ? state.wins : []
  const reports = Array.isArray(state?.reports) ? state.reports : []
  return {
    ...state,
    wins: wins.filter((item) => item.id !== winId),
    reports: reports.map((report) => (
      report.winIds?.includes(winId)
        ? { ...report, winIds: report.winIds.filter((id) => id !== winId) }
        : report
    )),
  }
}

export function computeGrowthPath(state, competencies) {
  const profileLevel = state?.profile?.currentLevel ?? 'specialist'
  const targetLevel = profileLevel === 'specialist' ? 'senior' : profileLevel === 'senior' ? 'lead' : null
  const artifacts = [...(state?.ideas ?? []), ...(state?.wins ?? [])]
  const observed = new Set(artifacts.flatMap((item) => item.behaviorRefs ?? []))
  const competencyCounts = new Map()
  for (const item of artifacts) for (const id of item.competencyIds ?? []) competencyCounts.set(id, (competencyCounts.get(id) ?? 0) + (item.impact || item.evidence ? 2 : 1))
  const sorted = [...competencyCounts.entries()].sort((a, b) => b[1] - a[1])
  const strongCompetencies = sorted.slice(0, 3).map(([id]) => competencies.find((item) => item.id === id)).filter(Boolean)
  const weakCompetencies = competencies.filter((item) => !competencyCounts.has(item.id)).slice(0, 3)
  const directions = (targetLevel ? (strongCompetencies.length ? strongCompetencies : competencies.slice(0, 3)) : strongCompetencies)
    .slice(0, 3)
    .map((competency) => {
      const criteria = competency.levels[targetLevel ?? profileLevel] ?? []
      const nextCriterion = criteria.find((criterion) => !observed.has(typeof criterion === 'string' ? criterion : criterion.id)) ?? criteria[0]
      return { competencyId: competency.id, title: competency.shortTitle, criterion: typeof nextCriterion === 'string' ? nextCriterion : nextCriterion?.text ?? '' }
    })
  return {
    currentLevel: profileLevel,
    nextLevel: targetLevel,
    strongSignals: strongCompetencies.map((item) => ({ id: item.id, title: item.shortTitle, count: competencyCounts.get(item.id) ?? 0 })),
    underdocumented: weakCompetencies.map((item) => ({ id: item.id, title: item.shortTitle })),
    directions,
    evidenceCount: (state?.wins ?? []).filter((win) => String(win.evidence ?? '').trim()).length,
  }
}
