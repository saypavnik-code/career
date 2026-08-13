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
  captureToWinDraft,
  computeGrowthPath,
  computeReportingCycle,
  createDefaultState,
  createId,
  createNote,
  deleteWin as deleteWinFromState,
  isIdeaReadyForWin,
  updateNote as updateNoteFromState,
  demoState,
  inferLevelSignal,
  migrateState,
  noteToIdea,
  promoteIdeaToWin,
  selectWinsForPeriod,
  suggestBehaviorRefs,
  suggestCompetencyIds,
  todayIso,
  winGapHints,
} from './career-core.mjs'

const ESCADA_AI_ENDPOINT = process.env.NEXT_PUBLIC_ESCADA_AI_ENDPOINT?.trim() ?? ''

type View = 'today' | 'ideas' | 'wins' | 'reports' | 'growth'
type IdeaStatus = 'concept' | 'preparation' | 'in_progress' | 'outcomes' | 'won' | 'archived'
type ActiveIdeaStatus = 'concept' | 'preparation' | 'in_progress' | 'outcomes'
type WorkStatus = 'backlog' | 'doing' | 'done'
type ReportType = 'weekly' | 'monthly' | 'one-to-one' | 'performance' | 'promotion'
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

interface Note {
  id: string
  title: string
  body: string
  rawText: string
  createdAt: string
  updatedAt: string
  convertedIdeaId: string | null
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
  sourceContext: string
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
  notes: Note[]
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
  concept: 'Задумка',
  preparation: 'Подготовка',
  in_progress: 'В работе',
  outcomes: 'Итоги',
  won: 'Стала win',
  archived: 'Архив',
}

const KANBAN_COLUMNS: ActiveIdeaStatus[] = ['concept', 'preparation', 'in_progress', 'outcomes']

const workStatusLabels: Record<WorkStatus, string> = {
  backlog: 'План',
  doing: 'В работе',
  done: 'Готово',
}

const reportTypeLabels: Record<ReportType, string> = {
  weekly: 'Недельный отчёт',
  monthly: 'Ежемесячный отчёт',
  'one-to-one': 'Отчёт для 1:1',
  performance: 'Performance review',
  promotion: 'Promotion case',
}

const visibleReportTypes: ReportType[] = ['weekly', 'monthly', 'performance', 'promotion']

const reportingRhythmLabels: Record<Profile['reportingRhythm'], string> = {
  monthly: 'Ежемесячно',
  quarterly: 'Ежеквартально',
  'half-year': 'Раз в полгода',
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
  const inferred = inferLevelSignal(title, currentLevel) as { level: LevelKey; reason: string }
  const now = new Date().toISOString()
  return {
    id: createId('idea'), title, details: '', nextStep: '', status: 'concept', competencyIds: [],
    levelSignal: inferred.level, levelReason: inferred.reason, behaviorRefs: [], workItems: [], notes: [], evidenceNotes: [],
    createdAt: now, updatedAt: now,
  } as Idea
}

function emptyWin(): WinDraft {
  return {
    sourceIdeaId: null,
    sourceContext: '',
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
  const [openNote, setOpenNote] = useState<Note | null>(null)
  const [ideaDraft, setIdeaDraft] = useState<Idea | null>(null)
  const [newIdeaFromNote, setNewIdeaFromNote] = useState<Idea | null>(null)
  const [winDraft, setWinDraft] = useState<WinDraft | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notice, setNotice] = useState('')
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
    const loaded = asState(migrateState(current ?? previous, createDefaultState()))
    const cycle = computeReportingCycle(loaded.profile, new Date()) as { periodStart: string; periodEnd: string }
    setState(loaded)
    setPeriodStart(cycle.periodStart)
    setPeriodEnd(cycle.periodEnd)
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

  const activeIdeas = useMemo(() => state.ideas.filter((item) => item.status !== 'won' && item.status !== 'archived'), [state.ideas])
  const winsInPeriod = useMemo(() => selectWinsForPeriod(state.wins, periodStart, periodEnd) as Win[], [state.wins, periodStart, periodEnd])
  const reportingCycle = useMemo(() => computeReportingCycle(state.profile, new Date()) as { rhythm: Profile['reportingRhythm']; periodStart: string; periodEnd: string; daysRemaining: number }, [state.profile])
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
    const aiProfile = { name: state.profile.name, market: state.profile.market, currentLevel: state.profile.currentLevel }
    const payload = { profile: aiProfile as unknown as Record<string, unknown>, artifact, competencyIds }
    try {
      if (!ESCADA_AI_ENDPOINT) return buildLocalGuidance(action, payload) as unknown as AiResponse
      const response = await fetch(ESCADA_AI_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, profile: aiProfile, artifact, competencyIds }),
      })
      const data = await response.json() as AiResponse & { message?: string }
      if (!response.ok) throw new Error(data.message || 'Внешняя подсказка вернула ошибку')
      return data
    } catch (caughtError) {
      // Escada must remain useful without a network or AI provider: always fall
      // back to local guidance. But a configured endpoint that genuinely failed
      // (bad response, thrown error) should be visible, not silently hidden —
      // otherwise the person can't tell 'no endpoint set' from 'endpoint is broken'.
      if (ESCADA_AI_ENDPOINT) {
        const message = caughtError instanceof Error ? caughtError.message : 'Внешняя подсказка недоступна'
        setAiError(`${message}. Показана локальная подсказка по шкале компетенций.`)
      }
      return buildLocalGuidance(action, payload) as unknown as AiResponse
    } finally {
      setAiBusy('')
    }
  }

  function submitNote(event: FormEvent) {
    event.preventDefault()
    const note = createNote(quickText) as unknown as Note | null
    if (!note) return
    updateState((current) => ({ ...current, notes: [note, ...current.notes] }))
    setQuickText('')
    setNotice('Мысль сохранена')
  }

  function editNote(noteId: string, rawText: string) {
    updateState((current) => asState(updateNoteFromState(current as unknown as Record<string, unknown>, noteId, rawText)))
    setNotice('Мысль обновлена')
  }

  function convertNoteToIdea(note: Note) {
    if (note.convertedIdeaId) {
      const existingIdea = state.ideas.find((idea) => idea.id === note.convertedIdeaId)
      if (existingIdea) {
        setOpenNote(null)
        setIdeaDraft(existingIdea)
        return
      }
    }
    const result = noteToIdea(note as unknown as Record<string, unknown>, state.profile.currentLevel) as unknown as { idea: Idea; note: Note }
    updateState((current) => ({
      ...current,
      notes: current.notes.map((item) => item.id === note.id ? result.note : item),
      ideas: [result.idea, ...current.ideas],
    }))
    setOpenNote(null)
    setNewIdeaFromNote(result.idea)
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

  function changeIdeaStatus(ideaId: string, status: ActiveIdeaStatus) {
    updateState((current) => ({
      ...current,
      ideas: current.ideas.map((item) => item.id === ideaId ? { ...item, status, updatedAt: new Date().toISOString() } : item),
    }))
  }

  function archiveIdea(ideaId: string) {
    updateState((current) => ({
      ...current,
      ideas: current.ideas.map((item) => item.id === ideaId ? { ...item, status: 'archived', updatedAt: new Date().toISOString() } : item),
    }))
    setIdeaDraft((current) => current?.id === ideaId ? null : current)
    setNotice('Идея перемещена в архив')
  }

  function restoreIdea(ideaId: string) {
    updateState((current) => ({
      ...current,
      ideas: current.ideas.map((item) => item.id === ideaId ? { ...item, status: 'concept', updatedAt: new Date().toISOString() } : item),
    }))
    setIdeaDraft((current) => current?.id === ideaId ? null : current)
    setNotice('Идея возвращена в «Задумки»')
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

  function removeWin(winId: string) {
    updateState((current) => asState(deleteWinFromState(current as unknown as Record<string, unknown>, winId)))
    setWinDraft(null)
    setNotice('Win удалена')
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

  function openSavedReport(report: Report) {
    setReportType(report.type)
    setPeriodStart(report.periodStart)
    setPeriodEnd(report.periodEnd)
    setSelectedWinIds(report.winIds ?? [])
    setSelectedIdeaIds(report.ideaIds ?? [])
    setReportText(report.content ?? '')
    setReportGuidance(null)
    setNotice('Сохранённая версия открыта')
  }

  function useProfileReportingPeriod() {
    setPeriodStart(reportingCycle.periodStart)
    setPeriodEnd(reportingCycle.periodEnd)
    setSelectedWinIds([])
    setSelectedIdeaIds([])
    setReportText('')
    setReportGuidance(null)
    setNotice('Период установлен по отчётному циклу профиля')
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
          <button type="button" className={styles.profileChip} onClick={() => setProfileOpen(true)}><span>{state.profile.name.slice(0, 1) || 'Э'}</span><div><strong>{state.profile.name || 'Мой профиль'}</strong><small>{levelLabels[state.profile.currentLevel]}</small></div></button>
        </header>

        {view === 'today' && <TodayView quickText={quickText} onQuickText={setQuickText} onSubmit={submitNote} notes={state.notes} onOpenNote={setOpenNote} />}
        {view === 'ideas' && <IdeasView ideas={state.ideas} wins={state.wins} onNew={() => setIdeaDraft(newIdea(state.profile.currentLevel))} onOpen={(idea) => setIdeaDraft(idea)} onStatusChange={changeIdeaStatus} onArchive={archiveIdea} onRestore={restoreIdea} onQuickWin={(idea) => { if (window.confirm('Превратить идею в win?')) startWinFromIdea(idea) }} />}
        {view === 'wins' && <WinsView wins={state.wins} ideas={state.ideas} onNew={() => setWinDraft(emptyWin())} onOpen={(win) => setWinDraft({ ...win })} onDelete={removeWin} onReports={() => setView('reports')} />}
        {view === 'reports' && <ReportsView profile={state.profile} cycle={reportingCycle} wins={winsInPeriod} ideas={activeIdeas} selectedWinIds={selectedWinIds} selectedIdeaIds={selectedIdeaIds} periodStart={periodStart} periodEnd={periodEnd} reportType={reportType} reportText={reportText} reports={state.reports} guidance={reportGuidance} busy={aiBusy} error={aiError} onPeriodStart={setPeriodStart} onPeriodEnd={setPeriodEnd} onReportType={setReportType} onToggleWin={(id) => setSelectedWinIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onToggleIdea={(id) => setSelectedIdeaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onSelectAll={() => setSelectedWinIds(winsInPeriod.map((item) => item.id))} onGenerate={generateReport} onReview={reviewReport} onReportText={setReportText} onSave={saveReport} onOpenReport={openSavedReport} onUseProfilePeriod={useProfileReportingPeriod} onOpenProfile={() => setProfileOpen(true)} />}
        {view === 'growth' && <GrowthView profile={state.profile} path={growthPath} tab={growthTab} onTab={setGrowthTab} guidance={growthGuidance} busy={aiBusy} error={aiError} onAi={async () => setGrowthGuidance(await requestAi('growth_guidance', { ideas: activeIdeas, wins: state.wins, growthPath }))} onCreateIdea={(competency) => { const idea = newIdea(state.profile.currentLevel, `Развить: ${competency.shortTitle}`); idea.competencyIds = [competency.id]; setIdeaDraft(idea) }} />}
      </section>

      <nav className={styles.mobileNav} aria-label="Мобильная навигация">{navItems.map((item) => <button key={item.id} type="button" className={view === item.id ? styles.mobileActive : ''} onClick={() => setView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>

      {!state.onboardingComplete && <Onboarding initial={state.profile} onComplete={(profile) => updateState((current) => ({ ...current, onboardingComplete: true, profile }))} onDemo={() => setState(asState(demoState()))} />}
      {profileOpen && <ProfileModal profile={state.profile} onClose={() => setProfileOpen(false)} onSave={(profile) => { updateState((current) => ({ ...current, profile })); setProfileOpen(false); setNotice('Профиль обновлён') }} onExport={exportData} onImport={() => importRef.current?.click()} />}
      {ideaDraft && <IdeaWorkspace draft={ideaDraft} profile={state.profile} busy={aiBusy} error={aiError} canArchive={state.ideas.some((item) => item.id === ideaDraft.id)} onClose={() => setIdeaDraft(null)} onSave={saveIdea} onPromote={startWinFromIdea} onArchive={archiveIdea} onRestore={restoreIdea} onAi={(idea) => requestAi('idea_review', idea as unknown as Record<string, unknown>, idea.competencyIds)} />}
      {newIdeaFromNote && <NewIdeaModal idea={newIdeaFromNote} onClose={() => setNewIdeaFromNote(null)} onSave={(idea) => { saveIdea(idea, true); setNewIdeaFromNote(null) }} onPromote={(idea) => { setNewIdeaFromNote(null); startWinFromIdea(idea) }} />}
      {winDraft && <WinModal draft={winDraft} profile={state.profile} busy={aiBusy} error={aiError} onClose={() => setWinDraft(null)} onSave={saveWin} onDelete={removeWin} onAi={(win) => requestAi('win_rewrite', win as unknown as Record<string, unknown>, win.competencyIds)} />}
      {openNote && <NoteOverlay note={openNote} busy={aiBusy} error={aiError} onClose={() => setOpenNote(null)} onConvert={convertNoteToIdea} onEdit={editNote} onAi={(note) => requestAi('idea_review', { title: note.title, details: note.body || note.rawText } as unknown as Record<string, unknown>, [])} />}
      <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json" onChange={importData} />
      {notice && <div className={styles.toast} role="status">{notice}</div>}
    </main>
  )
}

function noteRelativeDate(value: string) {
  const created = new Date(value).getTime()
  const diffDays = Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000))
  if (diffDays <= 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  return formatDate(value.slice(0, 10))
}

function TodayView({ quickText, onQuickText, onSubmit, notes, onOpenNote }: {
  quickText: string
  onQuickText: (value: string) => void
  onSubmit: (event: FormEvent) => void
  notes: Note[]
  onOpenNote: (note: Note) => void
}) {
  return <div className={styles.pageStack}>
    <section className={`${styles.heroCard} ${styles.calmHero}`}>
      <div className={styles.heroCopy}><span className={styles.pill}>Быстрая мысль</span><h2>Есть новая мысль?</h2></div>
      <form className={`${styles.quickCapture} ${styles.quickThought}`} onSubmit={onSubmit}><textarea value={quickText} onChange={(event) => onQuickText(event.target.value)} aria-label="Быстрая мысль" /><button type="submit" className={styles.primaryButton}>Записать</button></form>
    </section>

    {notes.length > 0 && (
      <section className={styles.pinBoard}>
        {notes.map((note) => (
          <article className={styles.noteCard} key={note.id} onClick={() => onOpenNote(note)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenNote(note) } }}>
            <h4>{note.title}</h4>
            <span className={styles.noteCardDate}>{noteRelativeDate(note.createdAt)}</span>
          </article>
        ))}
      </section>
    )}
  </div>
}

function NoteOverlay({ note, busy, error, onClose, onConvert, onEdit, onAi }: {
  note: Note
  busy: string
  error: string
  onClose: () => void
  onConvert: (note: Note) => void
  onEdit: (noteId: string, rawText: string) => void
  onAi: (note: Note) => Promise<AiResponse>
}) {
  const [text, setText] = useState(note.rawText)
  const [guidance, setGuidance] = useState<AiResponse | null>(null)
  const dirty = text.trim() !== note.rawText.trim()
  async function runAi() { setGuidance(await onAi(note)) }
  function save() { if (text.trim()) onEdit(note.id, text) }
  return <Modal title={note.title} subtitle="" onClose={onClose}>
    <div className={styles.noteEditorWrap}>
      <span className={styles.noteEditorDate}>{formatDate(note.createdAt.slice(0, 10))}</span>
      <textarea className={styles.noteEditor} value={text} onChange={(event) => setText(event.target.value)} aria-label="Текст мысли" autoFocus />
      <div className={styles.noteEditorSaveRow}>
        <button className={styles.secondaryButton} type="button" disabled={!dirty || !text.trim()} onClick={save}>Сохранить</button>
      </div>
      {error && <p className={styles.aiError}>{error}</p>}
      {guidance && <div className={styles.guidanceBanner}>
        <strong>{guidance.headline}</strong>
        {guidance.strengths.length > 0 && <p>{guidance.strengths.map((item) => item.text).join(' ')}</p>}
        {guidance.nextStep && <p><strong>Следующий шаг.</strong> {guidance.nextStep}</p>}
      </div>}
      <div className={styles.modalActions}>
        <button className={styles.primaryButton} type="button" onClick={() => onConvert(note)}>{note.convertedIdeaId ? 'Открыть идею' : 'Это идея!'}</button>
        <button className={styles.aiMiniButton} type="button" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Думаем…' : '✦ Улучшить'}</button>
      </div>
    </div>
  </Modal>
}

function IdeasView({ ideas, wins, onNew, onOpen, onStatusChange, onArchive, onRestore, onQuickWin }: {
  ideas: Idea[]
  wins: Win[]
  onNew: () => void
  onOpen: (idea: Idea) => void
  onStatusChange: (ideaId: string, status: ActiveIdeaStatus) => void
  onArchive: (ideaId: string) => void
  onRestore: (ideaId: string) => void
  onQuickWin: (idea: Idea) => void
}) {
  const [dragIdeaId, setDragIdeaId] = useState<string | null>(null)
  const kanbanIdeas = ideas.filter((idea) => idea.status !== 'won' && idea.status !== 'archived')
  const archivedIdeas = ideas.filter((idea) => idea.status === 'archived')

  function handleDrop(event: React.DragEvent, status: ActiveIdeaStatus) {
    event.preventDefault()
    const ideaId = event.dataTransfer.getData('text/escada-idea-id') || dragIdeaId
    if (ideaId) onStatusChange(ideaId, status)
    setDragIdeaId(null)
  }

  return <div className={styles.pageStack}>
    <section className={styles.pageIntro}><div /><button className={styles.primaryButton} type="button" onClick={onNew}>Новая идея</button></section>
    {kanbanIdeas.length ? (
      <section className={styles.kanbanBoard}>
        {KANBAN_COLUMNS.map((status) => {
          const columnIdeas = kanbanIdeas.filter((idea) => idea.status === status)
          return <div key={status} className={styles.kanbanColumnWrap} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}>
            <div className={styles.kanbanColumnHeader}><h3>{statusLabels[status]}</h3><span>{columnIdeas.length}</span></div>
            <div className={styles.kanbanColumnBody}>
              {columnIdeas.map((idea) => (
                <article
                  key={idea.id}
                  className={styles.kanbanCard}
                  draggable
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(idea)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(idea) } }}
                  onDragStart={(event) => { event.dataTransfer.setData('text/escada-idea-id', idea.id); setDragIdeaId(idea.id) }}
                  onDragEnd={() => setDragIdeaId(null)}
                >
                  <h4>{idea.title}</h4>
                  {isIdeaReadyForWin(idea as unknown as Record<string, unknown>, wins as unknown as Record<string, unknown>[]) && (
                    <div className={styles.readyForWinRow}>
                      <span className={styles.readyForWinBadge}>Готова стать win</span>
                      <button type="button" className={styles.textButton} onClick={(event) => { event.stopPropagation(); onQuickWin(idea) }}>Win!</button>
                    </div>
                  )}
                  <div className={styles.cardActions}>
                    <select
                      className={styles.kanbanCardStatusSelect}
                      value={idea.status}
                      onChange={(event) => onStatusChange(idea.id, event.target.value as ActiveIdeaStatus)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Статус идеи"
                    >
                      {KANBAN_COLUMNS.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
                    </select>
                    <button type="button" className={styles.kanbanArchiveButton} onClick={(event) => { event.stopPropagation(); onArchive(idea.id) }} aria-label={`Архивировать идею «${idea.title}»`}>Архив</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        })}
      </section>
    ) : (
      <EmptyState title={archivedIdeas.length ? 'Активных идей пока нет' : 'Идей пока нет'} text="Запишите мысль на экране «Сегодня» или создайте карточку сразу." action="Создать идею" onAction={onNew} />
    )}
    {archivedIdeas.length > 0 && <details className={styles.archiveSection}>
      <summary><span>Архив</span><strong>{archivedIdeas.length}</strong></summary>
      <div className={styles.archiveGrid}>{archivedIdeas.map((idea) => <article className={styles.archiveCard} key={idea.id}>
        <button type="button" className={styles.archiveOpenButton} onClick={() => onOpen(idea)}><strong>{idea.title}</strong><span>{idea.details || 'Без описания'}</span></button>
        <button type="button" className={styles.secondaryButton} onClick={() => onRestore(idea.id)}>Вернуть в задумки</button>
      </article>)}</div>
    </details>}
  </div>
}

function WinsView({ wins, ideas, onNew, onOpen, onDelete, onReports }: { wins: Win[]; ideas: Idea[]; onNew: () => void; onOpen: (win: Win) => void; onDelete: (winId: string) => void; onReports: () => void }) {
  return <div className={styles.pageStack}>
    <section className={styles.pageIntro}>
      <div><span className={styles.eyebrow}>Доказательства роста</span><p>Что произошло, почему это важно и чем подтверждается.</p></div>
      <div className={styles.buttonRow}><button className={styles.secondaryButton} type="button" onClick={onReports}>Собрать отчёт</button><button className={styles.primaryButton} type="button" onClick={onNew}>Добавить win</button></div>
    </section>
    <section className={styles.winList}>
      {wins.length ? wins.map((win) => {
        const gaps = winGapHints(win as unknown as Record<string, unknown>)
        const sourceIdea = win.sourceIdeaId ? ideas.find((idea) => idea.id === win.sourceIdeaId) : null
        return <article className={`${styles.winCard} ${styles.minimalWinCard}`} key={win.id}>
          <div className={styles.winDate}>{formatDate(win.date)}</div>
          <div className={styles.winBody}>
            <h3>{win.title}</h3>
            {sourceIdea && <span className={styles.sourceIdeaPill}>Из идеи · {sourceIdea.title}</span>}
            <p>{win.impact || 'Значимость результата пока не описана'}</p>
            <div className={styles.evidenceStats}><span className={gaps.length ? styles.warningDot : styles.successDot}>{gaps.length ? `${gaps.length} пункта стоит усилить` : 'Доказательство заполнено'}</span></div>
          </div>
          <div className={styles.cardActions}><button type="button" className={styles.secondaryButton} onClick={() => onOpen(win)}>Открыть</button><button type="button" className={`${styles.textButton} ${styles.dangerText}`} onClick={() => { if (window.confirm(`Удалить win «${win.title}»? Это действие необратимо.`)) onDelete(win.id) }}>Удалить</button></div>
        </article>
      }) : <EmptyState title="Wins пока нет" text="Зафиксируйте изменение, результат и доказательство." action="Добавить win" onAction={onNew} />}
    </section>
  </div>
}

function ReportsView({ profile, cycle, wins, ideas, selectedWinIds, selectedIdeaIds, periodStart, periodEnd, reportType, reportText, reports, guidance, busy, error, onPeriodStart, onPeriodEnd, onReportType, onToggleWin, onToggleIdea, onSelectAll, onGenerate, onReview, onReportText, onSave, onOpenReport, onUseProfilePeriod, onOpenProfile }: {
  profile: Profile
  cycle: { rhythm: Profile['reportingRhythm']; periodStart: string; periodEnd: string; daysRemaining: number }
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
  onOpenReport: (report: Report) => void
  onUseProfilePeriod: () => void
  onOpenProfile: () => void
}) {
  const cycleStatus = cycle.daysRemaining < 0
    ? `Цикл завершился ${Math.abs(cycle.daysRemaining)} дн. назад — обновите дату в профиле.`
    : cycle.daysRemaining === 0
      ? 'Текущий цикл заканчивается сегодня.'
      : `До конца текущего цикла ${cycle.daysRemaining} дн.`
  return <div className={styles.pageStack}>
    <section className={styles.pageIntro}>
      <div><span className={styles.eyebrow}>Вы контролируете содержание</span><h2>Соберите отчёт</h2><p>Выберите период, тип документа и только те достижения, которые должны войти в черновик.</p></div>
    </section>

    <section className={styles.reportingCycleCard}>
      <div><span className={styles.eyebrow}>Отчётный цикл</span><strong>{reportingRhythmLabels[cycle.rhythm]} · до {formatDate(cycle.periodEnd)}</strong><p>{cycleStatus}</p></div>
      <div className={styles.reportingCycleActions}><button className={styles.secondaryButton} type="button" onClick={onOpenProfile}>Настроить</button><button className={styles.primaryButton} type="button" onClick={onUseProfilePeriod}>Взять период цикла</button></div>
    </section>

    <section className={styles.reportTypeGrid}>{visibleReportTypes.map((value) => <button type="button" key={value} className={reportType === value ? styles.reportTypeActive : styles.reportTypeCard} onClick={() => onReportType(value)}><strong>{reportTypeLabels[value]}</strong></button>)}</section>

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
    {reports.length > 0 && <section className={styles.savedReports}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>История</span><h3>Сохранённые версии</h3></div></div>{reports.slice(0, 5).map((report) => <button type="button" className={styles.savedReportCard} key={report.id} onClick={() => onOpenReport(report)}><strong>{report.title}</strong><span>{formatDate(report.createdAt.slice(0, 10))}</span><small>Открыть версию</small></button>)}</section>}
  </div>
}

function GrowthView({ profile, path, tab, onTab, guidance, busy, error, onAi, onCreateIdea }: { profile: Profile; path: ReturnType<typeof computeGrowthPath> & { currentLevel: LevelKey; nextLevel: LevelKey | null; strongSignals: Array<{ id: string; title: string; count: number }>; underdocumented: Array<{ id: string; title: string }>; directions: Array<{ competencyId: string; title: string; criterion: string }> }; tab: GrowthTab; onTab: (tab: GrowthTab) => void; guidance: AiResponse | null; busy: string; error: string; onAi: () => Promise<void>; onCreateIdea: (competency: Competency) => void }) {
  return <div className={styles.pageStack}><section className={styles.pageIntro}><div><span className={styles.eyebrow}>Ожидания, а не оценка</span><p>Шкала помогает понимать текущие ожидания и следующий шаг. Она не превращается в обязательный чеклист.</p></div></section><div className={styles.segmentedControl}><button type="button" className={tab === 'path' ? styles.segmentActive : ''} onClick={() => onTab('path')}>Мой путь</button><button type="button" className={tab === 'scale' ? styles.segmentActive : ''} onClick={() => onTab('scale')}>Шкала</button></div>{tab === 'path' ? <><section className={styles.progressHero}><div><span className={styles.eyebrow}>Ваш контекст</span><h2>{levelLabels[profile.currentLevel]}</h2><p>{profile.market || 'Рынок или команда не указаны'}</p></div><div className={styles.levelRoute}><div><small>Текущий уровень</small><strong>{levelLabels[profile.currentLevel]}</strong></div><span>→</span><div><small>{path.nextLevel ? 'Следующий уровень' : 'Следующий масштаб'}</small><strong>{path.nextLevel ? levelLabels[path.nextLevel] : 'Больше системного влияния'}</strong></div></div></section><div className={styles.progressGrid}><section className={styles.progressCard}><span className={styles.eyebrow}>Сильные сигналы</span><h3>Уже подтверждаются работой</h3>{path.strongSignals.length ? path.strongSignals.map((item) => <div className={styles.progressSignal} key={item.id}><strong>{item.title}</strong><span>{item.count} сигналов</span></div>) : <p className={styles.muted}>Добавьте идеи и wins — Эскада покажет устойчивые сигналы.</p>}</section><section className={styles.progressCard}><span className={styles.eyebrow}>Недостаточно подтверждено</span><h3>Не пробел, а зона наблюдения</h3>{path.underdocumented.map((item) => <div className={styles.progressSignal} key={item.id}><strong>{item.title}</strong><span>мало записей</span></div>)}</section></div><section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Следующий фокус</span><h3>1–3 направления</h3></div><button className={styles.aiMiniButton} type="button" disabled={busy === 'growth_guidance'} onClick={() => void onAi()}>{busy === 'growth_guidance' ? 'Эскада думает…' : '✦ Что развивать дальше?'}</button></div><div className={styles.directionGrid}>{path.directions.map((item) => <article key={item.competencyId}><strong>{item.title}</strong><p>{item.criterion}</p><button type="button" className={styles.textButton} onClick={() => { const competency = competencyById(item.competencyId); if (competency) onCreateIdea(competency) }}>Создать идею</button></article>)}</div>{error && <p className={styles.aiError}>{error}</p>}</section>{guidance && <AiGuidancePanel guidance={guidance} />}</> : <ScaleReference profile={profile} onCreateIdea={onCreateIdea} />}</div>
}

function ScaleReference({ profile, onCreateIdea }: { profile: Profile; onCreateIdea: (competency: Competency) => void }) {
  const target = nextLevel(profile.currentLevel)
  return <section className={styles.competencyGrid}>{competencies.map((competency, index) => <article className={styles.competencyCard} key={competency.id}><div className={styles.competencyNumber}>{String(index + 1).padStart(2, '0')}</div><div><span className={styles.domainBadge}>{competency.shortTitle}</span><h3>{competency.title}</h3><p>{competency.summary}</p><div className={styles.expectationColumns}><section><small>Ожидания сейчас · {levelLabels[profile.currentLevel]}</small><ul>{competency.levels[profile.currentLevel].map((criterion) => <li key={criterion.id}>{criterion.text}</li>)}</ul></section><section><small>{target ? `Следующий уровень · ${levelLabels[target]}` : 'Усиление влияния'}</small><ul>{competency.levels[target ?? profile.currentLevel].map((criterion) => <li key={criterion.id}>{criterion.text}</li>)}</ul></section></div><button className={styles.textButton} type="button" onClick={() => onCreateIdea(competency)}>Создать growth idea</button></div></article>)}</section>
}

function NewIdeaModal({ idea, onClose, onSave, onPromote }: {
  idea: Idea
  onClose: () => void
  onSave: (idea: Idea) => void
  onPromote: (idea: Idea) => void
}) {
  const [draft, setDraft] = useState(idea)
  return <Modal title="Новая идея" subtitle="Название и смысл — остальное можно добавить позже, открыв идею из «Идеи»." onClose={onClose}>
    <form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) onSave(draft) }}>
      <label className={styles.field}>Название идеи<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
      <label className={styles.field}>Смысл<textarea value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="В чём идея и почему она может быть полезна?" /></label>
      <div className={styles.modalActions}>
        <button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button>
        <button className={styles.primaryButton} type="submit">Сохранить идею</button>
      </div>
      <div className={styles.newIdeaWinRow}>
        <button type="button" className={styles.primaryButton} disabled={!draft.title.trim()} onClick={() => { if (window.confirm('Превратить идею в win?')) onPromote(draft) }}>Win!</button>
      </div>
    </form>
  </Modal>
}

function IdeaWorkspace({ draft: initial, profile, busy, error, canArchive, onClose, onSave, onPromote, onArchive, onRestore, onAi }: { draft: Idea; profile: Profile; busy: string; error: string; canArchive: boolean; onClose: () => void; onSave: (idea: Idea, close?: boolean) => Idea; onPromote: (idea: Idea) => void; onArchive: (ideaId: string) => void; onRestore: (ideaId: string) => void; onAi: (idea: Idea) => Promise<AiResponse> }) {
  const [draft, setDraft] = useState(initial)
  const [noteText, setNoteText] = useState('')
  const [evidenceText, setEvidenceText] = useState('')
  const [guidance, setGuidance] = useState<AiResponse | null>(null)
  useDialogBehavior(onClose)
  const isTerminal = draft.status === 'won' || draft.status === 'archived'
  const text = [draft.title, draft.details, draft.nextStep, ...draft.workItems.map((item) => item.title), ...draft.notes.map((item) => item.text)].join(' ')
  const suggestedCompetencies = suggestCompetencyIds(text, competencies, competencyKeywords)
  const inferred = inferLevelSignal(text, profile.currentLevel) as { level: LevelKey; reason: string }
  const selectedCompetencies = draft.competencyIds.length ? draft.competencyIds : suggestedCompetencies
  const currentExpectations = selectedCompetencies.flatMap((id) => competencyById(id)?.levels[profile.currentLevel].slice(0, 2) ?? []).slice(0, 3)
  const target = nextLevel(profile.currentLevel)
  const nextExpectations = target ? selectedCompetencies.flatMap((id) => competencyById(id)?.levels[target].slice(0, 2) ?? []).slice(0, 3) : []

  async function runAi() { setGuidance(await onAi(draft)) }

  function addNote() { const value = noteText.trim(); if (!value) return; setDraft((current) => ({ ...current, notes: [...current.notes, { id: createId('note'), text: value, createdAt: new Date().toISOString() }] })); setNoteText('') }
  function addEvidence() { const value = evidenceText.trim(); if (!value) return; setDraft((current) => ({ ...current, evidenceNotes: [...current.evidenceNotes, { id: createId('evidence'), text: value, createdAt: new Date().toISOString() }] })); setEvidenceText('') }
  function toggleCompetency(id: string) { setDraft((current) => ({ ...current, competencyIds: current.competencyIds.includes(id) ? current.competencyIds.filter((item) => item !== id) : [...current.competencyIds, id] })) }

  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className={`${styles.compactCard} ${styles.ideaDialogCard}`} role="dialog" aria-modal="true" aria-label="Карточка идеи">
    <header className={styles.workspaceHeader}>
      <div className={styles.ideaActionRow}>
        <select value={draft.status} disabled={isTerminal} onChange={(event) => setDraft({ ...draft, status: event.target.value as ActiveIdeaStatus })} aria-label="Статус идеи">
          {isTerminal && <option value={draft.status}>{statusLabels[draft.status]}</option>}
          {!isTerminal && KANBAN_COLUMNS.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
        </select>
        <button type="button" className={styles.primaryButton} disabled={!draft.title.trim() || isTerminal} onClick={() => { if (window.confirm('Превратить идею в win?')) onPromote(draft) }}>Win!</button>
      </div>
      <button type="button" className={styles.workspaceCloseButton} aria-label="Закрыть" onClick={onClose}>×</button>
    </header>
    <div className={styles.compactCardBody}>
      <section className={styles.workspaceSectionSpacious}>
        <input className={styles.ideaTitleInput} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Название идеи" autoFocus />
        <textarea className={styles.largeTextarea} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="В чём идея и почему она может быть полезна?" />
      </section>

      <section className={styles.signalCard}><span className={styles.eyebrow}>Карьерная подсказка</span><h3>{levelLabels[inferred.level]}</h3><p>{inferred.reason}</p><details><summary>Ожидания текущего уровня</summary><ul>{currentExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>{target && <details><summary>Как выйти на {levelLabels[target]}</summary><ul>{nextExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}</section>

      <section className={styles.workspaceSectionSpacious}>
        <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Компетенции</span><h3>Контекст идеи</h3></div></div>
        <div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={draft.competencyIds.includes(competency.id) ? styles.choiceActive : ''} onClick={() => toggleCompetency(competency.id)}>{competency.shortTitle}</button>)}</div>
      </section>

      <section className={styles.aiPanel}><span className={styles.eyebrow}>Только по запросу</span><h3>Разобрать с Эскадой</h3><p>Эскада сопоставит карточку с релевантными пунктами шкалы и подскажет следующий шаг. Внешние карьерные фреймворки не используются.</p><button className={styles.primaryButton} type="button" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Разбираем…' : 'Разобрать с Эскадой'}</button>{error && <p className={styles.aiError}>{error}</p>}</section>
      {guidance && <AiGuidancePanel guidance={guidance} compact />}

      <details className={styles.secondarySection}>
        <summary>Рабочие заметки</summary>
        <div className={styles.addInline}><input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Решение, наблюдение, обратная связь…" /><button type="button" onClick={addNote}>Добавить</button></div>
        <div className={styles.notesTimeline}>{draft.notes.map((note) => <article key={note.id}><span>{formatDate(note.createdAt.slice(0, 10))}</span><p>{note.text}</p></article>)}</div>
      </details>

      <details className={styles.secondarySection}>
        <summary>Доказательства</summary>
        <div className={styles.addInline}><input value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} placeholder="Ссылка, артефакт, отзыв, метрика, решение…" /><button type="button" onClick={addEvidence}>Добавить</button></div>
        <div className={styles.evidenceList}>{draft.evidenceNotes.map((item) => <article key={item.id}><span>◆</span><p>{item.text}</p></article>)}</div>
      </details>
    </div>
    <footer className={styles.workspaceFooter}>
      <div>{draft.status === 'archived'
        ? <button className={styles.secondaryButton} type="button" onClick={() => { const saved = onSave(draft, false); onRestore(saved.id) }}>Вернуть в задумки</button>
        : draft.status === 'won'
          ? <span className={styles.terminalIdeaHint}>Идея уже оформлена как win</span>
          : canArchive && <button className={styles.archiveAction} type="button" onClick={() => { const saved = onSave(draft, false); onArchive(saved.id) }}>В архив</button>}
      </div>
      <div><button className={styles.secondaryButton} type="button" onClick={onClose}>Закрыть</button><button className={styles.primaryButton} type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Сохранить идею</button></div>
    </footer>
  </section></div>
}

function WinModal({ draft: initial, profile, busy, error, onClose, onSave, onDelete, onAi }: { draft: WinDraft; profile: Profile; busy: string; error: string; onClose: () => void; onSave: (draft: WinDraft) => void; onDelete: (winId: string) => void; onAi: (draft: WinDraft) => Promise<AiResponse> }) {
  const [draft, setDraft] = useState(initial)
  const [guidance, setGuidance] = useState<AiResponse | null>(null)
  const gaps = winGapHints(draft as unknown as Record<string, unknown>)
  const winText = [draft.title, draft.impact, draft.evidence].join(' ')
  const winSuggestedCompetencies = suggestCompetencyIds(winText, competencies, competencyKeywords)
  const winSelectedCompetencies = draft.competencyIds.length ? draft.competencyIds : winSuggestedCompetencies
  const winTargetLevel = nextLevel(profile.currentLevel)
  const winCurrentExpectations = winSelectedCompetencies.flatMap((id) => competencyById(id)?.levels[profile.currentLevel].slice(0, 2) ?? []).slice(0, 3)
  const winNextExpectations = winTargetLevel ? winSelectedCompetencies.flatMap((id) => competencyById(id)?.levels[winTargetLevel].slice(0, 2) ?? []).slice(0, 3) : []
  async function runAi() { setGuidance(await onAi(draft)) }
  return <Modal title={draft.id ? 'Открыть win' : 'Зафиксировать win'} subtitle="Просто, но доказуемо. Эскада не будет придумывать недостающие факты." onClose={onClose} wide><form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) onSave(draft) }}><label className={styles.field}>Что произошло?<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>{draft.sourceContext && <div className={styles.sourceContextRef}><span>Исходный контекст идеи</span><p>{draft.sourceContext}</p></div>}<label className={styles.field}>Почему это важно?<textarea value={draft.impact} onChange={(event) => setDraft({ ...draft, impact: event.target.value })} /></label><label className={styles.field}>Чем это подтверждается?<textarea value={draft.evidence} onChange={(event) => setDraft({ ...draft, evidence: event.target.value })} /></label><details className={styles.optionalBlock}><summary>Дополнительные детали — необязательно</summary><label className={styles.field}>Что изменилось в цифрах?<input value={draft.metrics} onChange={(event) => setDraft({ ...draft, metrics: event.target.value })} placeholder="Только реальные значения" /></label><label className={styles.field}>Кто подтвердил результат?<input value={draft.confirmedBy} onChange={(event) => setDraft({ ...draft, confirmedBy: event.target.value })} placeholder="Руководитель, команда, клиент — если это было" /></label></details><div className={styles.workspaceSectionSpacious}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Компетенции</span><h3>Проверьте или поправьте</h3></div></div><div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={winSelectedCompetencies.includes(competency.id) ? styles.choiceActive : ''} onClick={() => setDraft({ ...draft, competencyIds: draft.competencyIds.includes(competency.id) ? draft.competencyIds.filter((item) => item !== competency.id) : [...winSelectedCompetencies, competency.id] })}>{competency.shortTitle}</button>)}</div></div>{gaps.length > 0 && <div className={styles.guidanceBanner}><strong>Чего не хватает для сильной формулировки</strong><ul>{gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>}{draft.title.trim() && (winCurrentExpectations.length > 0 || winNextExpectations.length > 0) && <section className={styles.signalCard}><span className={styles.eyebrow}>Шкала компетенций</span><h3>Куда это может вести</h3><p>Локальная подсказка без обращения к ИИ — только по вашему тексту и шкале.</p>{winCurrentExpectations.length > 0 && <details><summary>Ожидания текущего уровня</summary><ul>{winCurrentExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}{winTargetLevel && winNextExpectations.length > 0 && <details><summary>Как усилить до уровня «{levelLabels[winTargetLevel]}»</summary><ul>{winNextExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}</section>}<button className={styles.aiMiniButton} type="button" disabled={busy === 'win_rewrite'} onClick={() => void runAi()}>{busy === 'win_rewrite' ? 'Усиливаем…' : '✦ Усилить формулировку'}</button>{error && <p className={styles.aiError}>{error}</p>}{guidance && <AiGuidancePanel guidance={guidance} compact onApplyRewrite={guidance.rewrite ? () => setDraft({ ...draft, ...(guidance.rewrite ?? {}) }) : undefined} />}<div className={styles.formGrid}><label>Дата<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label className={styles.checkboxField}><input type="checkbox" checked={draft.reportReady} onChange={(event) => setDraft({ ...draft, reportReady: event.target.checked })} /><span>Предлагать для отчётов</span></label></div><div className={styles.modalActions}>{draft.id && <button className={styles.dangerButton} type="button" onClick={() => { if (window.confirm(`Удалить win «${draft.title || 'без названия'}»? Это действие необратимо.`)) onDelete(draft.id as string) }}>Удалить win</button>}<button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button><button className={styles.primaryButton} type="submit">Сохранить win</button></div></form></Modal>
}

function AiGuidancePanel({ guidance, compact = false, onSaveNextStep, onApplyRewrite }: { guidance: AiResponse; compact?: boolean; onSaveNextStep?: () => void; onApplyRewrite?: () => void }) {
  return <section className={`${styles.aiResult} ${compact ? styles.aiResultCompact : ''}`}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Подсказка Эскады</span><h3>{guidance.headline}</h3></div></div><div className={styles.aiResultGrid}><div><strong>Что уже хорошо</strong>{guidance.strengths.length ? guidance.strengths.map((item) => <p key={`${item.criterionId}-${item.text}`}>{item.text}</p>) : <p>Недостаточно оснований для уверенного вывода.</p>}</div><div><strong>Как превысить ожидания</strong>{guidance.stretch.length ? guidance.stretch.map((item) => <p key={`${item.criterionId}-${item.text}`}>{item.text}</p>) : <p>Шкала не даёт дополнительного вывода по этой записи.</p>}</div><div><strong>Что сохранить как доказательство</strong>{guidance.evidence.map((item) => <p key={item}>{item}</p>)}</div><div><strong>Следующий шаг</strong><p>{guidance.nextStep || 'Следующий шаг не предложен: в записи недостаточно контекста.'}</p>{onSaveNextStep && guidance.nextStep && <button type="button" onClick={onSaveNextStep}>Сохранить как следующий шаг</button>}{onApplyRewrite && <button type="button" onClick={onApplyRewrite}>Применить формулировку</button>}</div></div><details className={styles.aiSources}><summary>Почему Эскада так решила?</summary>{guidance.sources.slice(0, 8).map((source) => <article key={source.id}><strong>{source.competencyTitle} · {levelLabels[source.level]}</strong><p>{source.text}</p><small>Шкала компетенций, стр. {source.sourcePage}</small></article>)}</details><small className={styles.aiCaveat}>{guidance.caveat}</small></section>
}

function ProfileModal({ profile: initial, onClose, onSave, onExport, onImport }: { profile: Profile; onClose: () => void; onSave: (profile: Profile) => void; onExport: () => void; onImport: () => void }) {
  const [profile, setProfile] = useState(initial)
  return <Modal title="Профиль" subtitle="Уровень определяет ожидания шкалы; рынок и отчётный цикл помогают сохранять рабочий контекст." onClose={onClose}><form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); onSave(profile) }}><label className={styles.field}>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label className={styles.field}>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}>Рынок или команда<input value={profile.market} onChange={(event) => setProfile({ ...profile, market: event.target.value })} /></label><section className={styles.profileCycleBox}><div><strong>Отчётный цикл</strong><span>Используется только для периода в «Отчётах». Это не дедлайн и не автоматический review.</span></div><div className={styles.formGrid}><label className={styles.field}>Ритм<select value={profile.reportingRhythm} onChange={(event) => setProfile({ ...profile, reportingRhythm: event.target.value as Profile['reportingRhythm'] })}>{Object.entries(reportingRhythmLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}>Конец текущего цикла<input type="date" value={profile.cycleEnd} onChange={(event) => setProfile({ ...profile, cycleEnd: event.target.value })} /></label></div></section><div className={styles.optionalBlock}><div><strong>Локальные данные</strong><span>Экспортируйте резервную копию или импортируйте её на другом устройстве.</span></div><div className={styles.buttonRow}><button type="button" className={styles.secondaryButton} onClick={onExport}>Экспорт</button><button type="button" className={styles.secondaryButton} onClick={onImport}>Импорт</button></div></div><div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button><button className={styles.primaryButton} type="submit">Сохранить</button></div></form></Modal>
}

function useDialogBehavior(onClose: () => void) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handler)
    }
  }, [onClose])
}

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useDialogBehavior(onClose)
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className={`${styles.compactCard} ${wide ? styles.modalWide : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className={styles.modalHeader}><div><span className={styles.eyebrow}>Эскада</span><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" aria-label="Закрыть" onClick={onClose}>×</button></div><div className={styles.compactCardBody}>{children}</div></section></div>
}

function Onboarding({ initial, onComplete, onDemo }: { initial: Profile; onComplete: (profile: Profile) => void; onDemo: () => void }) {
  const [profile, setProfile] = useState(initial)
  return <div className={styles.onboardingBackdrop}><section className={styles.onboarding}><div className={styles.onboardingVisual}><span className={styles.brandMark}><LadderLogo /></span><p>Эскада</p><h1>Записал.<br />Развил.<br />Подтвердил.</h1><div className={styles.onboardingFlow}><span>Мысль</span><i>→</i><span>Win</span><i>→</i><span>Рост</span></div></div><form onSubmit={(event) => { event.preventDefault(); onComplete(profile) }}><span className={styles.eyebrow}>Настройка за минуту</span><h2>Добавьте рабочий контекст</h2><p>Уровень определяет ожидания и рекомендации Эскады. Рынок помогает сохранить рабочий контекст; отчётный цикл можно настроить позже в профиле.</p><label>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Рынок или команда<input value={profile.market} onChange={(event) => setProfile({ ...profile, market: event.target.value })} /></label><button className={styles.primaryButton} type="submit">Начать работу</button><button className={styles.textButton} type="button" onClick={onDemo}>Посмотреть с демо-данными</button></form></section></div>
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className={styles.emptyState}><span>＋</span><h3>{title}</h3><p>{text}</p><button type="button" onClick={onAction}>{action}</button></div>
}
