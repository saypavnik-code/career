export const STORAGE_KEY = 'career-os:v2'
export const LEGACY_STORAGE_KEY = 'career-os:v1'
export const SCHEMA_VERSION = 2

const DAY_MS = 24 * 60 * 60 * 1000

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

export function computeInsights(state) {
  const ideas = Array.isArray(state?.ideas) ? state.ideas : []
  const wins = Array.isArray(state?.wins) ? state.wins : []
  const reports = Array.isArray(state?.reports) ? state.reports : []
  const activeIdeas = ideas.filter((idea) => idea.status !== 'archived' && idea.status !== 'won')
  const reportReadyWins = wins.filter((win) => win.reportReady !== false)

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
    activeIdeas: activeIdeas.length,
    exploredIdeas: ideas.filter((idea) => idea.status === 'exploring').length,
    wins: wins.length,
    reportReadyWins: reportReadyWins.length,
    reports: reports.length,
    topCompetencies,
  }
}

export function promoteIdeaToWin(idea, patch = {}) {
  if (!idea || !idea.id) throw new Error('A valid idea is required')
  return {
    id: patch.id ?? createId('win'),
    title: patch.title ?? idea.title,
    impact: patch.impact ?? '',
    evidence: patch.evidence ?? '',
    competencyIds: patch.competencyIds ?? idea.competencyIds ?? [],
    sourceIdeaId: idea.id,
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

export function buildReportMarkdown({ profile, wins, competencies, periodLabel, nextFocus = '' }) {
  const safeWins = Array.isArray(wins) ? wins : []
  const competencyById = new Map((competencies ?? []).map((item) => [item.id, item.shortTitle ?? item.title]))
  const title = `Отчёт о результатах — ${periodLabel}`
  const roleLine = [profile?.role, profile?.market].filter(Boolean).join(' · ')

  const impactLines = safeWins.length
    ? safeWins.map((win, index) => {
        const competenciesText = (win.competencyIds ?? [])
          .map((id) => competencyById.get(id))
          .filter(Boolean)
          .join(', ')
        const details = [
          win.impact ? `Влияние: ${win.impact}` : '',
          win.evidence ? `Доказательство: ${win.evidence}` : '',
          competenciesText ? `Связанные компетенции: ${competenciesText}` : '',
        ].filter(Boolean)
        return `${index + 1}. **${win.title}**\n${details.map((item) => `   - ${item}`).join('\n')}`
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

  return `# ${title}\n\n${profile?.name ? `**Сотрудник:** ${profile.name}\n` : ''}${roleLine ? `**Контекст:** ${roleLine}\n` : ''}\n## Краткое резюме\n\nЗа период зафиксировано ${safeWins.length} ${pluralizeRu(safeWins.length, 'результативное достижение', 'результативных достижения', 'результативных достижений')}. Ниже перечислены результаты, их влияние и доказательства.\n\n## Основные wins\n\n${impactLines}\n\n## Сигналы развития компетенций\n\n${signals}\n\n## Следующий фокус\n\n${nextFocus || 'Определить 1–3 идеи, которые могут привести к следующему измеримому результату.'}\n`
}

export function pluralizeRu(value, one, few, many) {
  const n = Math.abs(Number(value)) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return many
  if (n1 > 1 && n1 < 5) return few
  if (n1 === 1) return one
  return many
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
      reportingRhythm: 'monthly',
      cycleEnd: end.toISOString().slice(0, 10),
    },
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
      reportingRhythm: 'monthly',
    },
    ideas: [
      {
        id: 'idea-demo-1',
        title: 'Собрать PR-угол вокруг собственных данных для PME',
        details: 'Найти неожиданный вывод в исследовании и превратить его в локальный медиапитч.',
        nextStep: 'Выбрать 3 факта и проверить интерес через 5 журналистов.',
        status: 'exploring',
        competencyIds: ['strategic-thinking', 'pr-reputation', 'analytics'],
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
        competencyIds: ['paid-acquisition', 'analytics', 'ownership'],
        sourceIdeaId: null,
        date: day(12),
        reportReady: true,
        createdAt: new Date(now.getTime() - 12 * DAY_MS).toISOString(),
      },
      {
        id: 'win-demo-2',
        title: 'Сформировал региональные правила LinkedIn-контента',
        impact: 'Команда получила единый шаблон hook, структуры, CTA и alt-text для рынка Бразилии.',
        evidence: 'Гайд используется в регулярном контент-плане и уменьшает число редакторских итераций.',
        competencyIds: ['content-marketing', 'smm-community', 'intercultural'],
        sourceIdeaId: null,
        date: day(28),
        reportReady: true,
        createdAt: new Date(now.getTime() - 28 * DAY_MS).toISOString(),
      },
    ],
  }
}

function migrateLegacyTask(task) {
  return {
    id: `legacy-${task.id ?? createId('idea')}`,
    title: task.title ?? 'Импортированная идея',
    details: task.potentialWin ? `Ожидаемый результат: ${task.potentialWin}` : '',
    nextStep: task.due ? `Срок из предыдущей версии: ${task.due}` : '',
    status: task.status === 'done' ? 'won' : task.status === 'in_progress' ? 'exploring' : 'inbox',
    competencyIds: task.competencyId ? [task.competencyId] : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function migrateState(raw, fallback = createDefaultState()) {
  if (!raw || typeof raw !== 'object') return fallback
  if (raw.version === SCHEMA_VERSION && Array.isArray(raw.ideas) && Array.isArray(raw.wins)) {
    return {
      ...fallback,
      ...raw,
      profile: { ...fallback.profile, ...(raw.profile ?? {}) },
      ideas: raw.ideas,
      wins: raw.wins,
      reports: Array.isArray(raw.reports) ? raw.reports : [],
    }
  }

  const legacyTasks = Array.isArray(raw.tasks) ? raw.tasks : []
  const legacyWins = Array.isArray(raw.wins) ? raw.wins : []
  return {
    ...fallback,
    onboardingComplete: Boolean(raw.profile),
    profile: { ...fallback.profile, ...(raw.profile ?? {}) },
    ideas: legacyTasks.map(migrateLegacyTask),
    wins: legacyWins.map((win) => ({
      id: win.id ?? createId('win'),
      title: win.title ?? 'Импортированный win',
      impact: win.impact ?? '',
      evidence: win.evidence ?? '',
      competencyIds: win.competencyIds ?? [],
      sourceIdeaId: null,
      date: win.date ?? todayIso(),
      reportReady: true,
      createdAt: new Date().toISOString(),
    })),
    reports: [],
  }
}
