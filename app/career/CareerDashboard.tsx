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
import { retrieveCriteria, parseAndValidateAiResponse } from './ai-contract.mjs'
import { deriveActiveScale } from './active-scale.mjs'
import type { ActiveScale } from './active-scale.mjs'
import {
  CUSTOM_SCALE_MIN_CHARS,
  MOCK_PARSER_DISCLAIMER,
  createCustomScaleDraft,
  parseCustomScaleMock,
} from './custom-scale.mjs'
import type { CustomCompetencyScale } from './custom-scale.mjs'
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
  isEscadaState,
  isIdeaReadyForWin,
  updateNote as updateNoteFromState,
  deriveNoteTitle,
  demoState,
  inferLevelSignal,
  migrateState,
  noteToIdea,
  normalizeCustomCompetencyScale,
  promoteIdeaToWin,
  resetCycleForNewScale,
  selectWinsForPeriod,
  suggestBehaviorRefs,
  suggestCompetencyIds,
  todayIso,
  winGapHints,
} from './career-core.mjs'

const ESCADA_AI_ENDPOINT = process.env.NEXT_PUBLIC_ESCADA_AI_ENDPOINT?.trim() ?? ''
const ESCADA_BASE_PATH = process.env.NEXT_PUBLIC_ESCADA_BASE_PATH?.trim() ?? ''
const SIDEBAR_STORAGE_KEY = 'escada:ui:sidebar-collapsed'

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
  // v37: true only once the person has explicitly confirmed the inferred
  // level via the accept-chip in IdeaWorkspace. Absent/false means the value
  // is still an algorithm guess, never a confirmed fact about the record.
  levelSignalConfirmed: boolean
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
  // v37: carried over from the source idea at promotion (see
  // promoteIdeaToWin); false for wins created without a source idea.
  levelSignalConfirmed: boolean
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
  // v38: set on creation and bumped on every in-place update via saveReport,
  // so the reachability list can show "last edited" distinctly from the
  // original creation date.
  updatedAt: string
}

interface CareerState {
  version: number
  onboardingComplete: boolean
  profile: Profile
  notes: Note[]
  ideas: Idea[]
  wins: Win[]
  reports: Report[]
  customCompetencyScale: CustomCompetencyScale | null
  focusCompetencyIds: string[]
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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
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

const BACKUP_KEY_PREFIX = 'escada:backup:'
const CORRUPT_KEY_PREFIX = 'escada:corrupt:'
const MAX_BACKUPS = 3

// v34: called before any full-state replacement (hydration load, import)
// so there is always a way back if the replacement turns out to be wrong.
// Keeps only the most recent MAX_BACKUPS snapshots.
function writeBackup(snapshot: unknown) {
  try {
    const key = `${BACKUP_KEY_PREFIX}${new Date().toISOString()}`
    window.localStorage.setItem(key, JSON.stringify(snapshot))
    const backupKeys = Object.keys(window.localStorage)
      .filter((item) => item.startsWith(BACKUP_KEY_PREFIX))
      .sort()
    const stale = backupKeys.slice(0, Math.max(0, backupKeys.length - MAX_BACKUPS))
    stale.forEach((item) => window.localStorage.removeItem(item))
  } catch {
    // Backup is best-effort — a full disk should not block the primary write.
  }
}

function stateCounts(value: { ideas?: unknown; wins?: unknown; reports?: unknown } | null | undefined) {
  const ideas = Array.isArray(value?.ideas) ? value!.ideas.length : 0
  const wins = Array.isArray(value?.wins) ? value!.wins.length : 0
  const reports = Array.isArray(value?.reports) ? value!.reports.length : 0
  return { ideas, wins, reports }
}

// v42: a partial AI rewrite (e.g. `{title: "x"}` with impact/evidence
// missing) must not blank out whatever the person already had in those
// fields -- parseAndValidateAiResponse normalizes a missing field to ''
// (not undefined), so a plain object spread would silently overwrite
// existing draft content with empty strings. Only fields with real,
// non-empty content are merged in. See Fable roadmap Patch G (P1-1).
function nonEmptyFields<T extends Record<string, unknown>>(source: T | null | undefined): Partial<T> {
  const result: Partial<T> = {}
  if (!source) return result
  for (const key of Object.keys(source) as Array<keyof T>) {
    const value = source[key]
    if (typeof value === 'string' ? value.trim() : value != null) result[key] = value
  }
  return result
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

function newIdea(currentLevel: LevelKey, title = '', defaultCompetencyIds: string[] = []) {
  const inferred = inferLevelSignal(title, currentLevel) as { level: LevelKey; reason: string }
  const now = new Date().toISOString()
  return {
    id: createId('idea'), title, details: '', nextStep: '', status: 'concept', competencyIds: [...defaultCompetencyIds],
    levelSignal: inferred.level, levelReason: inferred.reason, levelSignalConfirmed: false, behaviorRefs: [], workItems: [], notes: [], evidenceNotes: [],
    createdAt: now, updatedAt: now,
  } as Idea
}

function emptyWin(defaultCompetencyIds: string[] = []): WinDraft {
  return {
    sourceIdeaId: null,
    sourceContext: '',
    title: '',
    impact: '',
    evidence: '',
    metrics: '',
    confirmedBy: '',
    date: todayIso(),
    competencyIds: [...defaultCompetencyIds],
    behaviorRefs: [],
    levelSignal: 'specialist',
    levelSignalConfirmed: false,
    workSummary: [],
    noteSummary: [],
    reportReady: true,
  }
}

function LadderLogo({ compact = false }: { compact?: boolean }) {
  return <svg className={compact ? styles.logoSvgCompact : styles.logoSvg} viewBox="0 0 48 48" aria-hidden="true"><path d="M8 36h9V27h9V18h14" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return <svg className={styles.sidebarToggleSvg} viewBox="0 0 20 20" aria-hidden="true">
    <rect x="2.5" y="3" width="15" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 3.8v12.4" fill="none" stroke="currentColor" strokeWidth="1.35" />
    <path d={collapsed ? 'm10 7 3 3-3 3' : 'm13 7-3 3 3 3'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [notice, setNotice] = useState('')
  // v34: distinct from `notice` (which auto-dismisses in ~2.8s) —
  // recovery situations need a banner the user actively closes.
  const [recoveryBanner, setRecoveryBanner] = useState('')
  const [periodStart, setPeriodStart] = useState(dateDaysAgo(90))
  const [periodEnd, setPeriodEnd] = useState(todayIso())
  const [selectedWinIds, setSelectedWinIds] = useState<string[]>([])
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<string[]>([])
  const [reportType, setReportType] = useState<ReportType>('monthly')
  const [reportText, setReportText] = useState('')
  // v38: reportText used to double as both draft content AND modal-visibility
  // flag (`reportText && <ReportDraftModal ...>`), so clearing the textarea
  // to empty silently closed the modal. Tracked separately now.
  const [reportDraftOpen, setReportDraftOpen] = useState(false)
  // v38: null means "this draft has never been saved" -> next save creates a
  // new report. Set when a saved report is opened; cleared when a fresh
  // draft is generated, so re-generating never silently overwrites whatever
  // was previously opened.
  const [currentReportId, setCurrentReportId] = useState<string | null>(null)
  // v41: the last known-good report text -- set whenever reportText becomes
  // a fresh, non-edited value (AI-generated, opened from a saved report, or
  // right after a successful save). Comparing reportText against this is
  // how the editor knows there's unsaved work, for both the close-confirm
  // guard and the "Пересобрать черновик" overwrite-confirm. See Fable
  // roadmap Patch F (P1-6).
  const [reportBaseline, setReportBaseline] = useState('')
  const [reportGuidance, setReportGuidance] = useState<AiResponse | null>(null)
  const [growthGuidance, setGrowthGuidance] = useState<AiResponse | null>(null)
  const [aiBusy, setAiBusy] = useState('')
  const [aiError, setAiError] = useState('')
  const [growthTab, setGrowthTab] = useState<GrowthTab>('path')
  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const rawCurrentValue = window.localStorage.getItem(STORAGE_KEY)
    const current = safeJsonParse(rawCurrentValue)
    // v34: a primary key that exists but doesn't parse into a recognizable
    // Escada shape is corrupt, not merely "older" — falling back to a
    // previous storage key silently would quietly discard everything the
    // person has done since that older key was last written. Preserve the
    // corrupt payload under its own key and surface a recovery banner
    // instead of guessing.
    const isCorrupt = rawCurrentValue !== null && (current === null || (!isEscadaState(current) && !current.tasks && !current.profile))
    if (isCorrupt && rawCurrentValue !== null) {
      try {
        window.localStorage.setItem(`${CORRUPT_KEY_PREFIX}${new Date().toISOString()}`, rawCurrentValue)
      } catch {
        // best-effort preservation of the corrupt payload
      }
    }
    const previous = PREVIOUS_STORAGE_KEYS.map((key) => safeJsonParse(window.localStorage.getItem(key))).find(Boolean) ?? null
    const source = isCorrupt ? previous : (current ?? previous)
    const loaded = asState(migrateState(source, createDefaultState()))
    if (isCorrupt) {
      writeBackup(loaded)
      setRecoveryBanner(
        previous
          ? 'Не удалось прочитать последние данные — загружена предыдущая сохранённая версия. Повреждённые данные сохранены и доступны для экспорта.'
          : 'Не удалось прочитать сохранённые данные — начат чистый профиль. Повреждённые данные сохранены и доступны для экспорта.'
      )
    }
    const cycle = computeReportingCycle(loaded.profile, new Date()) as { periodStart: string; periodEnd: string }
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(navigatorWithStandalone.standalone)
    const savedSidebar = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    const requestedView = new URL(window.location.href).searchParams.get('view') as View | null
    setState(loaded)
    setPeriodStart(cycle.periodStart)
    setPeriodEnd(cycle.periodEnd)
    setIsStandalone(standalone)
    setIsOffline(!window.navigator.onLine)
    setSidebarCollapsed(savedSidebar === null ? standalone : savedSidebar === '1')
    if (requestedView && navItems.some((item) => item.id === requestedView)) setView(requestedView)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // v34: a full localStorage quota (QuotaExceededError) must not fail
      // silently — the person needs to know their last change may not be
      // saved, with a persistent banner rather than a vanishing toast.
      setRecoveryBanner(
        'Не удалось сохранить изменения — локальное хранилище переполнено. Экспортируйте данные и освободите место.'
      )
    }
  }, [hydrated, state])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? '1' : '0')
  }, [hydrated, sidebarCollapsed])

  useEffect(() => {
    if (!hydrated) return
    const url = new URL(window.location.href)
    if (view === 'today') url.searchParams.delete('view')
    else url.searchParams.set('view', view)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [hydrated, view])

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
    const syncStandalone = () => setIsStandalone(displayMode.matches || Boolean(navigatorWithStandalone.standalone))
    const goOnline = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const installed = () => {
      setInstallPrompt(null)
      setIsStandalone(true)
      setNotice('Эскада установлена как приложение')
    }
    displayMode.addEventListener?.('change', syncStandalone)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installed)
    return () => {
      displayMode.removeEventListener?.('change', syncStandalone)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const [swReloadPending, setSwReloadPending] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    let active = true
    let reloaded = false

    const activateWaiting = (worker: ServiceWorker | null) => {
      worker?.postMessage({ type: 'SKIP_WAITING' })
    }

    navigator.serviceWorker.register(`${ESCADA_BASE_PATH}/sw.js`, { scope: `${ESCADA_BASE_PATH}/` })
      .then((registration) => {
        if (!active) return
        if (registration.waiting && navigator.serviceWorker.controller) activateWaiting(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (active && worker.state === 'installed' && navigator.serviceWorker.controller) activateWaiting(worker)
          })
        })
      })
      .catch(() => { /* PWA enhancement is optional; core local-first app must keep working. */ })

    const onControllerChange = () => {
      if (reloaded) return
      reloaded = true
      setSwReloadPending(true)
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => {
      active = false
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  // v41: unified selector -- any surface where the person could lose
  // in-progress input. Deliberately coarser than the per-editor `isDirty`
  // checks used for the Escape/backdrop confirm guards: an editor being
  // OPEN (not necessarily edited yet) is enough to block an automatic
  // reload or warn on tab close, since both of those are silent,
  // unprompted events -- better to be conservative there than to risk
  // wiping something mid-thought. See Fable roadmap Patch F (P1-6).
  const hasUnsavedWork = Boolean(
    ideaDraft || winDraft || reportDraftOpen || openNote || newIdeaFromNote ||
    profileOpen || quickText.trim() || !state.onboardingComplete
  )

  // v41: previously this auto-reloaded the instant no listed editor was
  // open -- but the old check didn't even include openNote/newIdeaFromNote/
  // profileOpen, so a pending update could silently reload the page WHILE
  // one of those was open with unsaved text, wiping it with zero warning.
  // Per Fable roadmap Patch F: replace the automatic reload entirely with a
  // non-blocking, dismissible banner offering a manual "Перезагрузить"
  // button -- the person decides when, never an unprompted reload.
  useEffect(() => {
    if (!hasUnsavedWork) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedWork])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditing = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (!isEditing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b' && window.innerWidth > 780) {
        event.preventDefault()
        setSidebarCollapsed((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const activeIdeas = useMemo(() => state.ideas.filter((item) => item.status !== 'won' && item.status !== 'archived'), [state.ideas])
  const winsInPeriod = useMemo(() => selectWinsForPeriod(state.wins, periodStart, periodEnd) as Win[], [state.wins, periodStart, periodEnd])
  const reportingCycle = useMemo(() => computeReportingCycle(state.profile, new Date()) as { rhythm: Profile['reportingRhythm']; periodStart: string; periodEnd: string; daysRemaining: number }, [state.profile])
  // v31: if a custom scale is loaded and fully parsed, it fully replaces the
  // built-in Bitrix24 scale everywhere the UI reads "the" competency list.
  // v31: if a custom scale is loaded and fully parsed, it fully replaces the
  // built-in Bitrix24 scale everywhere the UI reads "the" competency list.
  const activeCompetencies = useMemo<Competency[]>(
    () => (state.customCompetencyScale?.status === 'ready' && state.customCompetencyScale.competencies?.length
      ? state.customCompetencyScale.competencies
      : competencies),
    [state.customCompetencyScale],
  )
  // v32: same source of truth, reshaped for AI retrieval (ai-contract.mjs /
  // local-guidance.mjs read allCriteria + competencyKeywords, not the raw
  // competency list). See active-scale.mjs for the derivation.
  const activeScale = useMemo<ActiveScale>(
    () => deriveActiveScale(state.customCompetencyScale as unknown as Parameters<typeof deriveActiveScale>[0]),
    [state.customCompetencyScale],
  )
  const growthPath = useMemo(() => computeGrowthPath(state as unknown as Record<string, unknown>, activeCompetencies, state.focusCompetencyIds) as {
    currentLevel: LevelKey
    nextLevel: LevelKey | null
    strongSignals: Array<{ id: string; title: string; count: number }>
    underdocumented: Array<{ id: string; title: string }>
    directions: Array<{ competencyId: string; title: string; criterion: string }>
    evidenceCount: number
    isFocused: boolean
  }, [state, activeCompetencies])

  function updateState(updater: (current: CareerState) => CareerState) {
    setState((current) => updater(current))
  }

  async function installPwa() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    setNotice(choice.outcome === 'accepted' ? 'Установка Эскады началась' : 'Установку можно запустить позже')
  }

  async function requestAi(action: AiAction, artifact: Record<string, unknown>, competencyIds: string[] = []) {
    setAiBusy(action)
    setAiError('')
    const aiProfile = { name: state.profile.name, market: state.profile.market, currentLevel: state.profile.currentLevel }
    const payload = { profile: aiProfile as unknown as Record<string, unknown>, artifact, competencyIds }
    // v32: the active scale (default or the user's uploaded custom one) now
    // travels with every AI request — both the offline fallback and the
    // external endpoint's request body, so retrieval always matches whatever
    // scale ScaleReference is currently showing. The external endpoint may
    // not read customScale yet; the field is included so the contract is
    // ready when server-side support lands.
    try {
      if (!ESCADA_AI_ENDPOINT) return buildLocalGuidance(action, payload, activeScale) as unknown as AiResponse
      // v42: a fetch to a genuinely hung endpoint (no response, no network
      // error) previously left aiBusy set forever, since nothing ever
      // rejected or resolved. 20s is generous for a guidance request but
      // still bounded. See Fable roadmap Patch G (P1-1).
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)
      let response: Response
      try {
        response = await fetch(ESCADA_AI_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            action,
            profile: aiProfile,
            artifact,
            competencyIds,
            customScale: activeScale.isCustom ? { competencies: activeScale.competencies, knowledgeBaseVersion: activeScale.knowledgeBaseVersion } : null,
          }),
        })
      } finally {
        clearTimeout(timeout)
      }
      const data = await response.json() as Record<string, unknown> & { message?: string }
      if (!response.ok) throw new Error(data.message || 'Внешняя подсказка вернула ошибку')
      // v42: parseAndValidateAiResponse already existed in ai-contract.mjs
      // (citation-id allowlisting, per-field length clamps, action-specific
      // required-field checks) but was never actually called from the
      // client — an external endpoint's raw response flowed straight into
      // the UI unvalidated, meaning the closed-world guarantee ("every
      // strength/stretch item must cite an allowed criterionId") was only
      // ever enforced by asking the model nicely in the prompt, never by
      // code. `retrieval` is computed locally (not trusted from the
      // response) so the allowlist the client validates against can never
      // be supplied by the same endpoint being validated.
      const retrieval = retrieveCriteria({ ...payload, action }, activeScale)
      return parseAndValidateAiResponse(data, retrieval, action) as unknown as AiResponse
    } catch (caughtError) {
      // Escada must remain useful without a network or AI provider: always fall
      // back to local guidance. But a configured endpoint that genuinely failed
      // (bad response, thrown error, failed validation, or timed out) should be
      // visible, not silently hidden — otherwise the person can't tell 'no
      // endpoint set' from 'endpoint is broken'.
      if (ESCADA_AI_ENDPOINT) {
        const isAbort = caughtError instanceof Error && caughtError.name === 'AbortError'
        const message = isAbort ? 'Внешняя подсказка не ответила вовремя' : caughtError instanceof Error ? caughtError.message : 'Внешняя подсказка недоступна'
        setAiError(`${message}. Показана локальная подсказка по шкале компетенций.`)
      }
      return buildLocalGuidance(action, payload, activeScale) as unknown as AiResponse
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

  // v40: `noteId` (not a Note snapshot) -- the note is looked up fresh from
  // `state.notes` right before use, so an edit saved moments earlier via
  // `editNote` (or any other update to this note) is never silently
  // ignored in favor of a stale object captured when the overlay opened.
  // `pendingText`, when provided, is an edit the person typed but had not
  // yet clicked "Сохранить" for -- applying it via a single updateState call
  // here (rather than calling editNote first and convertNoteToIdea second)
  // avoids a real race: setState updates are not synchronous, so a second
  // call reading `state.notes` immediately after the first would still see
  // the pre-edit value.
  // See Fable roadmap Patch E (P1-5/P1-6): "editing a note -> saving ->
  // 'Это идея!' used stale text" was reproduced exactly with the previous
  // Note-snapshot-passing pattern.
  function convertNoteToIdea(noteId: string, pendingText?: string) {
    const note = state.notes.find((item) => item.id === noteId)
    if (!note) return
    const effectiveText = pendingText?.trim() ? pendingText : note.rawText
    const derived = pendingText?.trim() ? deriveNoteTitle(effectiveText) : { title: note.title, body: note.body }
    const effectiveNote = { ...note, title: derived.title || effectiveText.slice(0, 40), body: derived.body, rawText: effectiveText }
    if (effectiveNote.convertedIdeaId) {
      const existingIdea = state.ideas.find((idea) => idea.id === effectiveNote.convertedIdeaId)
      if (existingIdea) {
        setOpenNote(null)
        setIdeaDraft(existingIdea)
        return
      }
    }
    const result = noteToIdea(effectiveNote as unknown as Record<string, unknown>, state.profile.currentLevel) as unknown as { idea: Idea; note: Note }
    updateState((current) => ({
      ...current,
      notes: current.notes.map((item) => item.id === noteId ? result.note : item),
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
    // v37: a level the person explicitly confirmed must survive save as-is —
    // recomputing it unconditionally on every save silently discarded the
    // confirmation. Only recompute (and drop the confirmed flag) when the
    // confirmed value no longer matches what the current text would infer,
    // since at that point the confirmation no longer describes this record.
    const stillMatches = draft.levelSignalConfirmed && draft.levelSignal === inferred.level
    const levelSignal = stillMatches ? draft.levelSignal : inferred.level
    const levelReason = stillMatches ? draft.levelReason : inferred.reason
    const levelSignalConfirmed = stillMatches
    const prepared = { ...draft, competencyIds, levelSignal, levelReason, levelSignalConfirmed, behaviorRefs, updatedAt: now }
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
    // v37: same protection as saveIdea — a level carried over confirmed from
    // the source idea must survive save unless the win's own text no longer
    // matches it.
    const stillMatches = draft.levelSignalConfirmed && draft.levelSignal === inferred.level
    const levelSignal = stillMatches ? draft.levelSignal : inferred.level
    const levelSignalConfirmed = Boolean(stillMatches)
    const prepared = { ...draft, competencyIds, levelSignal, levelSignalConfirmed, behaviorRefs }
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
    const now = new Date().toISOString()
    // v38: a single "Сохранить" updates the report already open (by id)
    // instead of always minting a new one — per product decision, re-saving
    // an open report must not create a duplicate. A genuinely new report is
    // only created when there is no currentReportId (a fresh draft that was
    // never opened from history), which openSavedReport/generateReport/
    // useProfileReportingPeriod are responsible for clearing at the right
    // moments (see their comments).
    if (currentReportId) {
      updateState((current) => ({
        ...current,
        reports: current.reports.map((item) => item.id === currentReportId
          ? { ...item, periodStart, periodEnd, winIds: selectedWinIds, ideaIds: selectedIdeaIds, content: reportText, updatedAt: now }
          : item),
      }))
      setReportBaseline(reportText)
      setNotice('Отчёт обновлён')
      return
    }
    const report: Report = {
      id: createId('report'),
      title: `${reportTypeLabels[reportType]} · ${formatDate(periodStart)} — ${formatDate(periodEnd)}`,
      type: reportType,
      periodStart,
      periodEnd,
      winIds: selectedWinIds,
      ideaIds: selectedIdeaIds,
      content: reportText,
      createdAt: now,
      updatedAt: now,
    }
    updateState((current) => ({ ...current, reports: [report, ...current.reports] }))
    setCurrentReportId(report.id)
    setReportBaseline(reportText)
    setNotice('Отчёт сохранён')
  }

  function openSavedReport(report: Report) {
    setReportType(report.type)
    setPeriodStart(report.periodStart)
    setPeriodEnd(report.periodEnd)
    setSelectedWinIds(report.winIds ?? [])
    setSelectedIdeaIds(report.ideaIds ?? [])
    setReportText(report.content ?? '')
    setReportBaseline(report.content ?? '')
    setReportGuidance(null)
    setReportDraftOpen(true)
    setCurrentReportId(report.id)
    setNotice('Сохранённая версия открыта')
  }

  function useProfileReportingPeriod() {
    setPeriodStart(reportingCycle.periodStart)
    setPeriodEnd(reportingCycle.periodEnd)
    setSelectedWinIds([])
    setSelectedIdeaIds([])
    setReportText('')
    setReportBaseline('')
    setReportGuidance(null)
    setReportDraftOpen(false)
    setCurrentReportId(null)
    setNotice('Период установлен по отчётному циклу профиля')
  }

  // v41: regenerating overwrites whatever is currently in the editor -- if
  // that content differs from the last known-good baseline (an edit the
  // person made since generating/opening/saving), confirm before
  // discarding it. See Fable roadmap Patch F (P1-6).
  async function generateReport() {
    if (reportText.trim() && reportText !== reportBaseline) {
      if (!window.confirm('Пересборка заменит текущий текст черновика новым. Продолжить?')) return
    }
    const wins = state.wins.filter((item) => selectedWinIds.includes(item.id))
    const ideas = state.ideas.filter((item) => selectedIdeaIds.includes(item.id))
    const response = await requestAi('report_draft', { reportType: reportTypeLabels[reportType], periodStart, periodEnd, wins, ideas }, [...new Set([...wins.flatMap((item) => item.competencyIds), ...ideas.flatMap((item) => item.competencyIds)])])
    setReportText(response.draftMarkdown ?? '')
    setReportBaseline(response.draftMarkdown ?? '')
    setReportGuidance(response)
    setReportDraftOpen(true)
    // v38: a freshly generated draft is not automatically "the same report"
    // as whatever was previously opened — clearing currentReportId means the
    // next save creates a new report rather than silently overwriting an
    // unrelated saved version. This runs on every generate, including
    // "Пересобрать черновик" on an already-open draft: regenerating content
    // is a big enough change that it should not overwrite the old saved
    // version without an explicit new save.
    setCurrentReportId(null)
  }

  async function reviewReport() {
    const response = await requestAi('report_review', { reportType: reportTypeLabels[reportType], content: reportText, selectedWins: state.wins.filter((item) => selectedWinIds.includes(item.id)) })
    setReportGuidance(response)
  }

  // v31: draft + mock-parse a custom competency scale. This does NOT touch
  // state.customCompetencyScale until the user explicitly applies it — see
  // handleApplyCustomScale, which is the destructive step.
  function handleCustomScaleUpload(rawInput: string, sourceType: 'text' | 'file', sourceFileName: string | null, title: string) {
    if (rawInput.trim().length < CUSTOM_SCALE_MIN_CHARS) {
      setNotice('Слишком короткий текст — добавьте больше деталей инструкций')
      return null
    }
    const draft = createCustomScaleDraft(rawInput, sourceType, sourceFileName, title) as CustomCompetencyScale
    try {
      const parsed = parseCustomScaleMock(rawInput, title)
      return normalizeCustomCompetencyScale({
        ...draft,
        status: 'ready',
        competencies: parsed.competencies,
        knowledgeBaseVersion: parsed.knowledgeBaseVersion,
        parseNotes: [MOCK_PARSER_DISCLAIMER, ...parsed.parseNotes],
      }) as unknown as CustomCompetencyScale
    } catch (err) {
      return normalizeCustomCompetencyScale({
        ...draft,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Не удалось разобрать текст',
      }) as unknown as CustomCompetencyScale
    }
  }

  // Applying a ready custom scale fully replaces the default one and resets
  // the whole working cycle (notes/ideas/wins/reports) — old competencyIds
  // would otherwise silently point at a scale that no longer exists.
  function handleApplyCustomScale(scale: CustomCompetencyScale) {
    setState((current) => asState(resetCycleForNewScale(current as unknown as Record<string, unknown>, scale)))
    setGrowthTab('scale')
    setNotice('Загружена новая шкала — рабочий цикл начат заново')
  }

  function handleDiscardCustomScale() {
    updateState((current) => ({ ...current, customCompetencyScale: null }))
    setNotice('Возврат к стандартной шкале Bitrix24')
  }

  // v33: personal focus is a choice the person makes themselves, not an
  // AI-generated recommendation — see growthPath.directions for the AI-side
  // suggestion, which stays separate. Capped at 3 to match the product
  // decision (1-3 competencies per cycle).
  function handleSetFocus(competencyIds: string[]) {
    updateState((current) => ({ ...current, focusCompetencyIds: competencyIds.slice(0, 3) }))
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
        if (!isEscadaState(raw) && !raw.tasks && !raw.profile) {
          setNotice('Файл не похож на экспорт Эскады')
          return
        }
        const incoming = stateCounts(raw)
        const existing = stateCounts(state)
        const confirmed = window.confirm(
          `Заменить текущие данные (${existing.ideas} идей, ${existing.wins} wins, ${existing.reports} отчётов) `
          + `на импортируемые (${incoming.ideas} идей, ${incoming.wins} wins, ${incoming.reports} отчётов)? `
          + 'Текущие данные будут сохранены в резервную копию.'
        )
        if (!confirmed) return
        writeBackup(state)
        setState(asState(migrateState(raw, createDefaultState())))
        // v40: any open editor holds a snapshot of an entity that may no
        // longer exist (or may exist with different content) in the
        // freshly-imported dataset. Leaving it open risks the person saving
        // a "resurrected" pre-import entity into the new data. See Fable
        // roadmap Patch E (P1-5/P1-6).
        setIdeaDraft(null)
        setWinDraft(null)
        setOpenNote(null)
        setNewIdeaFromNote(null)
        setNotice('Данные импортированы')
      } catch { setNotice('Не удалось прочитать файл') }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  if (!hydrated) return <main className={styles.loading}>Загружаем Эскаду…</main>

  return (
    <main className={[styles.shell, sidebarCollapsed ? styles.shellSidebarCollapsed : '', isStandalone ? styles.pwaStandalone : ''].filter(Boolean).join(' ')}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.brandMark}><LadderLogo /></span><div><strong>Эскада</strong><small>профессиональная память</small></div></div>
        <nav className={styles.nav} aria-label="Основная навигация">
          {navItems.map((item) => <button key={item.id} type="button" className={view === item.id ? styles.navActive : styles.navItem} aria-current={view === item.id ? 'page' : undefined} title={sidebarCollapsed ? item.label : undefined} onClick={() => setView(item.id)}><span className={styles.navIcon}>{item.icon}</span><span><strong>{item.label}</strong><small>{item.caption}</small></span></button>)}
        </nav>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeading}>
            <button type="button" className={styles.sidebarToggleButton} aria-label={sidebarCollapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'} title={`${sidebarCollapsed ? 'Развернуть' : 'Свернуть'} боковую панель · Ctrl/⌘ B`} onClick={() => setSidebarCollapsed((current) => !current)}><SidebarToggleIcon collapsed={sidebarCollapsed} /></button>
            <div><p className={styles.eyebrow}>Записал → развил → подтвердил → оформил</p><h1>{navItems.find((item) => item.id === view)?.label}</h1></div>
          </div>
          <div className={styles.topbarActions}>
            {isOffline && <span className={styles.offlineBadge} role="status"><span aria-hidden="true" />Офлайн</span>}
            {!isStandalone && installPrompt && <button type="button" className={styles.pwaInstallButton} onClick={installPwa} title="Установить Эскаду как приложение"><span aria-hidden="true">↓</span><strong>Установить</strong></button>}
            <button type="button" className={styles.profileChip} onClick={() => setProfileOpen(true)}><span>{state.profile.name.slice(0, 1) || 'Э'}</span><div><strong>{state.profile.name || 'Мой профиль'}</strong><small>{levelLabels[state.profile.currentLevel]}</small></div></button>
          </div>
        </header>

        {view === 'today' && <TodayView quickText={quickText} onQuickText={setQuickText} onSubmit={submitNote} notes={state.notes} onOpenNote={setOpenNote} />}
        {view === 'ideas' && <IdeasView ideas={state.ideas} wins={state.wins} onNew={() => setIdeaDraft(newIdea(state.profile.currentLevel, '', state.focusCompetencyIds))} onOpen={(idea) => setIdeaDraft(idea)} onStatusChange={changeIdeaStatus} onRestore={restoreIdea} onQuickWin={(idea) => { if (window.confirm('Превратить идею в win?')) startWinFromIdea(idea) }} />}
        {view === 'wins' && <WinsView wins={state.wins} ideas={state.ideas} onNew={() => setWinDraft(emptyWin(state.focusCompetencyIds))} onOpen={(win) => setWinDraft({ ...win })} onDelete={removeWin} onReports={() => setView('reports')} />}
        {view === 'reports' && <ReportsView profile={state.profile} cycle={reportingCycle} wins={winsInPeriod} ideas={activeIdeas} selectedWinIds={selectedWinIds} selectedIdeaIds={selectedIdeaIds} periodStart={periodStart} periodEnd={periodEnd} reportType={reportType} reportText={reportText} reports={state.reports} guidance={reportGuidance} busy={aiBusy} error={aiError} onPeriodStart={setPeriodStart} onPeriodEnd={setPeriodEnd} onReportType={setReportType} onToggleWin={(id) => setSelectedWinIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onToggleIdea={(id) => setSelectedIdeaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onSelectAll={() => setSelectedWinIds(winsInPeriod.map((item) => item.id))} onGenerate={generateReport} onReview={reviewReport} onReportText={setReportText} onSave={saveReport} onOpenReport={openSavedReport} onUseProfilePeriod={useProfileReportingPeriod} onOpenProfile={() => setProfileOpen(true)} />}
        {view === 'reports' && reportDraftOpen && <ReportDraftModal reportType={reportType} reportText={reportText} guidance={reportGuidance} busy={aiBusy} profile={state.profile} periodStart={periodStart} periodEnd={periodEnd} isUpdate={Boolean(currentReportId)} isDirty={reportText.trim() !== reportBaseline.trim()} onReview={reviewReport} onReportText={setReportText} onSave={saveReport} onClose={() => { setReportDraftOpen(false); setReportText(''); setReportBaseline(''); setReportGuidance(null); setCurrentReportId(null) }} onNotice={setNotice} />}
        {view === 'growth' && <GrowthView profile={state.profile} path={growthPath} activeCompetencies={activeCompetencies} customScale={state.customCompetencyScale} focusCompetencyIds={state.focusCompetencyIds} onSetFocus={handleSetFocus} tab={growthTab} onTab={setGrowthTab} guidance={growthGuidance} busy={aiBusy} error={aiError} onAi={async () => setGrowthGuidance(await requestAi('growth_guidance', { ideas: activeIdeas, wins: state.wins, growthPath }))} onCreateIdea={(competency) => { const idea = newIdea(state.profile.currentLevel, `Развить: ${competency.shortTitle}`); idea.competencyIds = [competency.id]; setIdeaDraft(idea) }} onUploadScale={handleCustomScaleUpload} onApplyScale={handleApplyCustomScale} onDiscardScale={handleDiscardCustomScale} />}
      </section>

      <nav className={styles.mobileNav} aria-label="Мобильная навигация">{navItems.map((item) => <button key={item.id} type="button" className={view === item.id ? styles.mobileActive : ''} onClick={() => setView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>

      {!state.onboardingComplete && <Onboarding initial={state.profile} onComplete={(profile) => updateState((current) => ({ ...current, onboardingComplete: true, profile }))} onDemo={() => setState(asState(demoState()))} />}
      {profileOpen && <ProfileModal profile={state.profile} onClose={() => setProfileOpen(false)} onSave={(profile) => { updateState((current) => ({ ...current, profile })); setProfileOpen(false); setNotice('Профиль обновлён') }} onExport={exportData} onImport={() => importRef.current?.click()} />}
      {ideaDraft && <IdeaWorkspace draft={ideaDraft} profile={state.profile} busy={aiBusy} error={aiError} onClose={() => setIdeaDraft(null)} onSave={saveIdea} onPromote={startWinFromIdea} onRestore={restoreIdea} onAi={(idea) => requestAi('idea_review', idea as unknown as Record<string, unknown>, idea.competencyIds)} />}
      {newIdeaFromNote && <NewIdeaModal idea={newIdeaFromNote} onClose={() => setNewIdeaFromNote(null)} onSave={(idea) => { saveIdea(idea, true); setNewIdeaFromNote(null) }} onPromote={(idea) => { setNewIdeaFromNote(null); startWinFromIdea(idea) }} />}
      {winDraft && <WinModal draft={winDraft} profile={state.profile} busy={aiBusy} error={aiError} onClose={() => setWinDraft(null)} onSave={saveWin} onDelete={removeWin} onAi={(win) => requestAi('win_rewrite', win as unknown as Record<string, unknown>, win.competencyIds)} />}
      {openNote && <NoteOverlay note={openNote} busy={aiBusy} error={aiError} onClose={() => setOpenNote(null)} onConvert={convertNoteToIdea} onEdit={editNote} onAi={(note) => requestAi('idea_review', { title: note.title, details: note.body || note.rawText } as unknown as Record<string, unknown>, [])} />}
      <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json" onChange={importData} />
      {recoveryBanner && (
        <div className={styles.recoveryBanner} role="alert">
          <span>{recoveryBanner}</span>
          <div className={styles.recoveryBannerActions}>
            <button type="button" onClick={exportData}>Экспортировать данные</button>
            <button type="button" onClick={() => setRecoveryBanner('')}>Закрыть</button>
          </div>
        </div>
      )}
      {swReloadPending && (
        <div className={styles.updateBanner} role="status">
          <span>Доступно обновление Эскады.</span>
          <div className={styles.updateBannerActions}>
            <button type="button" onClick={() => window.location.reload()}>Перезагрузить</button>
            <button type="button" onClick={() => setSwReloadPending(false)}>Позже</button>
          </div>
        </div>
      )}
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
  onConvert: (noteId: string, pendingText?: string) => void
  onEdit: (noteId: string, rawText: string) => void
  onAi: (note: Note) => Promise<AiResponse>
}) {
  const [text, setText] = useState(note.rawText)
  const [guidance, setGuidance] = useState<AiResponse | null>(null)
  const dirty = text.trim() !== note.rawText.trim()
  async function runAi() { setGuidance(await onAi(note)) }
  function save() { if (text.trim()) onEdit(note.id, text) }
  // v40: pass the just-typed text straight through to onConvert instead of
  // calling onEdit first and onConvert second -- setState updates are not
  // synchronous, so a second call reading state.notes immediately after
  // the first would still see the pre-edit value. A single atomic path
  // avoids that race entirely.
  function convert() {
    onConvert(note.id, dirty ? text : undefined)
  }
  return <Modal title={note.title} subtitle="" onClose={onClose} isDirty={dirty}>
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
        <button className={styles.primaryButton} type="button" onClick={convert}>{note.convertedIdeaId ? 'Открыть идею' : 'Это идея!'}</button>
        <button className={styles.aiMiniButton} type="button" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Думаем…' : '✦ Улучшить'}</button>
      </div>
    </div>
  </Modal>
}

function IdeasView({ ideas, wins, onNew, onOpen, onStatusChange, onRestore, onQuickWin }: {
  ideas: Idea[]
  wins: Win[]
  onNew: () => void
  onOpen: (idea: Idea) => void
  onStatusChange: (ideaId: string, status: ActiveIdeaStatus) => void
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

function ReportsView({ wins, ideas, selectedWinIds, selectedIdeaIds, periodStart, periodEnd, reportType, reportText, reports, busy, error, onPeriodStart, onPeriodEnd, onReportType, onToggleWin, onToggleIdea, onSelectAll, onGenerate, onOpenReport }: {
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
  // v38: report reachability — the full saved-reports history now lives on
  // this page (not just the last 5 shown inside the open draft modal), with
  // a simple type filter. `savedAt` falls back to createdAt for reports
  // saved before v38 added updatedAt.
  const [historyFilter, setHistoryFilter] = useState<ReportType | 'all'>('all')
  const visibleHistory = reports.filter((report) => historyFilter === 'all' || report.type === historyFilter)
  return <div className={styles.pageStack}>
    <section className={styles.reportTypeGrid}>{visibleReportTypes.map((value) => <button type="button" key={value} className={reportType === value ? styles.reportTypeActive : styles.reportTypeCard} onClick={() => onReportType(value)}><strong>{reportTypeLabels[value]}</strong></button>)}</section>

    <section className={`${styles.panel} ${styles.reportBuilder}`}>
      <div className={styles.dateGrid}><label>С<input type="date" value={periodStart} onChange={(event) => onPeriodStart(event.target.value)} /></label><label>По<input type="date" value={periodEnd} onChange={(event) => onPeriodEnd(event.target.value)} /></label></div>
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Достижения</span><h3>Выберите wins</h3></div><button className={styles.textButton} type="button" onClick={onSelectAll}>Выбрать все</button></div>
      <div className={styles.reportWins}>{wins.map((win) => <label className={styles.reportWin} key={win.id}><input type="checkbox" checked={selectedWinIds.includes(win.id)} onChange={() => onToggleWin(win.id)} /><div><strong>{win.title}</strong><span>{formatDate(win.date)}</span>{winGapHints(win as unknown as Record<string, unknown>).slice(0, 1).map((hint) => <small key={hint}>{hint}</small>)}</div></label>)}</div>
      <details className={styles.optionalBlock}><summary>Добавить идеи в работе — необязательно</summary><div className={styles.reportWins}>{ideas.map((idea) => <label className={styles.reportWin} key={idea.id}><input type="checkbox" checked={selectedIdeaIds.includes(idea.id)} onChange={() => onToggleIdea(idea.id)} /><div><strong>{idea.title}</strong><span>{idea.nextStep || 'Без следующего шага'}</span></div></label>)}</div></details>
      <div className={styles.reportActionRow}><p>Эскада соберёт текст только из выбранных записей. Цифры и влияние нужно подтвердить самостоятельно.</p><button className={styles.primaryButton} type="button" disabled={!selectedWinIds.length || busy === 'report_draft'} onClick={() => void onGenerate()}>{busy === 'report_draft' ? 'Эскада собирает…' : reportText ? 'Пересобрать черновик' : 'Собрать черновик с Эскадой'}</button></div>
      {error && <p className={styles.aiError}>{error}</p>}
    </section>

    {reports.length > 0 && <section className={`${styles.panel} ${styles.reportHistoryPanel}`}>
      <div className={styles.sectionHeader}>
        <div><span className={styles.eyebrow}>История</span><h3>Сохранённые отчёты</h3></div>
        <select className={styles.historyFilterSelect} value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as ReportType | 'all')} aria-label="Фильтр по типу отчёта">
          <option value="all">Все типы</option>
          {visibleReportTypes.map((value) => <option key={value} value={value}>{reportTypeLabels[value]}</option>)}
        </select>
      </div>
      {visibleHistory.length
        ? <div className={styles.savedReports}>{visibleHistory.map((report) => <button type="button" className={styles.savedReportCard} key={report.id} onClick={() => onOpenReport(report)}><strong>{report.title}</strong><span>{formatDate((report.updatedAt ?? report.createdAt).slice(0, 10))}</span><small>Открыть версию</small></button>)}</div>
        : <p className={styles.muted}>Нет отчётов этого типа.</p>}
    </section>}
  </div>
}

function ReportDraftModal({ reportType, reportText, guidance, busy, profile, periodStart, periodEnd, isUpdate, isDirty, onReview, onReportText, onSave, onClose, onNotice }: {
  reportType: ReportType
  reportText: string
  guidance: AiResponse | null
  busy: string
  profile: Profile
  periodStart: string
  periodEnd: string
  // v38: single "Сохранить" button now updates the report already open (by
  // id) instead of always creating a new one — this label reflects which
  // will happen, since silently overwriting history without saying so would
  // be confusing.
  isUpdate: boolean
  // v41: whether reportText currently differs from the last known-good
  // baseline (see reportBaseline in the parent). See Fable roadmap Patch F.
  isDirty: boolean
  onReview: () => Promise<void>
  onReportText: (value: string) => void
  onSave: () => void
  onClose: () => void
  onNotice: (message: string) => void
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copyReportText() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reportText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = reportText
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopyState('copied')
      onNotice('Отчёт скопирован в буфер обмена')
    } catch {
      setCopyState('failed')
      onNotice('Не удалось скопировать — выделите текст вручную')
    }
    window.setTimeout(() => setCopyState('idle'), 2200)
  }

  function printReport() {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!printWindow) {
      onNotice('Браузер заблокировал окно печати — разрешите всплывающие окна')
      return
    }
    // v38: title/periodLine are built from free-text profile.name and were
    // previously interpolated into <title>/<h1> without escaping — a name
    // containing '<', '>' or '&' (even pasted in by accident) could break
    // the printed document's HTML structure. escapeHtml now covers every
    // interpolated string, not just the report body.
    const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const title = escapeHtml(`${reportTypeLabels[reportType]} · ${profile.name || 'Эскада'}`)
    const periodLine = periodStart && periodEnd ? escapeHtml(`${formatDate(periodStart)} — ${formatDate(periodEnd)}`) : ''
    const escapedBody = escapeHtml(reportText)
    printWindow.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8" /><title>${title}</title><style>
      body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a2e; max-width: 720px; margin: 48px auto; padding: 0 24px; line-height: 1.55; }
      header { margin-bottom: 28px; border-bottom: 2px solid #1a1a2e; padding-bottom: 16px; }
      header h1 { font-size: 22px; margin: 0 0 4px; }
      header p { margin: 0; color: #555; font-size: 14px; }
      pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 15px; margin: 0; }
      @media print { body { margin: 0; padding: 24px; } }
    </style></head><body><header><h1>${title}</h1>${periodLine ? `<p>${periodLine}</p>` : ''}</header><pre>${escapedBody}</pre></body></html>`)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 250)
  }

  const actions = <div className={styles.artifactFooterRight}>
    <button className={styles.secondaryButton} type="button" onClick={() => void copyReportText()}>{copyState === 'copied' ? '✓ Скопировано' : copyState === 'failed' ? 'Не удалось — попробуйте снова' : 'Скопировать'}</button>
    <button className={styles.secondaryButton} type="button" onClick={printReport}>Печать / PDF</button>
    <button className={styles.secondaryButton} type="button" disabled={busy === 'report_review'} onClick={() => void onReview()}>{busy === 'report_review' ? 'Проверяем…' : 'Проверить по шкале'}</button>
    <button className={styles.primaryButton} type="button" onClick={onSave}>{isUpdate ? 'Сохранить изменения' : 'Сохранить отчёт'}</button>
  </div>
  return <ArtifactEditorShell label={reportTypeLabels[reportType]} onClose={onClose} actions={actions} isDirty={isDirty}>
    <textarea className={styles.reportEditorTextarea} value={reportText} onChange={(event) => onReportText(event.target.value)} aria-label="Текст отчёта" autoFocus />
    {guidance && <AiGuidancePanel guidance={guidance} compact />}
  </ArtifactEditorShell>
}

function GrowthView({ profile, path, activeCompetencies, customScale, focusCompetencyIds, onSetFocus, tab, onTab, guidance, busy, error, onAi, onCreateIdea, onUploadScale, onApplyScale, onDiscardScale }: { profile: Profile; path: ReturnType<typeof computeGrowthPath> & { currentLevel: LevelKey; nextLevel: LevelKey | null; strongSignals: Array<{ id: string; title: string; count: number }>; underdocumented: Array<{ id: string; title: string }>; directions: Array<{ competencyId: string; title: string; criterion: string }>; isFocused: boolean }; activeCompetencies: Competency[]; customScale: CustomCompetencyScale | null; focusCompetencyIds: string[]; onSetFocus: (competencyIds: string[]) => void; tab: GrowthTab; onTab: (tab: GrowthTab) => void; guidance: AiResponse | null; busy: string; error: string; onAi: () => Promise<void>; onCreateIdea: (competency: Competency) => void; onUploadScale: (rawInput: string, sourceType: 'text' | 'file', sourceFileName: string | null, title: string) => CustomCompetencyScale | null; onApplyScale: (scale: CustomCompetencyScale) => void; onDiscardScale: () => void }) {
  return <div className={styles.pageStack}><section className={styles.pageIntro}><div><span className={styles.eyebrow}>Ожидания, а не оценка</span><p>Шкала помогает понимать текущие ожидания и следующий шаг. Она не превращается в обязательный чеклист.</p></div></section><div className={styles.segmentedControl}><button type="button" className={tab === 'path' ? styles.segmentActive : ''} onClick={() => onTab('path')}>Мой путь</button><button type="button" className={tab === 'scale' ? styles.segmentActive : ''} onClick={() => onTab('scale')}>Шкала</button></div>{tab === 'path' ? <><section className={styles.progressHero}><div><span className={styles.eyebrow}>Ваш контекст</span><h2>{levelLabels[profile.currentLevel]}</h2><p>{profile.market || 'Рынок или команда не указаны'}</p></div><div className={styles.levelRoute}><div><small>Текущий уровень</small><strong>{levelLabels[profile.currentLevel]}</strong></div><span>→</span><div><small>{path.nextLevel ? 'Следующий уровень' : 'Следующий масштаб'}</small><strong>{path.nextLevel ? levelLabels[path.nextLevel] : 'Больше системного влияния'}</strong></div></div></section><FocusManager activeCompetencies={activeCompetencies} focusCompetencyIds={focusCompetencyIds} onSetFocus={onSetFocus} /><div className={styles.progressGrid}><section className={styles.progressCard}><span className={styles.eyebrow}>Сильные сигналы</span><h3>Уже подтверждаются работой</h3>{path.strongSignals.length ? path.strongSignals.map((item) => <div className={styles.progressSignal} key={item.id}><strong>{item.title}</strong><span>{item.count} сигналов</span></div>) : <p className={styles.muted}>Добавьте идеи и wins — Эскада покажет устойчивые сигналы.</p>}</section><section className={styles.progressCard}><span className={styles.eyebrow}>{path.isFocused ? 'Не хватает по фокусу' : 'Недостаточно подтверждено'}</span><h3>Не пробел, а зона наблюдения</h3>{path.underdocumented.length ? path.underdocumented.map((item) => <div className={styles.progressSignal} key={item.id}><strong>{item.title}</strong><span>мало записей</span></div>) : <p className={styles.muted}>{path.isFocused ? 'По выбранному фокусу уже есть записи.' : 'Пробелов не найдено.'}</p>}</section></div><section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>{path.isFocused ? 'Фокус этого цикла' : 'Следующий фокус'}</span><h3>1–3 направления</h3></div><button className={styles.aiMiniButton} type="button" disabled={busy === 'growth_guidance'} onClick={() => void onAi()}>{busy === 'growth_guidance' ? 'Эскада думает…' : '✦ Что развивать дальше?'}</button></div><div className={styles.directionGrid}>{path.directions.map((item) => <article key={item.competencyId}><strong>{item.title}</strong><p>{item.criterion}</p><button type="button" className={styles.textButton} onClick={() => { const competency = competencyById(item.competencyId); if (competency) onCreateIdea(competency) }}>Создать идею</button></article>)}</div>{error && <p className={styles.aiError}>{error}</p>}</section>{guidance && <AiGuidancePanel guidance={guidance} />}</> : <ScaleReference profile={profile} activeCompetencies={activeCompetencies} customScale={customScale} onCreateIdea={onCreateIdea} onUploadScale={onUploadScale} onApplyScale={onApplyScale} onDiscardScale={onDiscardScale} />}</div>
}

function FocusManager({ activeCompetencies, focusCompetencyIds, onSetFocus }: { activeCompetencies: Competency[]; focusCompetencyIds: string[]; onSetFocus: (competencyIds: string[]) => void }) {
  const [expanded, setExpanded] = useState(false)
  // Local draft so picking chips doesn't write to state on every click —
  // only "Сохранить" commits it, matching the pattern in CustomScaleManager.
  const [draft, setDraft] = useState<string[]>(focusCompetencyIds)
  const validFocus = focusCompetencyIds.filter((id) => activeCompetencies.some((item) => item.id === id))

  function openEditor() {
    setDraft(focusCompetencyIds)
    setExpanded(true)
  }

  function toggle(id: string) {
    setDraft((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= 3) return current
      return [...current, id]
    })
  }

  function save() {
    onSetFocus(draft)
    setExpanded(false)
  }

  return <section className={styles.panel}>
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>Личный фокус</span><h3>{validFocus.length ? `На чём я расту: ${validFocus.map((id) => activeCompetencies.find((item) => item.id === id)?.shortTitle).filter(Boolean).join(', ')}` : 'Фокус не выбран'}</h3></div>
      <button className={styles.aiMiniButton} type="button" onClick={openEditor}>{validFocus.length ? 'Изменить фокус' : 'Выбрать фокус'}</button>
    </div>
    {!validFocus.length && !expanded && <p className={styles.muted}>Без фокуса «Рост» показывает все направления сразу. Выберите 1–3 компетенции — новые идеи и wins будут по умолчанию привязываться к ним.</p>}
    {expanded && <div className={styles.modalForm}>
      <p className={styles.muted}>Выберите до 3 компетенций, на которых сфокусируетесь в этом цикле. Это ваш выбор — Эскада может только подсказать (кнопка «Что развивать дальше?» ниже), но не выбирает за вас.</p>
      <div className={styles.competencyChipGrid}>{activeCompetencies.map((competency) => <button key={competency.id} type="button" className={draft.includes(competency.id) ? styles.chipActive : styles.chip} disabled={!draft.includes(competency.id) && draft.length >= 3} onClick={() => toggle(competency.id)}>{competency.shortTitle}</button>)}</div>
      <div className={styles.newIdeaWinRow}>
        <button type="button" className={styles.secondaryButton} onClick={() => setExpanded(false)}>Отменить</button>
        <button type="button" className={styles.textButton} onClick={() => { setDraft([]); onSetFocus([]); setExpanded(false) }}>Сбросить фокус</button>
        <button type="button" className={styles.primaryButton} onClick={save}>Сохранить</button>
      </div>
    </div>}
  </section>
}

function ScaleReference({ profile, activeCompetencies, customScale, onCreateIdea, onUploadScale, onApplyScale, onDiscardScale }: { profile: Profile; activeCompetencies: Competency[]; customScale: CustomCompetencyScale | null; onCreateIdea: (competency: Competency) => void; onUploadScale: (rawInput: string, sourceType: 'text' | 'file', sourceFileName: string | null, title: string) => CustomCompetencyScale | null; onApplyScale: (scale: CustomCompetencyScale) => void; onDiscardScale: () => void }) {
  const target = nextLevel(profile.currentLevel)
  const isCustomActive = customScale?.status === 'ready' && Boolean(customScale.competencies?.length)
  return <section className={styles.pageStack}>
    <CustomScaleManager customScale={customScale} isCustomActive={isCustomActive} onUploadScale={onUploadScale} onApplyScale={onApplyScale} onDiscardScale={onDiscardScale} />
    <section className={styles.competencyGrid}>{activeCompetencies.map((competency, index) => <article className={styles.competencyCard} key={competency.id}><div className={styles.competencyNumber}>{String(index + 1).padStart(2, '0')}</div><div><span className={styles.domainBadge}>{competency.shortTitle}</span><h3>{competency.title}</h3><p>{competency.summary}</p><div className={styles.expectationColumns}><section><small>Ожидания сейчас · {levelLabels[profile.currentLevel]}</small><ul>{competency.levels[profile.currentLevel].map((criterion) => <li key={criterion.id}>{criterion.text}</li>)}</ul></section><section><small>{target ? `Следующий уровень · ${levelLabels[target]}` : 'Усиление влияния'}</small><ul>{competency.levels[target ?? profile.currentLevel].map((criterion) => <li key={criterion.id}>{criterion.text}</li>)}</ul></section></div><button className={styles.textButton} type="button" onClick={() => onCreateIdea(competency)}>Создать growth idea</button></div></article>)}</section>
  </section>
}

function CustomScaleManager({ customScale, isCustomActive, onUploadScale, onApplyScale, onDiscardScale }: { customScale: CustomCompetencyScale | null; isCustomActive: boolean; onUploadScale: (rawInput: string, sourceType: 'text' | 'file', sourceFileName: string | null, title: string) => CustomCompetencyScale | null; onApplyScale: (scale: CustomCompetencyScale) => void; onDiscardScale: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState('Моя шкала')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<CustomCompetencyScale | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setText(String(reader.result ?? '')); setFileName(file.name) }
    reader.readAsText(file)
    event.target.value = ''
  }

  function handleParse() {
    const sourceType = fileName ? 'file' : 'text'
    const result = onUploadScale(text, sourceType, fileName, title)
    setPreview(result)
  }

  function handleApply() {
    if (!preview || preview.status !== 'ready') return
    onApplyScale(preview)
    setExpanded(false)
    setPreview(null)
    setConfirmText('')
    setText('')
    setFileName(null)
  }

  return <section className={styles.panel}>
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>Источник шкалы</span><h3>{isCustomActive ? `Своя шкала · ${customScale?.title}` : 'Шкала Bitrix24 (по умолчанию)'}</h3></div>
      <button className={styles.aiMiniButton} type="button" onClick={() => setExpanded((current) => !current)}>{expanded ? 'Свернуть' : (isCustomActive ? 'Загрузить другую' : 'Загрузить свою шкалу')}</button>
    </div>
    {isCustomActive && !expanded && <p className={styles.muted}>Активна пользовательская шкала ({customScale?.competencies?.length ?? 0} компетенций). <button type="button" className={styles.textButton} onClick={onDiscardScale}>Вернуться к шкале Bitrix24</button></p>}
    {expanded && <div className={styles.modalForm}>
      <p className={styles.aiCaveat}>{MOCK_PARSER_DISCLAIMER} Полная замена шкалы обнулит текущие идеи, wins, отчёты и фокус — история цикла начнётся заново.</p>
      <label className={styles.field}>Название шкалы<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className={styles.field}>Вставьте инструкции<textarea value={text} onChange={(event) => { setText(event.target.value); setFileName(null) }} placeholder={'Например:\n# Название компетенции\n- Специалист: ...\n- Senior: ...\n- Lead: ...'} rows={8} /></label>
      <div className={styles.newIdeaWinRow}>
        <button type="button" className={styles.secondaryButton} onClick={() => fileInputRef.current?.click()}>{fileName ? `Файл: ${fileName}` : 'Загрузить .txt/.md файл'}</button>
        <button type="button" className={styles.primaryButton} disabled={text.trim().length < CUSTOM_SCALE_MIN_CHARS} onClick={handleParse}>Разобрать через ИИ (мокап)</button>
      </div>
      <input ref={fileInputRef} className={styles.hiddenInput} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleFile} />
      {preview && preview.status === 'error' && <p className={styles.aiError}>{preview.errorMessage}</p>}
      {preview && preview.status === 'ready' && <div className={styles.savedReports}>
        <p className={styles.muted}>Разобрано: {preview.competencies?.length ?? 0} компетенций.</p>
        {preview.parseNotes.map((note, index) => <p key={index} className={styles.aiCaveat}>{note}</p>)}
        <ul>{preview.competencies?.map((competency) => <li key={competency.id}><strong>{competency.title}</strong> — {competency.levels.specialist.length + competency.levels.senior.length + competency.levels.lead.length} критериев</li>)}</ul>
        <label className={styles.field}>Чтобы применить и обнулить текущий цикл, введите ПРИМЕНИТЬ<input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="ПРИМЕНИТЬ" /></label>
        <div className={styles.newIdeaWinRow}>
          <button type="button" className={styles.secondaryButton} onClick={() => setPreview(null)}>Отменить</button>
          <button type="button" className={styles.primaryButton} disabled={confirmText.trim().toUpperCase() !== 'ПРИМЕНИТЬ'} onClick={handleApply}>Применить и начать цикл заново</button>
        </div>
      </div>}
    </div>}
  </section>
}

function NewIdeaModal({ idea, onClose, onSave, onPromote }: {
  idea: Idea
  onClose: () => void
  onSave: (idea: Idea) => void
  onPromote: (idea: Idea) => void
}) {
  const [draft, setDraft] = useState(idea)
  return <Modal title="Новая идея" subtitle="Название и смысл — остальное можно добавить позже, открыв идею из «Идеи»." onClose={onClose} isDirty={JSON.stringify(draft) !== JSON.stringify(idea)}>
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

function IdeaWorkspace({ draft: initial, profile, busy, error, onClose, onSave, onPromote, onRestore, onAi }: { draft: Idea; profile: Profile; busy: string; error: string; onClose: () => void; onSave: (idea: Idea, close?: boolean) => Idea; onPromote: (idea: Idea) => void; onRestore: (ideaId: string) => void; onAi: (idea: Idea) => Promise<AiResponse> }) {
  const [draft, setDraft] = useState(initial)
  const [noteText, setNoteText] = useState('')
  const [evidenceText, setEvidenceText] = useState('')
  const [guidance, setGuidance] = useState<AiResponse | null>(null)
  const isTerminal = draft.status === 'won' || draft.status === 'archived'
  const text = [draft.title, draft.details, draft.nextStep, ...draft.workItems.map((item) => item.title), ...draft.notes.map((item) => item.text)].join(' ')
  const suggestedCompetencies = suggestCompetencyIds(text, competencies, competencyKeywords)
  const inferred = inferLevelSignal(text, profile.currentLevel) as { level: LevelKey; reason: string }
  // v37: the confirmation only counts while it still matches what the
  // current text would infer — if the person keeps editing after
  // confirming, the confirmed value can silently drift from what the record
  // now says, so it must re-earn confirmation rather than stay stale.
  const isLevelSignalConfirmed = draft.levelSignalConfirmed && draft.levelSignal === inferred.level
  function confirmLevelSignal() {
    setDraft((current) => ({ ...current, levelSignal: inferred.level, levelReason: inferred.reason, levelSignalConfirmed: true }))
  }
  const selectedCompetencies = draft.competencyIds.length ? draft.competencyIds : suggestedCompetencies
  const currentExpectations = selectedCompetencies.flatMap((id) => competencyById(id)?.levels[profile.currentLevel].slice(0, 2) ?? []).slice(0, 3)
  const target = nextLevel(profile.currentLevel)
  const nextExpectations = target ? selectedCompetencies.flatMap((id) => competencyById(id)?.levels[target].slice(0, 2) ?? []).slice(0, 3) : []

  async function runAi() { setGuidance(await onAi(draft)) }
  function addNote() { const value = noteText.trim(); if (!value) return; setDraft((current) => ({ ...current, notes: [...current.notes, { id: createId('note'), text: value, createdAt: new Date().toISOString() }] })); setNoteText('') }
  function addEvidence() { const value = evidenceText.trim(); if (!value) return; setDraft((current) => ({ ...current, evidenceNotes: [...current.evidenceNotes, { id: createId('evidence'), text: value, createdAt: new Date().toISOString() }] })); setEvidenceText('') }
  function toggleCompetency(id: string) { setDraft((current) => ({ ...current, competencyIds: current.competencyIds.includes(id) ? current.competencyIds.filter((item) => item !== id) : [...current.competencyIds, id] })) }

  const statusControl = <select className={styles.artifactStatusSelect} value={draft.status} disabled={isTerminal} onChange={(event) => setDraft({ ...draft, status: event.target.value as ActiveIdeaStatus })} aria-label="Статус идеи">
    {isTerminal && <option value={draft.status}>{statusLabels[draft.status]}</option>}
    {!isTerminal && KANBAN_COLUMNS.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
  </select>

  const actions = <>
    <button className={styles.artifactToolButton} type="button" disabled={busy === 'idea_review'} onClick={() => void runAi()}>{busy === 'idea_review' ? 'Разбираем…' : '✦ Подсказка'}</button>
    <div className={styles.artifactFooterRight}>
      {draft.status === 'archived' && <button className={styles.artifactToolButton} type="button" onClick={() => { const saved = onSave(draft, false); onRestore(saved.id) }}>Вернуть</button>}
      {!isTerminal && <button className={styles.artifactToolButton} type="button" disabled={!draft.title.trim()} onClick={() => { if (window.confirm('Превратить идею в win?')) onPromote(draft) }}>Win!</button>}
      <button className={styles.artifactSaveButton} type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Готово</button>
    </div>
  </>

  return <ArtifactEditorShell label="Идея" meta={statusControl} onClose={onClose} actions={actions} isDirty={JSON.stringify(draft) !== JSON.stringify(initial)}>
    <div className={styles.artifactTextFields}>
      <input className={styles.artifactTitleEditor} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Название идеи" aria-label="Название идеи" autoFocus />
      <textarea className={styles.artifactMainEditor} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="Смысл идеи — что хочется проверить или изменить?" aria-label="Смысл идеи" />
    </div>

    {error && <p className={styles.aiError}>{error}</p>}
    {guidance && <AiGuidancePanel guidance={guidance} compact />}

    <details className={styles.artifactDetails}>
      <summary>Детали</summary>
      <div className={styles.artifactDetailsContent}>
        <section className={styles.artifactHint}>
          <div className={styles.levelSignalRow}>
            <div className={styles.levelSignalLabel}>
              <span>Карьерный сигнал</span>
              <strong>{levelLabels[inferred.level]}</strong>
            </div>
            {isLevelSignalConfirmed
              ? <span className={styles.levelSignalConfirmedBadge} title="Вы подтвердили этот уровень">✓ Подтверждено</span>
              : <button type="button" className={styles.levelSignalConfirmButton} onClick={confirmLevelSignal}>Подтвердить</button>}
          </div>
          <p>{inferred.reason}</p>
          {!isLevelSignalConfirmed && <p className={styles.levelSignalHintNote}>Это предположение Эскады по тексту записи, а не подтверждённая оценка.</p>}
          {currentExpectations.length > 0 && <details><summary>Ожидания текущего уровня</summary><ul>{currentExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}
          {target && nextExpectations.length > 0 && <details><summary>Как усилить до «{levelLabels[target]}»</summary><ul>{nextExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}
        </section>

        <section className={styles.artifactSubsection}>
          <strong>Компетенции</strong>
          <div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={draft.competencyIds.includes(competency.id) ? styles.choiceActive : ''} onClick={() => toggleCompetency(competency.id)}>{competency.shortTitle}</button>)}</div>
          {selectedCompetencies.length > 0 && <div className={styles.competencySummaries}>{selectedCompetencies.map((id) => { const competency = competencyById(id); return competency ? <p key={competency.id}><strong>{competency.shortTitle}.</strong> {competency.summary}</p> : null })}</div>}
        </section>

        <section className={styles.artifactSubsection}>
          <strong>Рабочие заметки</strong>
          <div className={styles.addInline}><input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Решение, наблюдение, обратная связь…" /><button type="button" onClick={addNote}>Добавить</button></div>
          <div className={styles.notesTimeline}>{draft.notes.map((note) => <article key={note.id}><span>{formatDate(note.createdAt.slice(0, 10))}</span><p>{note.text}</p></article>)}</div>
        </section>

        <section className={styles.artifactSubsection}>
          <strong>Доказательства</strong>
          <div className={styles.addInline}><input value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} placeholder="Ссылка, артефакт, отзыв, метрика…" /><button type="button" onClick={addEvidence}>Добавить</button></div>
          <div className={styles.evidenceList}>{draft.evidenceNotes.map((item) => <article key={item.id}><span>◆</span><p>{item.text}</p></article>)}</div>
        </section>

        {draft.status === 'won' && <p className={styles.artifactTerminalNote}>Эта идея уже оформлена как win.</p>}
      </div>
    </details>
  </ArtifactEditorShell>
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

  const actions = <>
    <button className={styles.artifactToolButton} type="button" disabled={busy === 'win_rewrite'} onClick={() => void runAi()}>{busy === 'win_rewrite' ? 'Усиливаем…' : '✦ Усилить'}</button>
    <button className={styles.artifactSaveButton} type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Готово</button>
  </>

  return <ArtifactEditorShell label="Win" onClose={onClose} actions={actions} isDirty={JSON.stringify(draft) !== JSON.stringify(initial)}>
    {draft.sourceContext && <div className={styles.artifactSourceLine}><span>Из идеи</span><p>{draft.sourceContext}</p></div>}

    <div className={styles.artifactTextFields}>
      <input className={styles.artifactTitleEditor} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Что произошло?" aria-label="Что произошло" autoFocus required />
      <textarea className={styles.artifactMainEditor} value={draft.impact} onChange={(event) => setDraft({ ...draft, impact: event.target.value })} placeholder="Почему это важно?" aria-label="Почему это важно" />
      <textarea className={styles.artifactMainEditor} value={draft.evidence} onChange={(event) => setDraft({ ...draft, evidence: event.target.value })} placeholder="Чем это подтверждается?" aria-label="Чем это подтверждается" />
    </div>

    {error && <p className={styles.aiError}>{error}</p>}
    {guidance && <AiGuidancePanel guidance={guidance} compact onApplyRewrite={guidance.rewrite ? () => setDraft((current) => ({ ...current, ...nonEmptyFields(guidance.rewrite) })) : undefined} />}

    <details className={styles.artifactDetails}>
      <summary>Детали</summary>
      <div className={styles.artifactDetailsContent}>
        <div className={styles.artifactMiniGrid}>
          <label>Изменение в цифрах<input value={draft.metrics} onChange={(event) => setDraft({ ...draft, metrics: event.target.value })} placeholder="Только реальные значения" /></label>
          <label>Кто подтвердил<input value={draft.confirmedBy} onChange={(event) => setDraft({ ...draft, confirmedBy: event.target.value })} placeholder="Если это было" /></label>
          <label>Дата<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
          <label className={styles.artifactCheckbox}><input type="checkbox" checked={draft.reportReady} onChange={(event) => setDraft({ ...draft, reportReady: event.target.checked })} /><span>Предлагать для отчётов</span></label>
        </div>

        <section className={styles.artifactSubsection}>
          <strong>Компетенции</strong>
          <div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={winSelectedCompetencies.includes(competency.id) ? styles.choiceActive : ''} onClick={() => setDraft({ ...draft, competencyIds: draft.competencyIds.includes(competency.id) ? draft.competencyIds.filter((item) => item !== competency.id) : [...winSelectedCompetencies, competency.id] })}>{competency.shortTitle}</button>)}</div>
        </section>

        {gaps.length > 0 && <section className={styles.artifactHint}><span>Что можно усилить</span><ul>{gaps.map((item) => <li key={item}>{item}</li>)}</ul></section>}

        {(winCurrentExpectations.length > 0 || winNextExpectations.length > 0) && <section className={styles.artifactHint}>
          <span>Шкала компетенций</span>
          {winCurrentExpectations.length > 0 && <details><summary>Ожидания текущего уровня</summary><ul>{winCurrentExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}
          {winTargetLevel && winNextExpectations.length > 0 && <details><summary>Как усилить до «{levelLabels[winTargetLevel]}»</summary><ul>{winNextExpectations.map((item) => <li key={item.id}>{item.text}</li>)}</ul></details>}
        </section>}

        {draft.id && <button className={styles.artifactDeleteButton} type="button" onClick={() => { if (window.confirm(`Удалить win «${draft.title || 'без названия'}»? Это действие необратимо.`)) onDelete(draft.id as string) }}>Удалить win</button>}
      </div>
    </details>
  </ArtifactEditorShell>
}

function AiGuidancePanel({ guidance, compact = false, onSaveNextStep, onApplyRewrite }: { guidance: AiResponse; compact?: boolean; onSaveNextStep?: () => void; onApplyRewrite?: () => void }) {
  return <section className={`${styles.aiResult} ${compact ? styles.aiResultCompact : ''}`}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Подсказка Эскады</span><h3>{guidance.headline}</h3></div></div><div className={styles.aiResultGrid}><div><strong>Что уже хорошо</strong>{guidance.strengths.length ? guidance.strengths.map((item) => <p key={`${item.criterionId}-${item.text}`}>{item.text}</p>) : <p>Недостаточно оснований для уверенного вывода.</p>}</div><div><strong>Как превысить ожидания</strong>{guidance.stretch.length ? guidance.stretch.map((item) => <p key={`${item.criterionId}-${item.text}`}>{item.text}</p>) : <p>Шкала не даёт дополнительного вывода по этой записи.</p>}</div><div><strong>Что сохранить как доказательство</strong>{guidance.evidence.map((item) => <p key={item}>{item}</p>)}</div><div><strong>Следующий шаг</strong><p>{guidance.nextStep || 'Следующий шаг не предложен: в записи недостаточно контекста.'}</p>{onSaveNextStep && guidance.nextStep && <button type="button" onClick={onSaveNextStep}>Сохранить как следующий шаг</button>}{onApplyRewrite && <button type="button" onClick={onApplyRewrite}>Применить формулировку</button>}</div></div><details className={styles.aiSources}><summary>Почему Эскада так решила?</summary>{guidance.sources.slice(0, 8).map((source) => <article key={source.id}><strong>{source.competencyTitle} · {levelLabels[source.level]}</strong><p>{source.text}</p><small>Шкала компетенций, стр. {source.sourcePage}</small></article>)}</details><small className={styles.aiCaveat}>{guidance.caveat}</small></section>
}

function ProfileModal({ profile: initial, onClose, onSave, onExport, onImport }: { profile: Profile; onClose: () => void; onSave: (profile: Profile) => void; onExport: () => void; onImport: () => void }) {
  const [profile, setProfile] = useState(initial)
  return <Modal title="Профиль" subtitle="Уровень определяет ожидания шкалы; рынок и отчётный цикл помогают сохранять рабочий контекст." onClose={onClose} isDirty={JSON.stringify(profile) !== JSON.stringify(initial)}><form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); onSave(profile) }}><label className={styles.field}>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label className={styles.field}>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}>Рынок или команда<input value={profile.market} onChange={(event) => setProfile({ ...profile, market: event.target.value })} /></label><section className={styles.profileCycleBox}><div><strong>Отчётный цикл</strong><span>Используется только для периода в «Отчётах». Это не дедлайн и не автоматический review.</span></div><div className={styles.formGrid}><label className={styles.field}>Ритм<select value={profile.reportingRhythm} onChange={(event) => setProfile({ ...profile, reportingRhythm: event.target.value as Profile['reportingRhythm'] })}>{Object.entries(reportingRhythmLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}>Конец текущего цикла<input type="date" value={profile.cycleEnd} onChange={(event) => setProfile({ ...profile, cycleEnd: event.target.value })} /></label></div></section><div className={styles.optionalBlock}><div><strong>Локальные данные</strong><span>Экспортируйте резервную копию или импортируйте её на другом устройстве.</span></div><div className={styles.buttonRow}><button type="button" className={styles.secondaryButton} onClick={onExport}>Экспорт</button><button type="button" className={styles.secondaryButton} onClick={onImport}>Импорт</button></div></div><div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button><button className={styles.primaryButton} type="submit">Сохранить</button></div></form></Modal>
}

// v41: `isDirty`, when true, makes Escape and backdrop-click confirm before
// closing instead of discarding input silently. Omitted/false preserves the
// previous immediate-close behavior (used by dialogs with nothing to lose,
// e.g. read-only overlays). See Fable roadmap Patch F (P1-6).
function useDialogBehavior(onClose: () => void, isDirty = false) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isDirty && !window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return
      onClose()
    }
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handler)
    }
  }, [onClose, isDirty])
}

function Modal({ title, subtitle, onClose, children, wide = false, isDirty = false }: { title: string; subtitle: string; onClose: () => void; children: ReactNode; wide?: boolean; isDirty?: boolean }) {
  useDialogBehavior(onClose, isDirty)
  function confirmedClose() {
    if (isDirty && !window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return
    onClose()
  }
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) confirmedClose() }}><section className={`${styles.compactCard} ${wide ? styles.modalWide : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className={styles.modalHeader}><div><span className={styles.eyebrow}>Эскада</span><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" aria-label="Закрыть" onClick={confirmedClose}>×</button></div><div className={styles.compactCardBody}>{children}</div></section></div>
}

function ArtifactEditorShell({ label, meta, onClose, children, actions, isDirty = false }: { label: string; meta?: ReactNode; onClose: () => void; children: ReactNode; actions: ReactNode; isDirty?: boolean }) {
  useDialogBehavior(onClose, isDirty)
  function confirmedClose() {
    if (isDirty && !window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return
    onClose()
  }
  return <div className={`${styles.modalBackdrop} ${styles.artifactEditorBackdrop}`} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) confirmedClose() }}>
    <section className={`${styles.compactCard} ${styles.artifactEditorCard}`} role="dialog" aria-modal="true" aria-label={label}>
      <header className={styles.artifactEditorHeader}>
        <div className={styles.artifactEditorIdentity}><strong>{label}</strong>{meta}</div>
        <button className={styles.artifactEditorClose} type="button" aria-label="Закрыть" onClick={confirmedClose}>×</button>
      </header>
      <div className={styles.artifactEditorBody}>{children}</div>
      <footer className={styles.artifactEditorFooter}>{actions}</footer>
    </section>
  </div>
}

function Onboarding({ initial, onComplete, onDemo }: { initial: Profile; onComplete: (profile: Profile) => void; onDemo: () => void }) {
  const [profile, setProfile] = useState(initial)
  return <div className={styles.onboardingBackdrop}><section className={styles.onboarding}><div className={styles.onboardingVisual}><span className={styles.brandMark}><LadderLogo /></span><p>Эскада</p><h1>Записал.<br />Развил.<br />Подтвердил.</h1><div className={styles.onboardingFlow}><span>Мысль</span><i>→</i><span>Win</span><i>→</i><span>Рост</span></div></div><form onSubmit={(event) => { event.preventDefault(); onComplete(profile) }}><span className={styles.eyebrow}>Настройка за минуту</span><h2>Добавьте рабочий контекст</h2><p>Уровень определяет ожидания и рекомендации Эскады. Рынок помогает сохранить рабочий контекст; отчётный цикл можно настроить позже в профиле.</p><label>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label>Уровень по шкале<select value={profile.currentLevel} onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LevelKey })}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Рынок или команда<input value={profile.market} onChange={(event) => setProfile({ ...profile, market: event.target.value })} /></label><button className={styles.primaryButton} type="submit">Начать работу</button><button className={styles.textButton} type="button" onClick={onDemo}>Посмотреть с демо-данными</button></form></section></div>
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className={styles.emptyState}><span>＋</span><h3>{title}</h3><p>{text}</p><button type="button" onClick={onAction}>{action}</button></div>
}
