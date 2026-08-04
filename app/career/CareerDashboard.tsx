'use client'

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import styles from './career.module.css'
import {
  Competency,
  LevelKey,
  competencies,
  competencyKeywords,
  levelLabels,
} from './career-data'
import {
  PREVIOUS_STORAGE_KEYS,
  STORAGE_KEY,
  buildCoachNotes,
  buildReportMarkdown,
  computeInsights,
  computeProgress,
  createDefaultState,
  createId,
  demoState,
  inferLevelSignal,
  migrateState,
  parseBehaviorRef,
  promoteIdeaToWin,
  selectWinsForPeriod,
  suggestBehaviorRefs,
  suggestCompetencyIds,
  todayIso,
} from './career-core.mjs'

type View = 'today' | 'ideas' | 'wins' | 'reports' | 'competencies' | 'settings'
type IdeaStatus = 'inbox' | 'exploring' | 'won' | 'archived'
type WorkStatus = 'backlog' | 'doing' | 'done'
type ReportingRhythm = 'monthly' | 'quarterly' | 'half-year'
type CompetencyTab = 'progress' | 'catalog'

interface Profile {
  name: string
  role: string
  market: string
  currentLevel: LevelKey
  reportingRhythm: ReportingRhythm
  cycleEnd: string
}

interface WorkItem {
  id: string
  title: string
  status: WorkStatus
  createdAt: string
  completedAt: string | null
}

interface IdeaNote {
  id: string
  text: string
  createdAt: string
}

interface Idea {
  id: string
  title: string
  details: string
  nextStep: string
  status: IdeaStatus
  competencyIds: string[]
  levelSignal: LevelKey
  levelReason: string
  behaviorRefs: string[]
  workItems: WorkItem[]
  notes: IdeaNote[]
  createdAt: string
  updatedAt: string
}

interface Win {
  id: string
  title: string
  impact: string
  evidence: string
  competencyIds: string[]
  behaviorRefs: string[]
  levelSignal: LevelKey
  sourceIdeaId: string | null
  workSummary: string[]
  noteSummary: string[]
  date: string
  reportReady: boolean
  createdAt: string
}

interface Report {
  id: string
  title: string
  periodStart: string
  periodEnd: string
  winIds: string[]
  content: string
  createdAt: string
}

interface CareerState {
  version: number
  onboardingComplete: boolean
  profile: Profile
  ideas: Idea[]
  wins: Win[]
  reports: Report[]
}

interface WinDraft {
  id?: string
  sourceIdeaId: string | null
  title: string
  impact: string
  evidence: string
  date: string
  competencyIds: string[]
  behaviorRefs: string[]
  levelSignal: LevelKey
  workSummary: string[]
  noteSummary: string[]
  reportReady: boolean
}

interface ProgressRow {
  competencyId: string
  ideas: number
  wins: number
  completedWork: number
  highestLevel: LevelKey | null
  behaviorRefs: string[]
}

interface ProgressResult {
  coverage: Record<LevelKey, number>
  coveredCounts: Record<LevelKey, number>
  inferredLevel: LevelKey
  confidence: 'low' | 'medium' | 'high'
  evidenceCount: number
  competencies: ProgressRow[]
}

interface CoachNote {
  kind: string
  title: string
  text: string
  ideaId?: string
  winId?: string
}

const navItems: Array<{ id: View; label: string; caption: string; icon: string }> = [
  { id: 'today', label: 'Сегодня', caption: 'Фокус и навигатор', icon: '◉' },
  { id: 'ideas', label: 'Идеи', caption: 'От мысли к работе', icon: '✦' },
  { id: 'wins', label: 'Wins', caption: 'Результаты и доказательства', icon: '◆' },
  { id: 'reports', label: 'Отчёты', caption: 'Карьерный нарратив', icon: '▤' },
  { id: 'competencies', label: 'Компетенции', caption: 'Подсказки и прогресс', icon: '⌁' },
  { id: 'settings', label: 'Настройки', caption: 'Профиль и данные', icon: '⚙' },
]

const statusLabels: Record<IdeaStatus, string> = {
  inbox: 'Входящие',
  exploring: 'В работе',
  won: 'Стала win',
  archived: 'Архив',
}

const workStatusLabels: Record<WorkStatus, string> = {
  backlog: 'План',
  doing: 'В работе',
  done: 'Готово',
}

const emptyWin = (): WinDraft => ({
  sourceIdeaId: null,
  title: '',
  impact: '',
  evidence: '',
  date: todayIso(),
  competencyIds: [],
  behaviorRefs: [],
  levelSignal: 'specialist',
  workSummary: [],
  noteSummary: [],
  reportReady: true,
})

function asCareerState(value: Record<string, unknown>): CareerState {
  return value as unknown as CareerState
}

function competencyById(id: string) {
  return competencies.find((item) => item.id === id)
}

function formatDate(value: string) {
  if (!value) return 'Без даты'
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function dateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function safeJsonParse(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

function newIdea(title = '', currentLevel: LevelKey = 'specialist'): Idea {
  const now = new Date().toISOString()
  const inferred = inferLevelSignal(title, currentLevel) as { level: LevelKey; reason: string }
  return {
    id: createId('idea'),
    title,
    details: '',
    nextStep: '',
    status: 'inbox',
    competencyIds: title ? suggestCompetencyIds(title, competencies, competencyKeywords) : [],
    levelSignal: inferred.level,
    levelReason: inferred.reason,
    behaviorRefs: [],
    workItems: [],
    notes: [],
    createdAt: now,
    updatedAt: now,
  }
}

function behaviorLabel(ref: string) {
  const parsed = parseBehaviorRef(ref)
  const competency = competencyById(parsed.competencyId)
  const level = parsed.level as LevelKey
  return competency?.levels[level]?.[parsed.index] ?? ref
}

function LadderLogo({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? styles.logoSvgCompact : styles.logoSvg} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 36h9V27h9V18h14" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function CareerDashboard() {
  const [view, setView] = useState<View>('today')
  const [state, setState] = useState<CareerState>(() => asCareerState(createDefaultState()))
  const [hydrated, setHydrated] = useState(false)
  const [quickIdea, setQuickIdea] = useState('')
  const [ideaDraft, setIdeaDraft] = useState<Idea | null>(null)
  const [winDraft, setWinDraft] = useState<WinDraft | null>(null)
  const [notice, setNotice] = useState('')
  const [ideaFilter, setIdeaFilter] = useState<'all' | IdeaStatus>('all')
  const [competencyQuery, setCompetencyQuery] = useState('')
  const [competencyDomain, setCompetencyDomain] = useState<'all' | Competency['domain']>('all')
  const [competencyTab, setCompetencyTab] = useState<CompetencyTab>('progress')
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null)
  const [periodStart, setPeriodStart] = useState(dateDaysAgo(90))
  const [periodEnd, setPeriodEnd] = useState(todayIso())
  const [selectedWinIds, setSelectedWinIds] = useState<string[]>([])
  const [nextFocus, setNextFocus] = useState('')
  const [reportText, setReportText] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const current = safeJsonParse(window.localStorage.getItem(STORAGE_KEY))
    const previous = PREVIOUS_STORAGE_KEYS
      .map((key) => safeJsonParse(window.localStorage.getItem(key)))
      .find(Boolean) ?? null
    setState(asCareerState(migrateState(current ?? previous, createDefaultState())))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [hydrated, state])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const insights = useMemo(() => computeInsights(state as unknown as Record<string, unknown>), [state])
  const progress = useMemo(() => computeProgress(state as unknown as Record<string, unknown>, competencies) as unknown as ProgressResult, [state])
  const coachNotes = useMemo(() => buildCoachNotes(state as unknown as Record<string, unknown>, competencies) as unknown as CoachNote[], [state])
  const filteredIdeas = useMemo(
    () => state.ideas.filter((idea) => ideaFilter === 'all' || idea.status === ideaFilter),
    [ideaFilter, state.ideas],
  )
  const filteredCompetencies = useMemo(() => {
    const query = competencyQuery.trim().toLocaleLowerCase('ru-RU')
    return competencies.filter((item) => {
      const domainMatches = competencyDomain === 'all' || item.domain === competencyDomain
      const queryMatches = !query || `${item.title} ${item.summary}`.toLocaleLowerCase('ru-RU').includes(query)
      return domainMatches && queryMatches
    })
  }, [competencyDomain, competencyQuery])
  const winsInPeriod = useMemo(
    () => selectWinsForPeriod(state.wins, periodStart, periodEnd) as Win[],
    [periodEnd, periodStart, state.wins],
  )
  const activeIdeas = useMemo(
    () => state.ideas.filter((idea) => idea.status === 'inbox' || idea.status === 'exploring').slice(0, 4),
    [state.ideas],
  )
  const recentWins = useMemo(
    () => [...state.wins].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [state.wins],
  )

  function updateState(updater: (current: CareerState) => CareerState) {
    setState((current) => updater(current))
  }

  function completeOnboarding(profile: Profile) {
    updateState((current) => ({ ...current, onboardingComplete: true, profile }))
    setNotice('Эскада готова к работе')
  }

  function openDemo() {
    setState(asCareerState(demoState()))
    setNotice('Демо-данные загружены')
  }

  function submitQuickIdea(event: FormEvent) {
    event.preventDefault()
    const title = quickIdea.trim()
    if (!title) return
    const idea = newIdea(title, state.profile.currentLevel)
    updateState((current) => ({ ...current, ideas: [idea, ...current.ideas] }))
    setQuickIdea('')
    setNotice('Идея сохранена. Откройте её, чтобы развернуть работу.')
  }

  function saveIdea(draft: Idea, close = true) {
    const now = new Date().toISOString()
    const text = `${draft.title} ${draft.details} ${draft.nextStep} ${(draft.workItems ?? []).map((item) => item.title).join(' ')} ${(draft.notes ?? []).map((item) => item.text).join(' ')}`
    const competencyIds = draft.competencyIds.length
      ? draft.competencyIds
      : suggestCompetencyIds(text, competencies, competencyKeywords)
    const inferred = inferLevelSignal(text, state.profile.currentLevel) as { level: LevelKey; reason: string }
    const levelSignal = draft.levelSignal ?? inferred.level
    const behaviorRefs = draft.behaviorRefs.length
      ? draft.behaviorRefs
      : suggestBehaviorRefs(text, competencyIds, competencies, levelSignal)
    const idea = {
      ...draft,
      competencyIds,
      levelSignal,
      levelReason: draft.levelReason || inferred.reason,
      behaviorRefs,
      updatedAt: now,
    }

    updateState((current) => {
      const exists = current.ideas.some((item) => item.id === idea.id)
      return { ...current, ideas: exists ? current.ideas.map((item) => item.id === idea.id ? idea : item) : [idea, ...current.ideas] }
    })
    if (close) setIdeaDraft(null)
    else setIdeaDraft(idea)
    setNotice('Идея и ход работы сохранены')
    return idea
  }

  function changeIdeaStatus(id: string, status: IdeaStatus) {
    updateState((current) => ({
      ...current,
      ideas: current.ideas.map((idea) => idea.id === id ? { ...idea, status, updatedAt: new Date().toISOString() } : idea),
    }))
  }

  function removeIdea(id: string) {
    if (!window.confirm('Удалить идею вместе с её этапами и заметками?')) return
    updateState((current) => ({ ...current, ideas: current.ideas.filter((idea) => idea.id !== id) }))
  }

  function startWinFromIdea(idea: Idea) {
    const persisted = saveIdea(idea, false)
    const promoted = promoteIdeaToWin(persisted as unknown as Record<string, unknown>, { date: todayIso() }) as unknown as Win
    setIdeaDraft(null)
    setWinDraft({
      sourceIdeaId: persisted.id,
      title: promoted.title,
      impact: '',
      evidence: '',
      date: promoted.date,
      competencyIds: promoted.competencyIds,
      behaviorRefs: promoted.behaviorRefs,
      levelSignal: promoted.levelSignal,
      workSummary: promoted.workSummary,
      noteSummary: promoted.noteSummary,
      reportReady: true,
    })
  }

  function saveWin(draft: WinDraft) {
    const now = new Date().toISOString()
    const text = `${draft.title} ${draft.impact} ${draft.evidence} ${draft.workSummary.join(' ')}`
    const inferred = inferLevelSignal(text, state.profile.currentLevel) as { level: LevelKey; reason: string }
    const competencyIds = draft.competencyIds.length ? draft.competencyIds : suggestCompetencyIds(text, competencies, competencyKeywords)
    const behaviorRefs = draft.behaviorRefs.length
      ? draft.behaviorRefs
      : suggestBehaviorRefs(text, competencyIds, competencies, draft.levelSignal ?? inferred.level)
    const prepared = { ...draft, competencyIds, behaviorRefs, levelSignal: draft.levelSignal ?? inferred.level }

    updateState((current) => {
      const nextWins = prepared.id
        ? current.wins.map((win) => win.id === prepared.id ? { ...win, ...prepared } : win)
        : [{ ...prepared, id: createId('win'), createdAt: now }, ...current.wins]
      const nextIdeas = prepared.sourceIdeaId
        ? current.ideas.map((idea) => idea.id === prepared.sourceIdeaId
          ? { ...idea, status: 'won' as IdeaStatus, updatedAt: now }
          : idea)
        : current.ideas
      return { ...current, wins: nextWins, ideas: nextIdeas }
    })
    setWinDraft(null)
    setNotice(draft.id ? 'Win обновлена' : 'Win зафиксирована и готова для отчёта')
  }

  function removeWin(id: string) {
    if (!window.confirm('Удалить win?')) return
    updateState((current) => ({ ...current, wins: current.wins.filter((win) => win.id !== id) }))
  }

  function toggleReportReady(id: string) {
    updateState((current) => ({
      ...current,
      wins: current.wins.map((win) => win.id === id ? { ...win, reportReady: !win.reportReady } : win),
    }))
  }

  function selectPeriodWins() {
    setSelectedWinIds(winsInPeriod.map((win) => win.id))
    setNotice(`Выбрано wins: ${winsInPeriod.length}`)
  }

  function generateReport() {
    const selected = state.wins.filter((win) => selectedWinIds.includes(win.id))
    const periodLabel = `${formatDate(periodStart)} — ${formatDate(periodEnd)}`
    const content = buildReportMarkdown({
      profile: state.profile as unknown as Record<string, unknown>,
      wins: selected as unknown as unknown[],
      ideas: state.ideas as unknown as unknown[],
      competencies,
      periodLabel,
      nextFocus,
    })
    setReportText(content)
    setNotice('Черновик собран из wins и выполненных этапов')
  }

  function saveReport() {
    if (!reportText.trim()) return
    const report: Report = {
      id: createId('report'),
      title: `Отчёт ${formatDate(periodStart)} — ${formatDate(periodEnd)}`,
      periodStart,
      periodEnd,
      winIds: selectedWinIds,
      content: reportText,
      createdAt: new Date().toISOString(),
    }
    updateState((current) => ({ ...current, reports: [report, ...current.reports] }))
    setNotice('Версия отчёта сохранена')
  }

  async function copyReport() {
    if (!reportText) return
    await navigator.clipboard.writeText(reportText)
    setNotice('Отчёт скопирован')
  }

  function downloadReport() {
    if (!reportText) return
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `escada-report-${periodStart}-${periodEnd}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `escada-backup-${todayIso()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>
      setState(asCareerState(migrateState(parsed, createDefaultState())))
      setNotice('Данные импортированы')
    } catch {
      setNotice('Не удалось прочитать JSON-файл')
    } finally {
      event.target.value = ''
    }
  }

  function resetWorkspace() {
    if (!window.confirm('Удалить локальные данные Эскады на этом устройстве?')) return
    window.localStorage.removeItem(STORAGE_KEY)
    PREVIOUS_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key))
    setState(asCareerState(createDefaultState()))
    setView('today')
    setNotice('Рабочее пространство очищено')
  }

  function createIdeaFromCompetency(competency: Competency) {
    const idea = newIdea(`Идея для развития: ${competency.shortTitle}`, state.profile.currentLevel)
    idea.details = 'Какое реальное действие или эксперимент поможет проявить эту компетенцию в текущей работе?'
    idea.competencyIds = [competency.id]
    setIdeaDraft(idea)
  }

  function openCoachNote(note: CoachNote) {
    if (note.ideaId) {
      const idea = state.ideas.find((item) => item.id === note.ideaId)
      if (idea) setIdeaDraft(idea)
    } else if (note.winId) {
      const win = state.wins.find((item) => item.id === note.winId)
      if (win) setWinDraft({ ...win })
    } else {
      setView('competencies')
      setCompetencyTab('progress')
    }
  }

  if (!hydrated) {
    return <main className={styles.loading}>Загружаем Эскаду…</main>
  }

  return (
    <main className={styles.shell} data-patch="escada-product-v7">
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}><LadderLogo /></span>
          <div><strong>Эскада</strong><small>Ideas → Work → Wins</small></div>
        </div>

        <nav className={styles.nav} aria-label="Основная навигация">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? styles.navActive : styles.navItem}
              onClick={() => setView(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.caption}</small></span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarCard}>
          <span>Профиль сигналов</span>
          <strong>{levelLabels[progress.inferredLevel]}</strong>
          <p>Не формальная оценка: вывод строится только на записанных идеях, работе и wins.</p>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>Эскада · персональная система роста</p>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className={styles.profileChip}>
            <span>{state.profile.name.slice(0, 1) || 'Э'}</span>
            <div><strong>{state.profile.name || 'Мой профиль'}</strong><small>{state.profile.role}</small></div>
          </div>
        </header>

        {view === 'today' && (
          <TodayView
            quickIdea={quickIdea}
            onQuickIdea={setQuickIdea}
            onSubmitQuickIdea={submitQuickIdea}
            insights={insights}
            activeIdeas={activeIdeas}
            recentWins={recentWins}
            coachNotes={coachNotes}
            onOpenIdea={() => setIdeaDraft(newIdea('', state.profile.currentLevel))}
            onOpenWin={() => setWinDraft(emptyWin())}
            onEditIdea={setIdeaDraft}
            onPromote={startWinFromIdea}
            onCoach={openCoachNote}
            onView={setView}
          />
        )}

        {view === 'ideas' && (
          <IdeasView
            ideas={filteredIdeas}
            filter={ideaFilter}
            onFilter={setIdeaFilter}
            onNew={() => setIdeaDraft(newIdea('', state.profile.currentLevel))}
            onOpen={setIdeaDraft}
            onStatus={changeIdeaStatus}
            onPromote={startWinFromIdea}
            onRemove={removeIdea}
          />
        )}

        {view === 'wins' && (
          <WinsView
            wins={state.wins}
            onNew={() => setWinDraft(emptyWin())}
            onOpen={(win) => setWinDraft({ ...win })}
            onToggleReport={toggleReportReady}
            onRemove={removeWin}
            onReports={() => setView('reports')}
          />
        )}

        {view === 'reports' && (
          <ReportsView
            winsInPeriod={winsInPeriod}
            selectedWinIds={selectedWinIds}
            periodStart={periodStart}
            periodEnd={periodEnd}
            nextFocus={nextFocus}
            reportText={reportText}
            reports={state.reports}
            onPeriodStart={setPeriodStart}
            onPeriodEnd={setPeriodEnd}
            onNextFocus={setNextFocus}
            onSelectWin={(id) => setSelectedWinIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
            onSelectAll={selectPeriodWins}
            onGenerate={generateReport}
            onReportText={setReportText}
            onSave={saveReport}
            onCopy={copyReport}
            onDownload={downloadReport}
          />
        )}

        {view === 'competencies' && (
          <CompetenciesView
            competencies={filteredCompetencies}
            allCompetencies={competencies}
            progress={progress}
            tab={competencyTab}
            query={competencyQuery}
            domain={competencyDomain}
            expanded={expandedCompetency}
            onTab={setCompetencyTab}
            onQuery={setCompetencyQuery}
            onDomain={setCompetencyDomain}
            onExpand={(id) => setExpandedCompetency((current) => current === id ? null : id)}
            onCreateIdea={createIdeaFromCompetency}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            profile={state.profile}
            onProfile={(profile) => updateState((current) => ({ ...current, profile }))}
            onExport={exportData}
            onImport={() => importRef.current?.click()}
            onReset={resetWorkspace}
          />
        )}
      </section>

      <nav className={styles.mobileNav} aria-label="Мобильная навигация">
        {navItems.slice(0, 5).map((item) => (
          <button key={item.id} type="button" className={view === item.id ? styles.mobileActive : ''} onClick={() => setView(item.id)}>
            <span>{item.icon}</span><small>{item.label}</small>
          </button>
        ))}
      </nav>

      {!state.onboardingComplete && (
        <Onboarding initial={state.profile} onComplete={completeOnboarding} onDemo={openDemo} />
      )}

      {ideaDraft && (
        <IdeaWorkspace
          draft={ideaDraft}
          currentLevel={state.profile.currentLevel}
          onClose={() => setIdeaDraft(null)}
          onSave={saveIdea}
          onPromote={startWinFromIdea}
        />
      )}

      {winDraft && (
        <WinModal draft={winDraft} onClose={() => setWinDraft(null)} onSave={saveWin} />
      )}

      <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json" onChange={importData} />
      {notice && <div className={styles.toast} role="status">{notice}</div>}
    </main>
  )
}

function TodayView({ quickIdea, onQuickIdea, onSubmitQuickIdea, insights, activeIdeas, recentWins, coachNotes, onOpenIdea, onOpenWin, onEditIdea, onPromote, onCoach, onView }: {
  quickIdea: string
  onQuickIdea: (value: string) => void
  onSubmitQuickIdea: (event: FormEvent) => void
  insights: ReturnType<typeof computeInsights>
  activeIdeas: Idea[]
  recentWins: Win[]
  coachNotes: CoachNote[]
  onOpenIdea: () => void
  onOpenWin: () => void
  onEditIdea: (idea: Idea) => void
  onPromote: (idea: Idea) => void
  onCoach: (note: CoachNote) => void
  onView: (view: View) => void
}) {
  return (
    <div className={styles.pageStack}>
      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <span className={styles.pill}>Мысль → работа → доказательство</span>
          <h2>Идея становится ценнее, когда виден путь к результату.</h2>
          <p>Сохраните мысль за несколько секунд. Позже откройте карточку, разложите работу на этапы и превратите результат в win.</p>
        </div>
        <form className={styles.quickCapture} onSubmit={onSubmitQuickIdea}>
          <input value={quickIdea} onChange={(event) => onQuickIdea(event.target.value)} placeholder="Например: проверить новый PR-угол на собственных данных…" aria-label="Новая идея" />
          <button type="submit">Сохранить идею</button>
        </form>
        <button className={styles.textButton} type="button" onClick={onOpenIdea}>Развернуть идею сразу</button>
      </section>

      <section className={styles.flowGrid} aria-label="Путь от идеи до отчёта">
        <FlowStep number="01" label="Идеи" value={insights.activeIdeas} caption={`${insights.completedWork} этапов выполнено`} onClick={() => onView('ideas')} />
        <FlowArrow />
        <FlowStep number="02" label="Wins" value={insights.wins} caption={`${insights.reportReadyWins} готовы к отчёту`} onClick={() => onView('wins')} />
        <FlowArrow />
        <FlowStep number="03" label="Отчёты" value={insights.reports} caption="сохранённых версий" onClick={() => onView('reports')} />
      </section>

      <section className={styles.coachPanel}>
        <div className={styles.sectionHeader}>
          <div><span className={styles.eyebrow}>Навигатор Эскады</span><h3>Что стоит заметить сейчас</h3></div>
          <span className={styles.softLabel}>Автоматические подсказки</span>
        </div>
        <div className={styles.coachGrid}>
          {coachNotes.map((note, index) => (
            <button type="button" className={styles.coachCard} key={`${note.kind}-${index}`} onClick={() => onCoach(note)}>
              <span>{String(index + 1).padStart(2, '0')}</span><strong>{note.title}</strong><p>{note.text}</p><small>Открыть контекст →</small>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div><span className={styles.eyebrow}>Рабочая память</span><h3>Идеи в движении</h3></div>
            <button className={styles.secondaryButton} type="button" onClick={() => onView('ideas')}>Все идеи</button>
          </div>
          <div className={styles.cardList}>
            {activeIdeas.length ? activeIdeas.map((idea) => (
              <article className={styles.ideaCompact} key={idea.id}>
                <div>
                  <div className={styles.inlineMeta}><span className={styles.statusBadge} data-status={idea.status}>{statusLabels[idea.status]}</span><LevelBadge level={idea.levelSignal} /></div>
                  <h4>{idea.title}</h4>
                  <p>{idea.workItems.filter((item) => item.status === 'done').length}/{idea.workItems.length} этапов завершено</p>
                  <CompetencyChips ids={idea.competencyIds} />
                </div>
                <div className={styles.compactActions}>
                  <button type="button" onClick={() => onEditIdea(idea)}>Открыть</button>
                  <button type="button" onClick={() => onPromote(idea)}>Это уже win</button>
                </div>
              </article>
            )) : <EmptyState title="Пока нет идей" text="Запишите первую мысль. Затем откройте её и добавьте этапы работы, заметки и контекст компетенций." action="Добавить идею" onAction={onOpenIdea} />}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div><span className={styles.eyebrow}>Доказательства роста</span><h3>Последние wins</h3></div>
            <button className={styles.secondaryButton} type="button" onClick={onOpenWin}>Добавить</button>
          </div>
          <div className={styles.cardList}>
            {recentWins.length ? recentWins.map((win) => (
              <article className={styles.winCompact} key={win.id}>
                <div className={styles.inlineMeta}><span>{formatDate(win.date)}</span><LevelBadge level={win.levelSignal} /></div>
                <h4>{win.title}</h4>
                <p>{win.impact || 'Добавьте влияние, когда оно станет понятным.'}</p>
                {win.workSummary.length > 0 && <small>{win.workSummary.length} выполненных этапа в отчёте</small>}
                <CompetencyChips ids={win.competencyIds} />
              </article>
            )) : <EmptyState title="Wins ещё не зафиксированы" text="Win — это изменение с понятным влиянием или доказательством. Эскада подтянет в него выполненную работу по идее." action="Добавить win" onAction={onOpenWin} />}
          </div>
        </section>
      </div>
    </div>
  )
}

function FlowStep({ number, label, value, caption, onClick }: { number: string; label: string; value: number; caption: string; onClick: () => void }) {
  return <button className={styles.flowStep} type="button" onClick={onClick}><span>{number}</span><strong>{value}</strong><h3>{label}</h3><small>{caption}</small></button>
}

function FlowArrow() {
  return <div className={styles.flowArrow} aria-hidden="true">→</div>
}

function IdeasView({ ideas, filter, onFilter, onNew, onOpen, onStatus, onPromote, onRemove }: {
  ideas: Idea[]
  filter: 'all' | IdeaStatus
  onFilter: (value: 'all' | IdeaStatus) => void
  onNew: () => void
  onOpen: (idea: Idea) => void
  onStatus: (id: string, status: IdeaStatus) => void
  onPromote: (idea: Idea) => void
  onRemove: (id: string) => void
}) {
  const filters: Array<{ value: 'all' | IdeaStatus; label: string }> = [
    { value: 'all', label: 'Все' }, { value: 'inbox', label: 'Входящие' }, { value: 'exploring', label: 'В работе' }, { value: 'won', label: 'Стали win' }, { value: 'archived', label: 'Архив' },
  ]
  return (
    <div className={styles.pageStack}>
      <section className={styles.pageIntro}>
        <div><span className={styles.eyebrow}>От фиксации к осмысленной работе</span><h2>Каждая идея может стать лёгким рабочим пространством.</h2><p>Откройте карточку, добавьте этапы и заметки. Это не замена task-менеджеру: только тот контекст, который пригодится для win и отчёта.</p></div>
        <button className={styles.primaryButton} type="button" onClick={onNew}>+ Новая идея</button>
      </section>
      <div className={styles.filterBar}>
        {filters.map((item) => <button key={item.value} type="button" className={filter === item.value ? styles.filterActive : ''} onClick={() => onFilter(item.value)}>{item.label}</button>)}
      </div>
      <section className={styles.ideaGrid}>
        {ideas.length ? ideas.map((idea) => {
          const done = idea.workItems.filter((item) => item.status === 'done').length
          return (
            <article className={styles.ideaCard} key={idea.id}>
              <div className={styles.cardTopline}>
                <span className={styles.statusBadge} data-status={idea.status}>{statusLabels[idea.status]}</span>
                <span>{formatDate(idea.createdAt.slice(0, 10))}</span>
              </div>
              <div className={styles.inlineMeta}><LevelBadge level={idea.levelSignal} /><span className={styles.progressMini}>{done}/{idea.workItems.length} этапов</span></div>
              <h3>{idea.title}</h3>
              <p>{idea.details || 'Откройте карточку и добавьте контекст, этапы работы и заметки.'}</p>
              {idea.nextStep && <div className={styles.nextStep}><span>Следующий шаг</span><strong>{idea.nextStep}</strong></div>}
              <CompetencyChips ids={idea.competencyIds} />
              <div className={styles.cardActions}>
                <select value={idea.status} onChange={(event) => onStatus(idea.id, event.target.value as IdeaStatus)} aria-label="Статус идеи">
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button type="button" onClick={() => onOpen(idea)}>Открыть</button>
                <button type="button" onClick={() => onPromote(idea)}>Оформить win</button>
                <button className={styles.iconButton} type="button" onClick={() => onRemove(idea.id)} aria-label="Удалить">×</button>
              </div>
            </article>
          )
        }) : <EmptyState title="Здесь пока пусто" text="Добавьте идею, наблюдение или гипотезу. Структуру можно создать после." action="Новая идея" onAction={onNew} />}
      </section>
    </div>
  )
}

function WinsView({ wins, onNew, onOpen, onToggleReport, onRemove, onReports }: {
  wins: Win[]
  onNew: () => void
  onOpen: (win: Win) => void
  onToggleReport: (id: string) => void
  onRemove: (id: string) => void
  onReports: () => void
}) {
  return (
    <div className={styles.pageStack}>
      <section className={styles.pageIntro}>
        <div><span className={styles.eyebrow}>Evidence over memory</span><h2>Сохраняйте не занятость, а изменения.</h2><p>В win попадают результат, влияние, доказательство и выполненные этапы исходной идеи.</p></div>
        <div className={styles.buttonRow}><button className={styles.secondaryButton} type="button" onClick={onReports}>Собрать отчёт</button><button className={styles.primaryButton} type="button" onClick={onNew}>+ Добавить win</button></div>
      </section>
      <section className={styles.winList}>
        {wins.length ? wins.map((win) => (
          <article className={styles.winCard} key={win.id}>
            <div className={styles.winDate}><strong>{new Date(`${win.date}T00:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(new Date(`${win.date}T00:00:00`))}</span></div>
            <div className={styles.winBody}>
              <div className={styles.cardTopline}><span>{win.reportReady ? 'Предлагается для отчёта' : 'Скрыта из отчётов'}</span><LevelBadge level={win.levelSignal} /></div>
              <h3>{win.title}</h3>
              <div className={styles.winDetails}><div><span>Влияние</span><p>{win.impact || 'Пока не сформулировано'}</p></div><div><span>Доказательство</span><p>{win.evidence || 'Можно добавить позже'}</p></div></div>
              {win.workSummary.length > 0 && <div className={styles.workSummary}><span>Что было сделано</span><ul>{win.workSummary.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              <CompetencyChips ids={win.competencyIds} />
              <div className={styles.cardActions}><button type="button" onClick={() => onOpen(win)}>Открыть</button><button type="button" onClick={() => onToggleReport(win.id)}>{win.reportReady ? 'Не включать автоматически' : 'Предлагать для отчётов'}</button><button className={styles.iconButton} type="button" onClick={() => onRemove(win.id)}>×</button></div>
            </div>
          </article>
        )) : <EmptyState title="Нет зафиксированных wins" text="Откройте идею после появления результата — выполненные этапы автоматически попадут в win." action="Добавить win вручную" onAction={onNew} />}
      </section>
    </div>
  )
}

function ReportsView({ winsInPeriod, selectedWinIds, periodStart, periodEnd, nextFocus, reportText, reports, onPeriodStart, onPeriodEnd, onNextFocus, onSelectWin, onSelectAll, onGenerate, onReportText, onSave, onCopy, onDownload }: {
  winsInPeriod: Win[]
  selectedWinIds: string[]
  periodStart: string
  periodEnd: string
  nextFocus: string
  reportText: string
  reports: Report[]
  onPeriodStart: (value: string) => void
  onPeriodEnd: (value: string) => void
  onNextFocus: (value: string) => void
  onSelectWin: (id: string) => void
  onSelectAll: () => void
  onGenerate: () => void
  onReportText: (value: string) => void
  onSave: () => void
  onCopy: () => void
  onDownload: () => void
}) {
  return (
    <div className={styles.pageStack}>
      <section className={styles.pageIntro}><div><span className={styles.eyebrow}>Wins → narrative</span><h2>Соберите отчёт из реальной истории работы.</h2><p>Эскада добавит к каждому результату выполненные этапы идеи, влияние, доказательства и сигналы компетенций.</p></div></section>
      <section className={styles.reportLayout}>
        <div className={styles.panel}>
          <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>01 · Выбор материала</span><h3>Период и wins</h3></div><button className={styles.secondaryButton} type="button" onClick={onSelectAll}>Выбрать все</button></div>
          <div className={styles.dateGrid}><label>С<input type="date" value={periodStart} onChange={(event) => onPeriodStart(event.target.value)} /></label><label>По<input type="date" value={periodEnd} onChange={(event) => onPeriodEnd(event.target.value)} /></label></div>
          <div className={styles.reportWins}>{winsInPeriod.length ? winsInPeriod.map((win) => <label className={styles.reportWin} key={win.id}><input type="checkbox" checked={selectedWinIds.includes(win.id)} onChange={() => onSelectWin(win.id)} /><span><strong>{win.title}</strong><small>{win.workSummary.length ? `${win.workSummary.length} этапов работы · ` : ''}{win.impact || formatDate(win.date)}</small></span></label>) : <p className={styles.muted}>За этот период нет wins, доступных для отчёта.</p>}</div>
          <label className={styles.field}>Следующий фокус<textarea value={nextFocus} onChange={(event) => onNextFocus(event.target.value)} placeholder="Какие идеи или результаты важны в следующем периоде?" /></label>
          <button className={styles.primaryButton} type="button" disabled={!selectedWinIds.length} onClick={onGenerate}>Собрать черновик</button>
        </div>
        <div className={styles.reportEditor}>
          <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>02 · Редактирование</span><h3>Черновик отчёта</h3></div><span className={styles.autosaveLabel}>Вы контролируете формулировки</span></div>
          <textarea value={reportText} onChange={(event) => onReportText(event.target.value)} placeholder="Выберите wins и соберите отчёт…" />
          <div className={styles.buttonRow}><button className={styles.primaryButton} type="button" disabled={!reportText} onClick={onSave}>Сохранить версию</button><button className={styles.secondaryButton} type="button" disabled={!reportText} onClick={onCopy}>Копировать</button><button className={styles.secondaryButton} type="button" disabled={!reportText} onClick={onDownload}>Скачать .md</button></div>
        </div>
      </section>
      {reports.length > 0 && <section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>История</span><h3>Сохранённые версии</h3></div></div><div className={styles.savedReports}>{reports.map((report) => <article key={report.id}><strong>{report.title}</strong><span>{report.winIds.length} wins · {formatDate(report.createdAt.slice(0, 10))}</span></article>)}</div></section>}
    </div>
  )
}

function CompetenciesView({ competencies: items, allCompetencies, progress, tab, query, domain, expanded, onTab, onQuery, onDomain, onExpand, onCreateIdea }: {
  competencies: Competency[]
  allCompetencies: Competency[]
  progress: ProgressResult
  tab: CompetencyTab
  query: string
  domain: 'all' | Competency['domain']
  expanded: string | null
  onTab: (tab: CompetencyTab) => void
  onQuery: (value: string) => void
  onDomain: (value: 'all' | Competency['domain']) => void
  onExpand: (id: string) => void
  onCreateIdea: (competency: Competency) => void
}) {
  return (
    <div className={styles.pageStack}>
      <section className={styles.guidanceBanner}><span className={styles.pill}>Подсказки, не аттестация</span><h2>Шкала помогает замечать рост, но не превращается в обязательный чеклист.</h2><p>«Мой прогресс» показывает только сигналы из записанных идей, этапов и wins. Это материал для рефлексии, а не официальное присвоение уровня.</p></section>
      <div className={styles.segmentedControl}><button type="button" className={tab === 'progress' ? styles.segmentActive : ''} onClick={() => onTab('progress')}>Мой прогресс</button><button type="button" className={tab === 'catalog' ? styles.segmentActive : ''} onClick={() => onTab('catalog')}>Шкала компетенций</button></div>

      {tab === 'progress' ? (
        <>
          <section className={styles.progressHero}>
            <div><span className={styles.eyebrow}>Предположительный профиль</span><h2>{levelLabels[progress.inferredLevel]}</h2><p>Уверенность: {progress.confidence === 'high' ? 'высокая' : progress.confidence === 'medium' ? 'средняя' : 'пока низкая'} · учтено сигналов: {progress.evidenceCount}</p></div>
            <div className={styles.coverageGrid}>{(['specialist', 'senior', 'lead'] as LevelKey[]).map((level) => <article key={level}><span>{levelLabels[level]}</span><strong>{progress.coverage[level]}%</strong><div><i style={{ width: `${progress.coverage[level]}%` }} /></div><small>{progress.coveredCounts[level]} из {allCompetencies.length} компетенций</small></article>)}</div>
          </section>
          <section className={styles.progressGrid}>
            {allCompetencies.map((competency) => {
              const row = progress.competencies.find((item) => item.competencyId === competency.id)
              const refs = new Set(row?.behaviorRefs ?? [])
              return (
                <article className={styles.progressCard} key={competency.id}>
                  <div className={styles.cardTopline}><span className={styles.domainBadge}>{competency.domain === 'strategy' ? 'Стратегия' : competency.domain === 'craft' ? 'Профессиональное' : 'Лидерство'}</span>{row?.highestLevel ? <LevelBadge level={row.highestLevel} /> : <span className={styles.softLabel}>Нет сигналов</span>}</div>
                  <h3>{competency.title}</h3>
                  <div className={styles.evidenceStats}><span><strong>{row?.ideas ?? 0}</strong> идей</span><span><strong>{row?.completedWork ?? 0}</strong> этапов</span><span><strong>{row?.wins ?? 0}</strong> wins</span></div>
                  <div className={styles.behaviorPreview}>{(['specialist', 'senior', 'lead'] as LevelKey[]).map((level) => {
                    const observed = competency.levels[level].filter((_, index) => refs.has(`${competency.id}:${level}:${index}`))
                    return <div key={level}><span>{levelLabels[level]}</span><strong>{observed.length}/{competency.levels[level].length}</strong></div>
                  })}</div>
                  <button className={styles.secondaryButton} type="button" onClick={() => onExpand(competency.id)}>{expanded === competency.id ? 'Скрыть сигналы' : 'Посмотреть сигналы'}</button>
                  {expanded === competency.id && <div className={styles.progressSignals}>{(['specialist', 'senior', 'lead'] as LevelKey[]).map((level) => <section key={level}><h4>{levelLabels[level]}</h4>{competency.levels[level].map((signal, index) => { const active = refs.has(`${competency.id}:${level}:${index}`); return <div className={active ? styles.signalObserved : styles.signalUnobserved} key={signal}><span>{active ? '✓' : '·'}</span><p>{signal}</p></div> })}</section>)}</div>}
                </article>
              )
            })}
          </section>
        </>
      ) : (
        <>
          <div className={styles.competencyToolbar}><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Найти компетенцию…" /><div className={styles.filterBar}><button type="button" className={domain === 'all' ? styles.filterActive : ''} onClick={() => onDomain('all')}>Все</button><button type="button" className={domain === 'strategy' ? styles.filterActive : ''} onClick={() => onDomain('strategy')}>Стратегия</button><button type="button" className={domain === 'craft' ? styles.filterActive : ''} onClick={() => onDomain('craft')}>Профессиональные</button><button type="button" className={domain === 'leadership' ? styles.filterActive : ''} onClick={() => onDomain('leadership')}>Лидерство</button></div></div>
          <section className={styles.competencyGrid}>{items.map((competency, index) => <article className={styles.competencyCard} key={competency.id}><span className={styles.competencyNumber}>{String(index + 1).padStart(2, '0')}</span><span className={styles.domainBadge}>{competency.domain === 'strategy' ? 'Стратегия' : competency.domain === 'craft' ? 'Профессиональное' : 'Лидерство'}</span><h3>{competency.title}</h3><p>{competency.summary}</p><div className={styles.buttonRow}><button className={styles.secondaryButton} type="button" onClick={() => onExpand(competency.id)}>{expanded === competency.id ? 'Скрыть уровни' : 'Посмотреть уровни'}</button><button className={styles.secondaryButton} type="button" onClick={() => onCreateIdea(competency)}>Создать идею</button></div>{expanded === competency.id && <div className={styles.levelSignals}>{(['specialist', 'senior', 'lead'] as LevelKey[]).map((level) => <section key={level}><h4>{levelLabels[level]}</h4><ul>{competency.levels[level].map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div>}</article>)}</section>
        </>
      )}
    </div>
  )
}

function SettingsView({ profile, onProfile, onExport, onImport, onReset }: { profile: Profile; onProfile: (profile: Profile) => void; onExport: () => void; onImport: () => void; onReset: () => void }) {
  const [draft, setDraft] = useState(profile)
  useEffect(() => setDraft(profile), [profile])
  return <div className={styles.pageStack}><section className={styles.pageIntro}><div><span className={styles.eyebrow}>Контекст важнее оценки</span><h2>Настройте точку отсчёта.</h2><p>Текущий уровень используется только для подсказок о поведении следующего уровня.</p></div></section><div className={styles.settingsGrid}><section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Профиль</span><h3>Рабочий контекст</h3></div></div><div className={styles.formGrid}><label>Имя<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Роль<input value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} /></label><label>Рынок или команда<input value={draft.market} onChange={(event) => setDraft({ ...draft, market: event.target.value })} /></label><label>Текущий уровень<select value={draft.currentLevel} onChange={(event) => setDraft({ ...draft, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([level, label]) => <option key={level} value={level}>{label}</option>)}</select></label><label>Ритм отчёта<select value={draft.reportingRhythm} onChange={(event) => setDraft({ ...draft, reportingRhythm: event.target.value as ReportingRhythm })}><option value="monthly">Ежемесячно</option><option value="quarterly">Ежеквартально</option><option value="half-year">Раз в полгода</option></select></label><label>Конец текущего цикла<input type="date" value={draft.cycleEnd} onChange={(event) => setDraft({ ...draft, cycleEnd: event.target.value })} /></label></div><button className={styles.primaryButton} type="button" onClick={() => onProfile(draft)}>Сохранить профиль</button></section><section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Privacy-first</span><h3>Локальные данные</h3></div></div><p className={styles.settingsText}>Данные хранятся в localStorage браузера. Экспортируйте резервную копию перед сменой устройства или очисткой браузера.</p><div className={styles.stackButtons}><button className={styles.secondaryButton} type="button" onClick={onExport}>Экспортировать JSON</button><button className={styles.secondaryButton} type="button" onClick={onImport}>Импортировать JSON</button><button className={styles.dangerButton} type="button" onClick={onReset}>Удалить локальные данные</button></div></section></div></div>
}

function IdeaWorkspace({ draft: initial, currentLevel, onClose, onSave, onPromote }: { draft: Idea; currentLevel: LevelKey; onClose: () => void; onSave: (draft: Idea, close?: boolean) => Idea; onPromote: (idea: Idea) => void }) {
  const [draft, setDraft] = useState(initial)
  const [workTitle, setWorkTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const text = `${draft.title} ${draft.details} ${draft.nextStep} ${draft.workItems.map((item) => item.title).join(' ')} ${draft.notes.map((item) => item.text).join(' ')}`
  const suggestedCompetencies = useMemo(() => suggestCompetencyIds(text, competencies, competencyKeywords), [text])
  const inferred = useMemo(() => inferLevelSignal(text, currentLevel) as { level: LevelKey; reason: string }, [currentLevel, text])
  const suggestedBehaviors = useMemo(() => suggestBehaviorRefs(text, draft.competencyIds, competencies, draft.levelSignal), [draft.competencyIds, draft.levelSignal, text])

  function toggleCompetency(id: string) {
    setDraft((current) => ({ ...current, competencyIds: current.competencyIds.includes(id) ? current.competencyIds.filter((item) => item !== id) : [...current.competencyIds, id] }))
  }
  function toggleBehavior(ref: string) {
    setDraft((current) => ({ ...current, behaviorRefs: current.behaviorRefs.includes(ref) ? current.behaviorRefs.filter((item) => item !== ref) : [...current.behaviorRefs, ref] }))
  }
  function addWork() {
    const title = workTitle.trim()
    if (!title) return
    setDraft((current) => ({ ...current, status: current.status === 'inbox' ? 'exploring' : current.status, workItems: [...current.workItems, { id: createId('work'), title, status: 'backlog', createdAt: new Date().toISOString(), completedAt: null }] }))
    setWorkTitle('')
  }
  function moveWork(id: string, status: WorkStatus) {
    setDraft((current) => ({ ...current, workItems: current.workItems.map((item) => item.id === id ? { ...item, status, completedAt: status === 'done' ? new Date().toISOString() : null } : item) }))
  }
  function removeWork(id: string) {
    setDraft((current) => ({ ...current, workItems: current.workItems.filter((item) => item.id !== id) }))
  }
  function addNote() {
    const value = noteText.trim()
    if (!value) return
    setDraft((current) => ({ ...current, notes: [...current.notes, { id: createId('note'), text: value, createdAt: new Date().toISOString() }] }))
    setNoteText('')
  }

  return (
    <div className={styles.workspaceBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section className={styles.ideaWorkspace} role="dialog" aria-modal="true" aria-labelledby="idea-workspace-title">
        <header className={styles.workspaceHeader}>
          <div><span className={styles.eyebrow}>Детальная карточка идеи</span><h2 id="idea-workspace-title">{draft.title || 'Новая идея'}</h2><div className={styles.inlineMeta}><span className={styles.statusBadge} data-status={draft.status}>{statusLabels[draft.status]}</span><LevelBadge level={draft.levelSignal} /></div></div>
          <button type="button" aria-label="Закрыть" onClick={onClose}>×</button>
        </header>

        <div className={styles.ideaWorkspaceGrid}>
          <div className={styles.ideaMainColumn}>
            <section className={styles.workspaceSection}>
              <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>01 · Смысл</span><h3>Идея и контекст</h3></div></div>
              <div className={styles.modalForm}>
                <label className={styles.field}>Название идеи<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Что стоит попробовать, исследовать или изменить?" /></label>
                <label className={styles.field}>Контекст и ход мысли<textarea className={styles.largeTextarea} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="Почему это важно? Что вы заметили? Какие ограничения и гипотезы уже есть?" /></label>
                <label className={styles.field}>Следующий шаг<textarea value={draft.nextStep} onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })} placeholder="Один конкретный шаг, который двигает идею дальше." /></label>
                <div className={styles.formGrid}><label>Статус<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as IdeaStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Сигнал уровня<select value={draft.levelSignal} onChange={(event) => setDraft({ ...draft, levelSignal: event.target.value as LevelKey, levelReason: event.target.value === inferred.level ? inferred.reason : 'Уровень выбран пользователем на основе масштаба и ответственности идеи.' })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
              </div>
            </section>

            <section className={styles.workspaceSection}>
              <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>02 · Работа</span><h3>Мини-канбан идеи</h3></div><span className={styles.softLabel}>Без дедлайнов и лишних полей</span></div>
              <div className={styles.addInline}><input value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addWork() } }} placeholder="Добавить этап работы…" /><button type="button" onClick={addWork}>Добавить</button></div>
              <div className={styles.miniKanban}>{(['backlog', 'doing', 'done'] as WorkStatus[]).map((status) => <section className={styles.kanbanColumn} key={status}><header><span>{workStatusLabels[status]}</span><strong>{draft.workItems.filter((item) => item.status === status).length}</strong></header><div>{draft.workItems.filter((item) => item.status === status).map((item) => <article className={styles.workItem} key={item.id}><p>{item.title}</p><div><select value={item.status} onChange={(event) => moveWork(item.id, event.target.value as WorkStatus)} aria-label="Статус этапа">{Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={() => removeWork(item.id)}>×</button></div></article>)}{!draft.workItems.some((item) => item.status === status) && <small>Пока пусто</small>}</div></section>)}</div>
            </section>

            <section className={styles.workspaceSection}>
              <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>03 · Память</span><h3>Заметки по ходу работы</h3></div></div>
              <div className={styles.addInline}><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Решение, наблюдение, обратная связь, причина изменения курса…" /><button type="button" onClick={addNote}>Добавить</button></div>
              <div className={styles.notesTimeline}>{draft.notes.length ? [...draft.notes].reverse().map((note) => <article key={note.id}><span>{formatDate(note.createdAt.slice(0, 10))}</span><p>{note.text}</p></article>) : <p className={styles.muted}>Заметки помогут восстановить логику решений при подготовке отчёта.</p>}</div>
            </section>
          </div>

          <aside className={styles.ideaSideColumn}>
            <section className={styles.signalCard}>
              <span className={styles.eyebrow}>Подсказка уровня</span><h3>{levelLabels[inferred.level]}</h3><p>{inferred.reason}</p>{draft.levelSignal !== inferred.level && <small>Вы выбрали: {levelLabels[draft.levelSignal]}</small>}<button type="button" onClick={() => setDraft({ ...draft, levelSignal: inferred.level, levelReason: inferred.reason })}>Применить подсказку</button>
            </section>

            <section className={styles.workspaceSection}>
              <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Компетенции</span><h3>Контекст идеи</h3></div></div>
              <div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={draft.competencyIds.includes(competency.id) ? styles.choiceActive : ''} onClick={() => toggleCompetency(competency.id)}>{competency.shortTitle}</button>)}</div>
              {suggestedCompetencies.length > 0 && <p className={styles.helperText}>По тексту подходят: {suggestedCompetencies.map((id) => competencyById(id)?.shortTitle).filter(Boolean).join(', ')}</p>}
            </section>

            <section className={styles.workspaceSection}>
              <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Поведенческие сигналы</span><h3>Что может проявляться</h3></div></div>
              <p className={styles.helperText}>Это предположение по тексту идеи, а не обязательный чеклист. Оставьте только действительно релевантные сигналы.</p>
              <div className={styles.behaviorChoices}>{suggestedBehaviors.length ? suggestedBehaviors.map((ref) => <button type="button" key={ref} className={draft.behaviorRefs.includes(ref) ? styles.behaviorActive : ''} onClick={() => toggleBehavior(ref)}><span>{draft.behaviorRefs.includes(ref) ? '✓' : '+'}</span>{behaviorLabel(ref)}</button>) : <small>Добавьте контекст, этапы или компетенции — Эскада предложит сигналы.</small>}</div>
            </section>
          </aside>
        </div>

        <footer className={styles.workspaceFooter}><button className={styles.secondaryButton} type="button" onClick={onClose}>Закрыть</button><div><button className={styles.secondaryButton} type="button" disabled={!draft.title.trim()} onClick={() => onPromote(draft)}>Оформить win</button><button className={styles.primaryButton} type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Сохранить идею</button></div></footer>
      </section>
    </div>
  )
}

function WinModal({ draft: initial, onClose, onSave }: { draft: WinDraft; onClose: () => void; onSave: (draft: WinDraft) => void }) {
  const [draft, setDraft] = useState(initial)
  function toggleCompetency(id: string) {
    setDraft((current) => ({ ...current, competencyIds: current.competencyIds.includes(id) ? current.competencyIds.filter((item) => item !== id) : [...current.competencyIds, id] }))
  }
  return (
    <Modal title={draft.id ? 'Открыть win' : 'Зафиксировать win'} subtitle="Эскада уже перенесла выполненные этапы исходной идеи. Добавьте влияние и доказательство." onClose={onClose}>
      <form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) onSave({ ...draft, title: draft.title.trim() }) }}>
        <label className={styles.field}>Что произошло<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Конкретный результат или изменение" required /></label>
        <label className={styles.field}>Почему это важно<textarea value={draft.impact} onChange={(event) => setDraft({ ...draft, impact: event.target.value })} placeholder="Влияние на бизнес, команду, пользователя или процесс" /></label>
        <label className={styles.field}>Чем подтверждается<textarea value={draft.evidence} onChange={(event) => setDraft({ ...draft, evidence: event.target.value })} placeholder="Метрика, ссылка, отзыв, артефакт, согласованное решение" /></label>
        {draft.workSummary.length > 0 && <div className={styles.optionalBlock}><div><strong>Выполненная работа из идеи</strong><span>Эти этапы попадут в отчёт.</span></div><ul className={styles.plainList}>{draft.workSummary.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        <div className={styles.formGrid}><label>Дата<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>Сигнал уровня<select value={draft.levelSignal} onChange={(event) => setDraft({ ...draft, levelSignal: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.checkboxField}><input type="checkbox" checked={draft.reportReady} onChange={(event) => setDraft({ ...draft, reportReady: event.target.checked })} /><span>Предлагать для отчётов</span></label></div>
        <div className={styles.optionalBlock}><div><strong>Какие компетенции проявились?</strong><span>Выберите только очевидные связи. Можно оставить пустым.</span></div><div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={draft.competencyIds.includes(competency.id) ? styles.choiceActive : ''} onClick={() => toggleCompetency(competency.id)}>{competency.shortTitle}</button>)}</div></div>
        <div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button><button className={styles.primaryButton} type="submit">Сохранить win</button></div>
      </form>
    </Modal>
  )
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className={styles.modalHeader}><div><span className={styles.eyebrow}>Эскада</span><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button type="button" aria-label="Закрыть" onClick={onClose}>×</button></div>{children}</section></div>
}

function Onboarding({ initial, onComplete, onDemo }: { initial: Profile; onComplete: (profile: Profile) => void; onDemo: () => void }) {
  const [profile, setProfile] = useState(initial)
  return (
    <div className={styles.onboardingBackdrop}>
      <section className={styles.onboarding}>
        <div className={styles.onboardingVisual}><span className={styles.brandMark}><LadderLogo /></span><p>Эскада</p><h1>Идеи.<br />Работа.<br />Рост.</h1><div className={styles.onboardingFlow}><span>Idea</span><i>→</i><span>Work</span><i>→</i><span>Win</span><i>→</i><span>Report</span></div></div>
        <form onSubmit={(event) => { event.preventDefault(); onComplete(profile) }}>
          <span className={styles.eyebrow}>Настройка за минуту</span><h2>Добавьте рабочий контекст</h2><p>Уровень нужен только для подсказок: где ваша работа проявляет поведение следующей ступени.</p>
          <label>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Как к вам обращаться" required /></label>
          <label>Текущая роль<input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} required /></label>
          <label>Текущий уровень<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Рынок или команда<input value={profile.market} onChange={(event) => setProfile({ ...profile, market: event.target.value })} placeholder="Например, Бразилия" /></label>
          <label>Основной ритм отчёта<select value={profile.reportingRhythm} onChange={(event) => setProfile({ ...profile, reportingRhythm: event.target.value as ReportingRhythm })}><option value="monthly">Ежемесячно</option><option value="quarterly">Ежеквартально</option><option value="half-year">Раз в полгода</option></select></label>
          <button className={styles.primaryButton} type="submit">Начать работу</button><button className={styles.textButton} type="button" onClick={onDemo}>Посмотреть с демо-данными</button>
        </form>
      </section>
    </div>
  )
}

function LevelBadge({ level }: { level: LevelKey }) {
  return <span className={styles.levelBadge} data-level={level}>{levelLabels[level]}</span>
}

function CompetencyChips({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return <div className={styles.competencyChips}>{ids.map((id) => <span key={id}>{competencyById(id)?.shortTitle ?? id}</span>)}</div>
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className={styles.emptyState}><span>＋</span><h3>{title}</h3><p>{text}</p><button type="button" onClick={onAction}>{action}</button></div>
}
