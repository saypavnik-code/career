'use client'

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import styles from './career.module.css'
import {
  Competency,
  LevelKey,
  competencies,
  competencyKeywords,
  levelLabels,
  nextLevel,
} from './career-data'
import { findCriterion } from './competency-knowledge.mjs'
import { buildLocalGuidance } from './local-guidance.mjs'
import {
  PREVIOUS_STORAGE_KEYS,
  STORAGE_KEY,
  buildCoachNotes,
  captureToIdea,
  captureToWinDraft,
  classifyCapture,
  computeGrowthPath,
  createCapture,
  createDefaultState,
  createId,
  demoState,
  inferLevelSignal,
  migrateState,
  promoteIdeaToWin,
  selectWinsForPeriod,
  suggestBehaviorRefs,
  suggestCompetencyIds,
  todayIso,
  winGapHints,
} from './career-core.mjs'

const ESCADA_AI_ENDPOINT = process.env.NEXT_PUBLIC_ESCADA_AI_ENDPOINT?.trim() ?? ''

type View = 'today' | 'ideas' | 'wins' | 'reports' | 'growth'
type IdeaStatus = 'inbox' | 'exploring' | 'won' | 'archived'
type WorkStatus = 'backlog' | 'doing' | 'done'
type CaptureKind = 'idea' | 'win' | 'note'
type ReportType = 'monthly' | 'one-to-one' | 'performance' | 'promotion'
type GrowthTab = 'path' | 'scale'
type AiAction = 'idea_review' | 'win_rewrite' | 'report_draft' | 'report_review' | 'growth_guidance'

interface Profile {
  name: string
  role: string
  market: string
  currentLevel: LevelKey
  reportingRhythm: 'monthly' | 'quarterly' | 'half-year'
  cycleEnd: string
}

interface Capture {
  id: string
  text: string
  suggestedKind: CaptureKind
  status: 'unclassified' | 'classified' | 'converted'
  createdAt: string
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

interface IdeaEvidence {
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
  evidenceNotes: IdeaEvidence[]
  createdAt: string
  updatedAt: string
}

interface Win {
  id: string
  title: string
  impact: string
  evidence: string
  metrics: string
  confirmedBy: string
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
  type: ReportType
  periodStart: string
  periodEnd: string
  winIds: string[]
  ideaIds: string[]
  content: string
  createdAt: string
}

interface CareerState {
  version: number
  onboardingComplete: boolean
  profile: Profile
  captures: Capture[]
  ideas: Idea[]
  wins: Win[]
  reports: Report[]
}

interface WinDraft extends Omit<Win, 'id' | 'createdAt'> {
  id?: string
}

interface AiCitedItem {
  text: string
  criterionId: string
}

interface AiResponse {
  headline: string
  strengths: AiCitedItem[]
  stretch: AiCitedItem[]
  evidence: string[]
  nextStep: string
  rewrite: { title: string; impact: string; evidence: string } | null
  draftMarkdown: string | null
  caveat: string
  sources: Array<{ id: string; competencyTitle: string; level: LevelKey; text: string; sourcePage: number }>
  knowledgeBaseVersion: string
}

const navItems: Array<{ id: View; label: string; caption: string; icon: string }> = [
  { id: 'today', label: 'Сегодня', caption: 'Быстрая мысль', icon: '◉' },
  { id: 'ideas', label: 'Идеи', caption: 'Развить мысль', icon: '✦' },
  { id: 'wins', label: 'Wins', caption: 'Подтвердить результат', icon: '◆' },
  { id: 'reports', label: 'Отчёты', caption: 'Оформить историю', icon: '▤' },
  { id: 'growth', label: 'Рост', caption: 'Понять следующий шаг', icon: '⌁' },
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

const reportTypeLabels: Record<ReportType, string> = {
  monthly: 'Ежемесячный отчёт',
  'one-to-one': 'Отчёт для 1:1',
  performance: 'Performance review',
  promotion: 'Promotion case',
}

function asState(value: Record<string, unknown>) {
  return value as unknown as CareerState
}

function safeJsonParse(value: string | null) {
  if (!value) return null
  try { return JSON.parse(value) as Record<string, unknown> } catch { return null }
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

function competencyById(id: string) {
  return competencies.find((item) => item.id === id)
}

function criterionText(ref: string) {
  const criterion = findCriterion(ref)
  return criterion?.text ?? ref
}

function newIdea(currentLevel: LevelKey, title = '') {
  return captureToIdea({ id: createId('capture'), text: title }, currentLevel) as unknown as Idea
}

function emptyWin(): WinDraft {
  return {
    sourceIdeaId: null,
    title: '',
    impact: '',
    evidence: '',
    metrics: '',
    confirmedBy: '',
    date: todayIso(),
    competencyIds: [],
    behaviorRefs: [],
    levelSignal: 'specialist',
    workSummary: [],
    noteSummary: [],
    reportReady: true,
  }
}

function LadderLogo({ compact = false }: { compact?: boolean }) {
  return <svg className={compact ? styles.logoSvgCompact : styles.logoSvg} viewBox="0 0 48 48" aria-hidden="true"><path d="M8 36h9V27h9V18h14" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export default function CareerDashboard() {
  const [view, setView] = useState<View>('today')
  const [state, setState] = useState<CareerState>(() => asState(createDefaultState()))
  const [hydrated, setHydrated] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [ideaDraft, setIdeaDraft] = useState<Idea | null>(null)
  const [ideaAiOnOpen, setIdeaAiOnOpen] = useState(false)
  const [winDraft, setWinDraft] = useState<WinDraft | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [ideaFilter, setIdeaFilter] = useState<'all' | IdeaStatus>('all')
  const [periodStart, setPeriodStart] = useState(dateDaysAgo(90))
  const [periodEnd, setPeriodEnd] = useState(todayIso())
  const [selectedWinIds, setSelectedWinIds] = useState<string[]>([])
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<string[]>([])
  const [reportType, setReportType] = useState<ReportType>('monthly')
  const [reportText, setReportText] = useState('')
  const [reportGuidance, setReportGuidance] = useState<AiResponse | null>(null)
  const [growthGuidance, setGrowthGuidance] = useState<AiResponse | null>(null)
  const [aiBusy, setAiBusy] = useState('')
  const [aiError, setAiError] = useState('')
  const [growthTab, setGrowthTab] = useState<GrowthTab>('path')
  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const current = safeJsonParse(window.localStorage.getItem(STORAGE_KEY))
    const previous = PREVIOUS_STORAGE_KEYS.map((key) => safeJsonParse(window.localStorage.getItem(key))).find(Boolean) ?? null
    setState(asState(migrateState(current ?? previous, createDefaultState())))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [hydrated, state])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const activeIdeas = useMemo(() => state.ideas.filter((item) => item.status === 'inbox' || item.status === 'exploring'), [state.ideas])
  const filteredIdeas = useMemo(() => state.ideas.filter((item) => ideaFilter === 'all' || item.status === ideaFilter), [ideaFilter, state.ideas])
  const winsInPeriod = useMemo(() => selectWinsForPeriod(state.wins, periodStart, periodEnd) as Win[], [state.wins, periodStart, periodEnd])
  const coachNotes = useMemo(() => buildCoachNotes(state as unknown as Record<string, unknown>, competencies) as Array<{ title: string; text: string; ideaId?: string; winId?: string }>, [state])
  const growthPath = useMemo(() => computeGrowthPath(state as unknown as Record<string, unknown>, competencies) as {
    currentLevel: LevelKey
    nextLevel: LevelKey | null
    strongSignals: Array<{ id: string; title: string; count: number }>
    underdocumented: Array<{ id: string; title: string }>
    directions: Array<{ competencyId: string; title: string; criterion: string }>
    evidenceCount: number
  }, [state])

  function updateState(updater: (current: CareerState) => CareerState) {
    setState((current) => updater(current))
  }

  async function requestAi(action: AiAction, artifact: Record<string, unknown>, competencyIds: string[] = []) {
    setAiBusy(action)
    setAiError('')
    const payload = { profile: state.profile as unknown as Record<string, unknown>, artifact, competencyIds }
    try {
      if (!ESCADA_AI_ENDPOINT) return buildLocalGuidance(action, payload) as unknown as AiResponse
      const response = await fetch(ESCADA_AI_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, profile: state.profile, artifact, competencyIds }),
      })
      const data = await response.json() as AiResponse & { message?: string }
      if (!response.ok) throw new Error(data.message || 'Не удалось получить внешнюю подсказку')
      return data
    } catch {
      // Escada must remain useful without a network or AI provider.
      return buildLocalGuidance(action, payload) as unknown as AiResponse
    } finally {
      setAiBusy('')
    }
  }

  function submitQuickCapture(event: FormEvent) {
    event.preventDefault()
    const text = quickText.trim()
    if (!text) return
    const capture = createCapture(text) as unknown as Capture
    updateState((current) => ({ ...current, captures: [capture, ...current.captures] }))
    setQuickText('')
    setNotice('Мысль сохранена')
  }

  function classifySavedCapture(capture: Capture, kind: CaptureKind) {
    if (kind === 'idea') {
      const idea = captureToIdea(capture as unknown as Record<string, unknown>, state.profile.currentLevel) as unknown as Idea
      updateState((current) => ({
        ...current,
        captures: current.captures.map((item) => item.id === capture.id ? { ...item, status: 'converted' } : item),
        ideas: [idea, ...current.ideas],
      }))
      setIdeaDraft(idea)
      return
    }
    if (kind === 'win') {
      updateState((current) => ({ ...current, captures: current.captures.map((item) => item.id === capture.id ? { ...item, status: 'converted' } : item) }))
      setWinDraft(captureToWinDraft(capture as unknown as Record<string, unknown>) as unknown as WinDraft)
      return
    }
    updateState((current) => ({ ...current, captures: current.captures.map((item) => item.id === capture.id ? { ...item, status: 'classified', suggestedKind: 'note' } : item) }))
    setNotice('Оставлено как заметка')
  }

  function saveIdea(draft: Idea, close = true) {
    const now = new Date().toISOString()
    const text = [draft.title, draft.details, draft.nextStep, ...draft.workItems.map((item) => item.title), ...draft.notes.map((item) => item.text), ...draft.evidenceNotes.map((item) => item.text)].join(' ')
    const competencyIds = draft.competencyIds.length ? draft.competencyIds : suggestCompetencyIds(text, competencies, competencyKeywords)
    const inferred = inferLevelSignal(text, state.profile.currentLevel) as { level: LevelKey; reason: string }
    const behaviorRefs = draft.behaviorRefs.length ? draft.behaviorRefs : suggestBehaviorRefs(text, competencyIds, competencies, inferred.level)
    const prepared = { ...draft, competencyIds, levelSignal: inferred.level, levelReason: inferred.reason, behaviorRefs, updatedAt: now }
    updateState((current) => ({
      ...current,
      ideas: current.ideas.some((item) => item.id === prepared.id)
        ? current.ideas.map((item) => item.id === prepared.id ? prepared : item)
        : [prepared, ...current.ideas],
    }))
    setIdeaDraft(close ? null : prepared)
    setNotice('Идея сохранена')
    return prepared
  }

  function startWinFromIdea(idea: Idea) {
    const persisted = saveIdea(idea, false)
    const promoted = promoteIdeaToWin(persisted as unknown as Record<string, unknown>, { date: todayIso() }) as unknown as Win
    setIdeaDraft(null)
    setWinDraft({ ...promoted, id: undefined, impact: '', metrics: '', confirmedBy: '' })
  }

  function saveWin(draft: WinDraft) {
    const now = new Date().toISOString()
    const text = [draft.title, draft.impact, draft.evidence, draft.metrics, draft.confirmedBy, ...draft.workSummary].join(' ')
    const competencyIds = draft.competencyIds.length ? draft.competencyIds : suggestCompetencyIds(text, competencies, competencyKeywords)
    const inferred = inferLevelSignal(text, state.profile.currentLevel) as { level: LevelKey; reason: string }
    const behaviorRefs = draft.behaviorRefs.length ? draft.behaviorRefs : suggestBehaviorRefs(text, competencyIds, competencies, inferred.level)
    const prepared = { ...draft, competencyIds, levelSignal: inferred.level, behaviorRefs }
    updateState((current) => ({
      ...current,
      wins: prepared.id
        ? current.wins.map((item) => item.id === prepared.id ? { ...item, ...prepared } as Win : item)
        : [{ ...prepared, id: createId('win'), createdAt: now } as Win, ...current.wins],
      ideas: prepared.sourceIdeaId
        ? current.ideas.map((item) => item.id === prepared.sourceIdeaId ? { ...item, status: 'won', updatedAt: now } : item)
        : current.ideas,
    }))
    setWinDraft(null)
    setNotice('Win сохранена')
  }

  function saveReport() {
    if (!reportText.trim()) return
    const report: Report = {
      id: createId('report'),
      title: `${reportTypeLabels[reportType]} · ${formatDate(periodStart)} — ${formatDate(periodEnd)}`,
      type: reportType,
      periodStart,
      periodEnd,
      winIds: selectedWinIds,
      ideaIds: selectedIdeaIds,
      content: reportText,
      createdAt: new Date().toISOString(),
    }
    updateState((current) => ({ ...current, reports: [report, ...current.reports] }))
    setNotice('Версия отчёта сохранена')
  }

  async function generateReport() {
    const wins = state.wins.filter((item) => selectedWinIds.includes(item.id))
    const ideas = state.ideas.filter((item) => selectedIdeaIds.includes(item.id))
    const response = await requestAi('report_draft', { reportType: reportTypeLabels[reportType], periodStart, periodEnd, wins, ideas }, [...new Set([...wins.flatMap((item) => item.competencyIds), ...ideas.flatMap((item) => item.competencyIds)])])
    setReportText(response.draftMarkdown ?? '')
    setReportGuidance(response)
  }

  async function reviewReport() {
    const response = await requestAi('report_review', { reportType: reportTypeLabels[reportType], content: reportText, selectedWins: state.wins.filter((item) => selectedWinIds.includes(item.id)) })
    setReportGuidance(response)
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

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result)) as Record<string, unknown>
        setState(asState(migrateState(raw, createDefaultState())))
        setNotice('Данные импортированы')
      } catch { setNotice('Не удалось прочитать файл') }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  if (!hydrated) return <main className={styles.loading}>Загружаем Эскаду…</main>

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.brandMark}><LadderLogo /></span><div><strong>Эскада</strong><small>профессиональная память</small></div></div>
        <nav className={styles.nav} aria-label="Основная навигация">
          {navItems.map((item) => <button key={item.id} type="button" className={view === item.id ? styles.navActive : styles.navItem} onClick={() => setView(item.id)}><span className={styles.navIcon}>{item.icon}</span><span><strong>{item.label}</strong><small>{item.caption}</small></span></button>)}
        </nav>
        <div className={styles.sidebarCard}><span>Текущий уровень</span><strong>{levelLabels[state.profile.currentLevel]}</strong><p>Ожидания и подсказки меняются вместе с уровнем профиля.</p></div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div><p className={styles.eyebrow}>Записал → развил → подтвердил → оформил</p><h1>{navItems.find((item) => item.id === view)?.label}</h1></div>
          <button type="button" className={styles.profileChip} onClick={() => setProfileOpen(true)}><span>{state.profile.name.slice(0, 1) || 'Э'}</span><div><strong>{state.profile.name || 'Мой профиль'}</strong><small>{state.profile.role}</small></div></button>
        </header>

        {view === 'today' && <TodayView quickText={quickText} onQuickText={setQuickText} onSubmit={submitQuickCapture} captures={state.captures.slice(0, 4)} activeIdeas={activeIdeas.slice(0, 3)} coachNote={coachNotes[0]} onClassify={classifySavedCapture} onOpenIdea={(idea) => { setIdeaAiOnOpen(false); setIdeaDraft(idea) }} onNewIdea={() => setIdeaDraft(newIdea(state.profile.currentLevel))} onOpenWin={() => setWinDraft(emptyWin())} onView={setView} />}
        {view === 'ideas' && <IdeasView ideas={filteredIdeas} filter={ideaFilter} onFilter={setIdeaFilter} onNew={() => setIdeaDraft(newIdea(state.profile.currentLevel))} onOpen={(idea) => { setIdeaAiOnOpen(false); setIdeaDraft(idea) }} onAi={(idea) => { setIdeaAiOnOpen(true); setIdeaDraft(idea) }} />}
        {view === 'wins' && <WinsView wins={state.wins} onNew={() => setWinDraft(emptyWin())} onOpen={(win) => setWinDraft({ ...win })} onReports={() => setView('reports')} />}
        {view === 'reports' && <ReportsView wins={winsInPeriod} ideas={activeIdeas} selectedWinIds={selectedWinIds} selectedIdeaIds={selectedIdeaIds} periodStart={periodStart} periodEnd={periodEnd} reportType={reportType} reportText={reportText} reports={state.reports} guidance={reportGuidance} busy={aiBusy} error={aiError} onPeriodStart={setPeriodStart} onPeriodEnd={setPeriodEnd} onReportType={setReportType} onToggleWin={(id) => setSelectedWinIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onToggleIdea={(id) => setSelectedIdeaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onSelectAll={() => setSelectedWinIds(winsInPeriod.map((item) => item.id))} onGenerate={generateReport} onReview={reviewReport} onReportText={setReportText} onSave={saveReport} />}
        {view === 'growth' && <GrowthView profile={state.profile} path={growthPath} tab={growthTab} onTab={setGrowthTab} guidance={growthGuidance} busy={aiBusy} error={aiError} onAi={async () => setGrowthGuidance(await requestAi('growth_guidance', { ideas: activeIdeas, wins: state.wins, growthPath }))} onCreateIdea={(competency) => { const idea = newIdea(state.profile.currentLevel, `Развить: ${competency.shortTitle}`); idea.competencyIds = [competency.id]; setIdeaDraft(idea) }} />}
      </section>

      <nav className={styles.mobileNav} aria-label="Мобильная навигация">{navItems.map((item) => <button key={item.id} type="button" className={view === item.id ? styles.mobileActive : ''} onClick={() => setView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>

      {!state.onboardingComplete && <Onboarding initial={state.profile} onComplete={(profile) => updateState((current) => ({ ...current, onboardingComplete: true, profile }))} onDemo={() => setState(asState(demoState()))} />}
      {profileOpen && <ProfileModal profile={state.profile} onClose={() => setProfileOpen(false)} onSave={(profile) => { updateState((current) => ({ ...current, profile })); setProfileOpen(false); setNotice('Профиль обновлён') }} onExport={exportData} onImport={() => importRef.current?.click()} />}
      {ideaDraft && <IdeaWorkspace draft={ideaDraft} profile={state.profile} autoAi={ideaAiOnOpen} busy={aiBusy} error={aiError} onClose={() => { setIdeaDraft(null); setIdeaAiOnOpen(false) }} onSave={saveIdea} onPromote={startWinFromIdea} onAi={(idea) => requestAi('idea_review', idea as unknown as Record<string, unknown>, idea.competencyIds)} />}
      {winDraft && <WinModal draft={winDraft} profile={state.profile} busy={aiBusy} error={aiError} onClose={() => setWinDraft(null)} onSave={saveWin} onAi={(win) => requestAi('win_rewrite', win as unknown as Record<string, unknown>, win.competencyIds)} />}
      <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json" onChange={importData} />
      {notice && <div className={styles.toast} role="status">{notice}</div>}
    </main>
  )
}

function TodayView({ quickText, onQuickText, onSubmit, captures, activeIdeas, coachNote, onClassify, onOpenIdea, onNewIdea, onOpenWin, onView }: {
  quickText: string
  onQuickText: (value: string) => void
  onSubmit: (event: FormEvent) => void
  captures: Capture[]
  activeIdeas: Idea[]
  coachNote?: { title: string; text: string; ideaId?: string }
  onClassify: (capture: Capture, kind: CaptureKind) => void
  onOpenIdea: (idea: Idea) => void
  onNewIdea: () => void
  onOpenWin: () => void
  onView: (view: View) => void
}) {
  return <div className={styles.pageStack}>
    <section className={`${styles.heroCard} ${styles.calmHero}`}>
      <div className={styles.heroCopy}><span className={styles.pill}>Быстрая мысль</span><h2>Что произошло?</h2><p>Запишите идею, результат или наблюдение свободным текстом. Тип можно выбрать позже.</p></div>
      <form className={`${styles.quickCapture} ${styles.quickThought}`} onSubmit={onSubmit}><textarea value={quickText} onChange={(event) => onQuickText(event.target.value)} placeholder="Например: новый угол с собственными данными может заинтересовать бизнес-СМИ…" aria-label="Быстрая заметка" /><button type="submit" className={styles.primaryButton}>Записать</button></form>
      <div className={styles.compactActions}><button type="button" className={styles.textButton} onClick={onNewIdea}>Открыть новую идею</button><button type="button" className={styles.textButton} onClick={onOpenWin}>Зафиксировать win</button></div>
    </section>

    {captures.length > 0 && <section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Последние записи</span><h3>Разобрать позже</h3></div></div><div className={styles.captureList}>{captures.map((capture) => {
      const suggestion = classifyCapture(capture.text)
      return <article className={styles.captureCard} key={capture.id}><p>{capture.text}</p>{capture.status === 'unclassified' ? <div className={styles.suggestionBar}><span>{suggestion.reason}</span><div><button type="button" className={styles.secondaryButton} onClick={() => onClassify(capture, 'idea')}>Похоже на идею</button><button type="button" className={styles.secondaryButton} onClick={() => onClassify(capture, 'win')}>Похоже на результат</button><button type="button" className={styles.secondaryButton} onClick={() => onClassify(capture, 'note')}>Оставить заметкой</button></div></div> : <span className={styles.softLabel}>{capture.status === 'converted' ? 'Перенесено' : 'Заметка'}</span>}</article>
    })}</div></section>}

    <div className={styles.twoColumn}>
      <section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Продолжить</span><h3>Идеи в работе</h3></div><button className={styles.secondaryButton} type="button" onClick={() => onView('ideas')}>Все идеи</button></div><div className={styles.cardList}>{activeIdeas.length ? activeIdeas.map((idea) => <article className={styles.ideaCompact} key={idea.id}><div><span className={styles.statusBadge} data-status={idea.status}>{statusLabels[idea.status]}</span><h4>{idea.title}</h4><p>{idea.nextStep || 'Следующий шаг пока не определён'}</p></div><button type="button" className={styles.secondaryButton} onClick={() => onOpenIdea(idea)}>Открыть</button></article>) : <EmptyState title="Пока нет идей" text="Запишите свободную мысль или создайте идею сразу." action="Создать идею" onAction={onNewIdea} />}</div></section>
      <section className={styles.promptCard}><div className={styles.promptCardCopy}><span className={styles.eyebrow}>Подсказка Эскады</span><h3>{coachNote?.title || 'Сохраняйте доказательства по ходу работы'}</h3><p>{coachNote?.text || 'Ссылка, артефакт, отзыв или принятое решение делают будущий отчёт убедительнее.'}</p></div>{coachNote?.ideaId && <button type="button" className={styles.secondaryButton} onClick={() => onView('ideas')}>Открыть идеи</button>}</section>
    </div>
  </div>
}

function IdeasView({ ideas, filter, onFilter, onNew, onOpen, onAi }: { ideas: Idea[]; filter: 'all' | IdeaStatus; onFilter: (value: 'all' | IdeaStatus) => void; onNew: () => void; onOpen: (idea: Idea) => void; onAi: (idea: Idea) => void }) {
  return <div className={styles.pageStack}><section className={styles.pageIntro}><div><span className={styles.eyebrow}>Рабочая память</span><h2>Идеи</h2><p>Карточки показывают только то, что нужно для следующего действия. Вся детализация находится внутри.</p></div><button className={styles.primaryButton} type="button" onClick={onNew}>Новая идея</button></section><div className={styles.filterBar}>{(['all', 'inbox', 'exploring', 'won', 'archived'] as const).map((value) => <button type="button" key={value} className={filter === value ? styles.filterActive : ''} onClick={() => onFilter(value)}>{value === 'all' ? 'Все' : statusLabels[value]}</button>)}</div><section className={styles.ideaGrid}>{ideas.length ? ideas.map((idea) => <article className={`${styles.ideaCard} ${styles.minimalIdeaCard}`} key={idea.id}><div className={styles.cardTopline}><span className={styles.statusBadge} data-status={idea.status}>{statusLabels[idea.status]}</span></div><h3>{idea.title}</h3><div className={styles.nextStep}><span>Следующий шаг</span><p>{idea.nextStep || 'Пока не определён'}</p></div><div className={styles.cardActions}><button type="button" className={styles.secondaryButton} onClick={() => onOpen(idea)}>Открыть</button><button type="button" className={styles.aiMiniButton} onClick={() => onAi(idea)}>✦ ИИ-подсказка</button></div></article>) : <EmptyState title="Идей пока нет" text="Запишите мысль на экране «Сегодня» или создайте карточку сразу." action="Создать идею" onAction={onNew} />}</section></div>
}

function WinsView({ wins, onNew, onOpen, onReports }: { wins: Win[]; onNew: () => void; onOpen: (win: Win) => void; onReports: () => void }) {
  return <div className={styles.pageStack}><section className={styles.pageIntro}><div><span className={styles.eyebrow}>Доказательства роста</span><h2>Wins</h2><p>Что произошло, почему это важно и чем подтверждается.</p></div><div className={styles.buttonRow}><button className={styles.secondaryButton} type="button" onClick={onReports}>Собрать отчёт</button><button className={styles.primaryButton} type="button" onClick={onNew}>Добавить win</button></div></section><section className={styles.winList}>{wins.length ? wins.map((win) => { const gaps = winGapHints(win as unknown as Record<string, unknown>); return <article className={`${styles.winCard} ${styles.minimalWinCard}`} key={win.id}><div className={styles.winDate}>{formatDate(win.date)}</div><div className={styles.winBody}><h3>{win.title}</h3><p>{win.impact || 'Значимость результата пока не описана'}</p><div className={styles.evidenceStats}><span className={gaps.length ? styles.warningDot : styles.successDot}>{gaps.length ? `${gaps.length} пункта стоит усилить` : 'Доказательство заполнено'}</span></div></div><button type="button" className={styles.secondaryButton} onClick={() => onOpen(win)}>Открыть</button></article> }) : <EmptyState title="Wins пока нет" text="Зафиксируйте изменение, результат и доказательство." action="Добавить win" onAction={onNew} />}</section></div>
}

function ReportsView({ wins, ideas, selectedWinIds, selectedIdeaIds, periodStart, periodEnd, reportType, reportText, reports, guidance, busy, error, onPeriodStart, onPeriodEnd, onReportType, onToggleWin, onToggleIdea, onSelectAll, onGenerate, onReview, onReportText, onSave }: {
  wins: Win[]
  ideas: Idea[]
  selectedWinIds: string[]
  selectedIdeaIds: string[]
  periodStart: string
  periodEnd: string
  reportType: ReportType
  reportText: string
  reports: Report[]
  guidance: AiResponse | null
  busy: string
  error: string
  onPeriodStart: (value: string) => void
  onPeriodEnd: (value: string) => void
  onReportType: (value: ReportType) => void
  onToggleWin: (id: string) => void
  onToggleIdea: (id: string) => void
  onSelectAll: () => void
  onGenerate: () => Promise<void>
  onReview: () => Promise<void>
  onReportText: (value: string) => void
  onSave: () => void
}) {
  return <div className={styles.pageStack}>
    <section className={styles.pageIntro}>
      <div><span className={styles.eyebrow}>Вы контролируете содержание</span><h2>Соберите отчёт</h2><p>Выберите период, тип документа и только те достижения, которые должны войти в черновик.</p></div>
    </section>

    <section className={styles.reportTypeGrid}>{(Object.entries(reportTypeLabels) as Array<[ReportType, string]>).map(([value, label]) => <button type="button" key={value} className={reportType === value ? styles.reportTypeActive : styles.reportTypeCard} onClick={() => onReportType(value)}><strong>{label}</strong></button>)}</section>

    <section className={`${styles.panel} ${styles.reportBuilder}`}>
      <div className={styles.dateGrid}><label>С<input type="date" value={periodStart} onChange={(event) => onPeriodStart(event.target.value)} /></label><label>По<input type="date" value={periodEnd} onChange={(event) => onPeriodEnd(event.target.value)} /></label></div>
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Достижения</span><h3>Выберите wins</h3></div><button className={styles.textButton} type="button" onClick={onSelectAll}>Выбрать все</button></div>
      <div className={styles.reportWins}>{wins.map((win) => <label className={styles.reportWin} key={win.id}><input type="checkbox" checked={selectedWinIds.includes(win.id)} onChange={() => onToggleWin(win.id)} /><div><strong>{win.title}</strong><span>{formatDate(win.date)}</span>{winGapHints(win as unknown as Record<string, unknown>).slice(0, 1).map((hint) => <small key={hint}>{hint}</small>)}</div></label>)}</div>
      <details className={styles.optionalBlock}><summary>Добавить идеи в работе — необязательно</summary><div className={styles.reportWins}>{ideas.map((idea) => <label className={styles.reportWin} key={idea.id}><input type="checkbox" checked={selectedIdeaIds.includes(idea.id)} onChange={() => onToggleIdea(idea.id)} /><div><strong>{idea.title}</strong><span>{idea.nextStep || 'Без следующего шага'}</span></div></label>)}</div></details>
      <div className={styles.reportActionRow}><p>Эскада соберёт текст только из выбранных записей. Цифры и влияние нужно подтвердить самостоятельно.</p><button className={styles.primaryButton} type="button" disabled={!selectedWinIds.length || busy === 'report_draft'} onClick={() => void onGenerate()}>{busy === 'report_draft' ? 'Эскада собирает…' : reportText ? 'Пересобрать черновик' : 'Собрать черновик с Эскадой'}</button></div>
      {error && <p className={styles.aiError}>{error}</p>}
    </section>

    {reportText && <section className={styles.reportEditorPanel}>
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Редактор</span><h3>{reportTypeLabels[reportType]}</h3><p>Это рабочий текст, а не маленькое окно предпросмотра. Отредактируйте его перед сохранением.</p></div></div>
      <textarea className={styles.reportEditorTextarea} value={reportText} onChange={(event) => onReportText(event.target.value)} aria-label="Текст отчёта" />
      <div className={styles.reportEditorActions}><button className={styles.secondaryButton} type="button" disabled={busy === 'report_review'} onClick={() => void onReview()}>{busy === 'report_review' ? 'Проверяем…' : 'Проверить по шкале'}</button><button className={styles.primaryButton} type="button" onClick={onSave}>Сохранить версию</button></div>
    </section>}

    {guidance && <AiGuidancePanel guidance={guidance} />}
    {reports.length > 0 && <section className={styles.savedReports}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>История</span><h3>Сохранённые версии</h3></div></div>{reports.slice(0, 5).map((report) => <article key={report.id}><strong>{report.title}</strong><span>{formatDate(report.createdAt.slice(0, 10))}</span></article>)}</section>}
  </div>
}

function GrowthView({ profile, path, tab, onTab, guidance, busy, error, onAi, onCreateIdea }: { profile: Profile; path: ReturnType<typeof computeGrowthPath> & { currentLevel: LevelKey; nextLevel: LevelKey | null; strongSignals: Array<{ id: string; title: string; count: number }>; underdocumented: Array<{ id: string; title: string }>; directions: Array<{ competencyId: string; title: string; criterion: string }> }; tab: GrowthTab; onTab: (tab: GrowthTab) => void; guidance: AiResponse | null; busy: string; error: string; onAi: () => Promise<void>; onCreateIdea: (competency: Competency) => void }) {
  return <div className={styles.pageStack}><section className={styles.pageIntro}><div><span className={styles.eyebrow}>Ожидания, а не оценка</span><h2>Рост</h2><p>Шкала помогает понимать текущие ожидания и следующий шаг. Она не превращается в обязательный чеклист.</p></div></section><div className={styles.segmentedControl}><button type="button" className={tab === 'path' ? styles.segmentActive : ''} onClick={() => onTab('path')}>Мой путь</button><button type="button" className={tab === 'scale' ? styles.segmentActive : ''} onClick={() => onTab('scale')}>Шкала</button></div>{tab === 'path' ? <><section className={styles.progressHero}><div><span className={styles.eyebrow}>Ваш контекст</span><h2>{profile.role}</h2><p>{profile.market || 'Рынок или команда не указаны'}</p></div><div className={styles.levelRoute}><div><small>Текущий уровень</small><strong>{levelLabels[profile.currentLevel]}</strong></div><span>→</span><div><small>{path.nextLevel ? 'Следующий уровень' : 'Следующий масштаб'}</small><strong>{path.nextLevel ? levelLabels[path.nextLevel] : 'Больше системного влияния'}</strong></div></div></section><div className={styles.progressGrid}><section className={styles.progressCard}><span className={styles.eyebrow}>Сильные сигналы</span><h3>Уже подтверждаются работой</h3>{path.strongSignals.length ? path.strongSignals.map((item) => <div className={styles.progressSignal} key={item.id}><strong>{item.title}</strong><span>{item.count} сигналов</span></div>) : <p className={styles.muted}>Добавьте идеи и wins — Эскада покажет устойчивые сигналы.</p>}</section><section className={styles.progressCard}><span className={styles.eyebrow}>Недостаточно подтверждено</span><h3>Не пробел, а зона наблюдения</h3>{path.underdocumented.map((item) => <div className={styles.progressSignal} key={item.id}><strong>{item.title}</strong><span>мало записей</span></div>)}</section></div><section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Следующий фокус</span><h3>1–3 направления</h3></div><button className={styles.aiMiniButton} type="button" disabled={busy === 'growth_guidance'} onClick={() => void onAi()}>{busy === 'growth_guidance' ? 'Эскада думает…' : '✦ Что развивать дальше?'}</button></div><div className={styles.directionGrid}>{path.directions.map((item) => <article key={item.competencyId}><strong>{item.title}</strong><p>{item.criterion}</p><button type="button" className={styles.textButton} onClick={() => { const competency = competencyById(item.competencyId); if (competency) onCreateIdea(competency) }}>Создать идею</button></article>)}</div>{error && <p className={styles.aiError}>{error}</p>}</section>{guidance && <AiGuidancePanel guidance={guidance} />}</> : <ScaleReference profile={profile} onCreateIdea={onCreateIdea} />}</div>
}

function ScaleReference({ profile, onCreateIdea }: { profile: Profile; onCreateIdea: (competency: Competency) => void }) {
  const target = nextLevel(profile.currentLevel)
  return <section className={styles.competencyGrid}>{competencies.map((competency, index) => <article className={styles.competencyCard} key={competency.id}><div className={styles.competencyNumber}>{String(index + 1).padStart(2, '0')}</div><div><span className={styles.domainBadge}>{competency.shortTitle}</span><h3>{competency.title}</h3><p>{competency.summary}</p><div className={styles.expectationColumns}><section><small>Ожидания сейчас · {levelLabels[profile.currentLevel]}</small><ul>{competency.levels[profile.currentLevel].map((criterion) => <li key={criterion.id}>{criterion.text}</li>)}</ul></section><section><small>{target ? `Следующий уровень · ${levelLabels[target]}` : 'Усиление влияния'}</small><ul>{competency.levels[target ?? profile.currentLevel].map((criterion) => <li key={criterion.id}>{criterion.text}</li>)}</ul></section></div><button className={styles.textButton} type="button" onClick={() => onCreateIdea(competency)}>Создать growth idea</button></div></article>)}</section>
}

function IdeaWorkspace({ draft: initial, profile, autoAi, busy, error, onClose, onSave, onPromote, onAi }: { draft: Idea; profile: Profile; autoAi: boolean; busy: string; error: string; onClose: () => void; onSave: (idea: Idea, close?: boolean) => Idea; onPromote: (idea: Idea) => void; onAi: (idea: Idea) => Promise<AiResponse> }) {
  const [draft, setDraft] = useState(initial)
  const [workText, setWorkText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [evidenceText, setEvidenceText] = useState('')
  const [guidance, setGuidance] = useState<AiResponse | null>(null)
  const hasAutoRun = useRef(false)
  const text = [draft.title, draft.details, draft.nextStep, ...draft.workItems.map((item) => item.title), ...draft.notes.map((item) => item.text)].join(' ')
  const suggestedCompetencies = suggestCompetencyIds(text, competencies, competencyKeywords)
  const inferred = inferLevelSignal(text, profile.currentLevel) as { level: LevelKey; reason: string }
  const selectedCompetencies = draft.competencyIds.length ? draft.competencyIds : suggestedCompetencies
  const currentExpectations = selectedCompetencies.flatMap((id) => competencyById(id)?.levels[profile.currentLevel].slice(0, 2) ?? []).slice(0, 3)
  const target = nextLevel(profile.currentLevel)
  const nextExpectations = target ? selectedCompetencies.flatMap((id) => competencyById(id)?.levels[target].slice(0, 2) ?? []).slice(0, 3) : []

  async function runAi() { setGuidance(await onAi(draft)) }
  useEffect(() => { if (autoAi && !hasAutoRun.current) { hasAutoRun.current = true; void runAi() } }, [autoAi])

  function addWork() { const title = workText.trim(); if (!title) return; setDraft((current) => ({ ...current, status: 'exploring', workItems: [...current.workItems, { id: createId('work'), title, status: 'backlog', createdAt: new Date().toISOString(), completedAt: null }] })); setWorkText('') }
  function moveWork(id: string, status: WorkStatus) { setDraft((current) => ({ ...current, workItems: current.workItems.map((item) => item.id === id ? { ...item, status, completedAt: status === 'done' ? new Date().toISOString() : null } : item) })) }
  function addNote() { const value = noteText.trim(); if (!value) return; setDraft((current) => ({ ...current, notes: [...current.notes, { id: createId('note'), text: value, createdAt: new Date().toISOString() }] })); setNoteText('') }
  function addEvidence() { const value = evidenceText.trim(); if (!value) return; setDraft((current) => ({ ...current, evidenceNotes: [...current.evidenceNotes, { id: createId('evidence'), text: value, createdAt: new Date().toISOString() }] })); setEvidenceText('') }
  function toggleCompetency(id: string) { setDraft((current) => ({ ...current, competencyIds: current.competencyIds.includes(id) ? current.competencyIds.filter((item) => item !== id) : [...current.competencyIds, id] })) }

  return <div className={styles.workspaceBackdrop}><section className={styles.ideaWorkspace}><header className={styles.workspaceHeader}><div><span className={styles.eyebrow}>Идея как рабочее пространство</span><h2>{draft.title || 'Новая идея'}</h2><p>Детали остаются внутри. Карточка в списке будет минималистичной.</p></div><button type="button" onClick={onClose}>×</button></header><div className={styles.ideaWorkspaceGrid}><div className={styles.ideaMainColumn}><section className={styles.workspaceSection}><label className={styles.field}>Название идеи<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} autoFocus /></label><label className={styles.field}>Контекст<textarea className={styles.largeTextarea} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="Почему эта идея появилась, какую проблему или возможность вы заметили?" /></label><label className={styles.field}>Следующий шаг<textarea value={draft.nextStep} onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })} placeholder="Одно конкретное действие" /></label></section><section className={styles.workspaceSection}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Лёгкий канбан</span><h3>Ход работы</h3></div></div><div className={styles.addInline}><input value={workText} onChange={(event) => setWorkText(event.target.value)} placeholder="Добавить этап" /><button type="button" onClick={addWork}>Добавить</button></div><div className={styles.miniKanban}>{(['backlog', 'doing', 'done'] as WorkStatus[]).map((status) => {
      const items = draft.workItems.filter((item) => item.status === status)
      return <div className={styles.kanbanColumn} data-status={status} key={status}><header className={styles.kanbanHeader}><span className={styles.kanbanStatusDot} aria-hidden="true" /><strong>{workStatusLabels[status]}</strong><span className={styles.kanbanCount}>{items.length}</span></header><div className={styles.kanbanItems}>{items.length ? items.map((item) => <article className={styles.workItem} key={item.id}><p>{item.title}</p><div>{status !== 'backlog' && <button className={styles.kanbanMoveButton} type="button" aria-label="Переместить этап назад" onClick={() => moveWork(item.id, status === 'done' ? 'doing' : 'backlog')}>←</button>}{status !== 'done' && <button className={styles.kanbanMoveButton} type="button" aria-label="Переместить этап вперёд" onClick={() => moveWork(item.id, status === 'backlog' ? 'doing' : 'done')}>→</button>}</div></article>) : <small>Здесь пока нет этапов</small>}</div></div>
    })}</div></section><section className={styles.workspaceSection}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Рабочие заметки</span><h3>Логика и наблюдения</h3></div></div><div className={styles.addInline}><input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Решение, наблюдение, обратная связь…" /><button type="button" onClick={addNote}>Добавить</button></div><div className={styles.notesTimeline}>{draft.notes.map((note) => <article key={note.id}><span>{formatDate(note.createdAt.slice(0, 10))}</span><p>{note.text}</p></article>)}</div></section><section className={styles.workspaceSection}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Доказательства</span><h3>Что сохранить для будущего win</h3></div></div><div className={styles.addInline}><input value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} placeholder="Ссылка, артефакт, отзыв, метрика, решение…" /><button type="button" onClick={addEvidence}>Добавить</button></div><div className={styles.evidenceList}>{draft.evidenceNotes.map((item) => <article key={item.id}><span>◆</span><p>{item.text}</p></article>)}</div></section></div><aside className={styles.ideaSideColumn}><section className={styles.signalCard}><span className={styles.eyebrow}>Встроенная карьерная подсказка</span><h3>{levelLabels[inferred.level]}</h3><p>{inferred.reason}</p><details><summary>Ожидания текущего уровня</summary><ul>{currentExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>{target && <details><summary>Как выйти на {levelLabels[target]}</summary><ul>{nextExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}</section><section className={styles.workspaceSection}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Компетенции</span><h3>Контекст идеи</h3></div></div><div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={draft.competencyIds.includes(competency.id) ? styles.choiceActive : ''} onClick={() => toggleCompetency(competency.id)}>{competency.shortTitle}</button>)}</div></section><section className={styles.aiPanel}><span className={styles.eyebrow}>Только по запросу</span><h3>Разобрать с Эскадой</h3><p>Эскада сопоставит карточку с релевантными пунктами шкалы и подскажет следующий шаг. Внешние карьерные фреймворки не используются.</p><button className={styles.primaryButton} type="button" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Разбираем…' : 'Разобрать с Эскадой'}</button>{error && <p className={styles.aiError}>{error}</p>}</section>{guidance && <AiGuidancePanel guidance={guidance} compact onSaveNextStep={() => setDraft({ ...draft, nextStep: guidance.nextStep })} />}</aside></div><footer className={styles.workspaceFooter}><button className={styles.secondaryButton} type="button" onClick={onClose}>Закрыть</button><div><button className={styles.secondaryButton} type="button" disabled={!draft.title.trim()} onClick={() => onPromote(draft)}>Оформить win</button><button className={styles.primaryButton} type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Сохранить идею</button></div></footer></section></div>
}

function WinModal({ draft: initial, profile, busy, error, onClose, onSave, onAi }: { draft: WinDraft; profile: Profile; busy: string; error: string; onClose: () => void; onSave: (draft: WinDraft) => void; onAi: (draft: WinDraft) => Promise<AiResponse> }) {
  const [draft, setDraft] = useState(initial)
  const [guidance, setGuidance] = useState<AiResponse | null>(null)
  const gaps = winGapHints(draft as unknown as Record<string, unknown>)
  async function runAi() { setGuidance(await onAi(draft)) }
  return <Modal title={draft.id ? 'Открыть win' : 'Зафиксировать win'} subtitle="Просто, но доказуемо. Эскада не будет придумывать недостающие факты." onClose={onClose}><form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) onSave(draft) }}><label className={styles.field}>Что произошло?<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label><label className={styles.field}>Почему это важно?<textarea value={draft.impact} onChange={(event) => setDraft({ ...draft, impact: event.target.value })} /></label><label className={styles.field}>Чем это подтверждается?<textarea value={draft.evidence} onChange={(event) => setDraft({ ...draft, evidence: event.target.value })} /></label><details className={styles.optionalBlock}><summary>Дополнительные детали — необязательно</summary><label className={styles.field}>Что изменилось в цифрах?<input value={draft.metrics} onChange={(event) => setDraft({ ...draft, metrics: event.target.value })} placeholder="Только реальные значения" /></label><label className={styles.field}>Кто подтвердил результат?<input value={draft.confirmedBy} onChange={(event) => setDraft({ ...draft, confirmedBy: event.target.value })} placeholder="Руководитель, команда, клиент — если это было" /></label></details>{gaps.length > 0 && <div className={styles.guidanceBanner}><strong>Чего не хватает для сильной формулировки</strong><ul>{gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>}<button className={styles.aiMiniButton} type="button" disabled={busy === 'win_rewrite'} onClick={() => void runAi()}>{busy === 'win_rewrite' ? 'Усиливаем…' : '✦ Усилить формулировку'}</button>{error && <p className={styles.aiError}>{error}</p>}{guidance && <AiGuidancePanel guidance={guidance} compact onApplyRewrite={guidance.rewrite ? () => setDraft({ ...draft, ...(guidance.rewrite ?? {}) }) : undefined} />}<div className={styles.formGrid}><label>Дата<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label className={styles.checkboxField}><input type="checkbox" checked={draft.reportReady} onChange={(event) => setDraft({ ...draft, reportReady: event.target.checked })} /><span>Предлагать для отчётов</span></label></div><div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button><button className={styles.primaryButton} type="submit">Сохранить win</button></div></form></Modal>
}

function AiGuidancePanel({ guidance, compact = false, onSaveNextStep, onApplyRewrite }: { guidance: AiResponse; compact?: boolean; onSaveNextStep?: () => void; onApplyRewrite?: () => void }) {
  return <section className={`${styles.aiResult} ${compact ? styles.aiResultCompact : ''}`}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Подсказка Эскады</span><h3>{guidance.headline}</h3></div></div><div className={styles.aiResultGrid}><div><strong>Что уже хорошо</strong>{guidance.strengths.length ? guidance.strengths.map((item) => <p key={`${item.criterionId}-${item.text}`}>{item.text}</p>) : <p>Недостаточно оснований для уверенного вывода.</p>}</div><div><strong>Как превысить ожидания</strong>{guidance.stretch.length ? guidance.stretch.map((item) => <p key={`${item.criterionId}-${item.text}`}>{item.text}</p>) : <p>Шкала не даёт дополнительного вывода по этой записи.</p>}</div><div><strong>Что сохранить как доказательство</strong>{guidance.evidence.map((item) => <p key={item}>{item}</p>)}</div><div><strong>Следующий шаг</strong><p>{guidance.nextStep || 'Следующий шаг не предложен: в записи недостаточно контекста.'}</p>{onSaveNextStep && guidance.nextStep && <button type="button" onClick={onSaveNextStep}>Сохранить как следующий шаг</button>}{onApplyRewrite && <button type="button" onClick={onApplyRewrite}>Применить формулировку</button>}</div></div><details className={styles.aiSources}><summary>Почему Эскада так решила?</summary>{guidance.sources.slice(0, 8).map((source) => <article key={source.id}><strong>{source.competencyTitle} · {levelLabels[source.level]}</strong><p>{source.text}</p><small>Шкала компетенций, стр. {source.sourcePage}</small></article>)}</details><small className={styles.aiCaveat}>{guidance.caveat}</small></section>
}

function ProfileModal({ profile: initial, onClose, onSave, onExport, onImport }: { profile: Profile; onClose: () => void; onSave: (profile: Profile) => void; onExport: () => void; onImport: () => void }) {
  const [profile, setProfile] = useState(initial)
  return <Modal title="Профиль" subtitle="Название должности и уровень задаются отдельно: свободный title не определяет ожидания шкалы." onClose={onClose}><form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); onSave(profile) }}><label className={styles.field}>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label className={styles.field}>Текущая должность<input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} required /></label><label className={styles.field}>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}>Рынок или команда<input value={profile.market} onChange={(event) => setProfile({ ...profile, market: event.target.value })} /></label><div className={styles.optionalBlock}><div><strong>Локальные данные</strong><span>Экспортируйте резервную копию или импортируйте её на другом устройстве.</span></div><div className={styles.buttonRow}><button type="button" className={styles.secondaryButton} onClick={onExport}>Экспорт</button><button type="button" className={styles.secondaryButton} onClick={onImport}>Импорт</button></div></div><div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button><button className={styles.primaryButton} type="submit">Сохранить</button></div></form></Modal>
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [onClose])
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className={styles.modalHeader}><div><span className={styles.eyebrow}>Эскада</span><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button type="button" aria-label="Закрыть" onClick={onClose}>×</button></div>{children}</section></div>
}

function Onboarding({ initial, onComplete, onDemo }: { initial: Profile; onComplete: (profile: Profile) => void; onDemo: () => void }) {
  const [profile, setProfile] = useState(initial)
  return <div className={styles.onboardingBackdrop}><section className={styles.onboarding}><div className={styles.onboardingVisual}><span className={styles.brandMark}><LadderLogo /></span><p>Эскада</p><h1>Записал.<br />Развил.<br />Подтвердил.</h1><div className={styles.onboardingFlow}><span>Мысль</span><i>→</i><span>Win</span><i>→</i><span>Рост</span></div></div><form onSubmit={(event) => { event.preventDefault(); onComplete(profile) }}><span className={styles.eyebrow}>Настройка за минуту</span><h2>Добавьте рабочий контекст</h2><p>Должность и уровень разделены. Уровень определяет ожидания и рекомендации Эскады.</p><label>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label>Текущая должность<input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} required /></label><label>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Рынок или команда<input value={profile.market} onChange={(event) => setProfile({ ...profile, market: event.target.value })} /></label><button className={styles.primaryButton} type="submit">Начать работу</button><button className={styles.textButton} type="button" onClick={onDemo}>Посмотреть с демо-данными</button></form></section></div>
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className={styles.emptyState}><span>＋</span><h3>{title}</h3><p>{text}</p><button type="button" onClick={onAction}>{action}</button></div>
}
