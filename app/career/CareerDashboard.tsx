'use client'

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import styles from './career.module.css'
import {
  Competency,
  competencies,
  competencyKeywords,
  levelLabels,
  reflectionPrompts,
} from './career-data'
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  buildReportMarkdown,
  computeInsights,
  createDefaultState,
  createId,
  demoState,
  migrateState,
  promoteIdeaToWin,
  selectWinsForPeriod,
  suggestCompetencyIds,
  todayIso,
} from './career-core.mjs'

type View = 'today' | 'ideas' | 'wins' | 'reports' | 'competencies' | 'settings'
type IdeaStatus = 'inbox' | 'exploring' | 'won' | 'archived'
type ReportingRhythm = 'monthly' | 'quarterly' | 'half-year'

interface Profile {
  name: string
  role: string
  market: string
  reportingRhythm: ReportingRhythm
  cycleEnd: string
}

interface Idea {
  id: string
  title: string
  details: string
  nextStep: string
  status: IdeaStatus
  competencyIds: string[]
  createdAt: string
  updatedAt: string
}

interface Win {
  id: string
  title: string
  impact: string
  evidence: string
  competencyIds: string[]
  sourceIdeaId: string | null
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

interface IdeaDraft {
  id?: string
  title: string
  details: string
  nextStep: string
  status: IdeaStatus
  competencyIds: string[]
}

interface WinDraft {
  id?: string
  sourceIdeaId: string | null
  title: string
  impact: string
  evidence: string
  date: string
  competencyIds: string[]
  reportReady: boolean
}

const navItems: Array<{ id: View; label: string; caption: string; icon: string }> = [
  { id: 'today', label: 'Сегодня', caption: 'Фокус и быстрый захват', icon: '◉' },
  { id: 'ideas', label: 'Идеи', caption: 'Рабочая память', icon: '✦' },
  { id: 'wins', label: 'Wins', caption: 'Результаты и доказательства', icon: '◆' },
  { id: 'reports', label: 'Отчёты', caption: 'Готовый карьерный нарратив', icon: '▤' },
  { id: 'competencies', label: 'Компетенции', caption: 'Подсказки, не чеклист', icon: '⌁' },
  { id: 'settings', label: 'Настройки', caption: 'Профиль и данные', icon: '⚙' },
]

const statusLabels: Record<IdeaStatus, string> = {
  inbox: 'Входящие',
  exploring: 'В работе',
  won: 'Стала win',
  archived: 'Архив',
}

const emptyIdea: IdeaDraft = {
  title: '',
  details: '',
  nextStep: '',
  status: 'inbox',
  competencyIds: [],
}

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

export default function CareerDashboard() {
  const [view, setView] = useState<View>('today')
  const [state, setState] = useState<CareerState>(() => asCareerState(createDefaultState()))
  const [hydrated, setHydrated] = useState(false)
  const [quickIdea, setQuickIdea] = useState('')
  const [ideaDraft, setIdeaDraft] = useState<IdeaDraft | null>(null)
  const [winDraft, setWinDraft] = useState<WinDraft | null>(null)
  const [notice, setNotice] = useState('')
  const [ideaFilter, setIdeaFilter] = useState<'all' | IdeaStatus>('all')
  const [competencyQuery, setCompetencyQuery] = useState('')
  const [competencyDomain, setCompetencyDomain] = useState<'all' | Competency['domain']>('all')
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null)
  const [periodStart, setPeriodStart] = useState(dateDaysAgo(90))
  const [periodEnd, setPeriodEnd] = useState(todayIso())
  const [selectedWinIds, setSelectedWinIds] = useState<string[]>([])
  const [nextFocus, setNextFocus] = useState('')
  const [reportText, setReportText] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const current = safeJsonParse(window.localStorage.getItem(STORAGE_KEY))
    const legacy = safeJsonParse(window.localStorage.getItem(LEGACY_STORAGE_KEY))
    const loaded = asCareerState(migrateState(current ?? legacy ?? null, createDefaultState()))
    setState(loaded)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [hydrated, state])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const insights = useMemo(() => computeInsights(state), [state])
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
  const prompt = reflectionPrompts[(state.ideas.length + state.wins.length) % reflectionPrompts.length]

  function updateState(updater: (current: CareerState) => CareerState) {
    setState((current) => updater(current))
  }

  function completeOnboarding(profile: Profile) {
    updateState((current) => ({ ...current, onboardingComplete: true, profile }))
    setNotice('Рабочее пространство готово')
  }

  function openDemo() {
    setState(asCareerState(demoState()))
    setNotice('Демо-данные загружены')
  }

  function submitQuickIdea(event: FormEvent) {
    event.preventDefault()
    const title = quickIdea.trim()
    if (!title) return
    const now = new Date().toISOString()
    const suggested = suggestCompetencyIds(title, competencies, competencyKeywords)
    const idea: Idea = {
      id: createId('idea'),
      title,
      details: '',
      nextStep: '',
      status: 'inbox',
      competencyIds: suggested,
      createdAt: now,
      updatedAt: now,
    }
    updateState((current) => ({ ...current, ideas: [idea, ...current.ideas] }))
    setQuickIdea('')
    setNotice('Идея сохранена. Детали можно добавить позже.')
  }

  function saveIdea(draft: IdeaDraft) {
    const now = new Date().toISOString()
    const competencyIds = draft.competencyIds.length
      ? draft.competencyIds
      : suggestCompetencyIds(`${draft.title} ${draft.details}`, competencies, competencyKeywords)

    updateState((current) => {
      if (draft.id) {
        return {
          ...current,
          ideas: current.ideas.map((idea) => idea.id === draft.id
            ? { ...idea, ...draft, competencyIds, updatedAt: now }
            : idea),
        }
      }
      const idea: Idea = {
        ...draft,
        id: createId('idea'),
        competencyIds,
        createdAt: now,
        updatedAt: now,
      }
      return { ...current, ideas: [idea, ...current.ideas] }
    })
    setIdeaDraft(null)
    setNotice(draft.id ? 'Идея обновлена' : 'Идея добавлена')
  }

  function changeIdeaStatus(id: string, status: IdeaStatus) {
    updateState((current) => ({
      ...current,
      ideas: current.ideas.map((idea) => idea.id === id ? { ...idea, status, updatedAt: new Date().toISOString() } : idea),
    }))
  }

  function removeIdea(id: string) {
    if (!window.confirm('Удалить идею?')) return
    updateState((current) => ({ ...current, ideas: current.ideas.filter((idea) => idea.id !== id) }))
  }

  function startWinFromIdea(idea: Idea) {
    const promoted = promoteIdeaToWin(idea as unknown as Record<string, unknown>, { date: todayIso() }) as unknown as Win
    setWinDraft({
      sourceIdeaId: idea.id,
      title: promoted.title,
      impact: '',
      evidence: '',
      date: promoted.date,
      competencyIds: promoted.competencyIds,
      reportReady: true,
    })
  }

  function saveWin(draft: WinDraft) {
    const now = new Date().toISOString()
    updateState((current) => {
      const nextWins = draft.id
        ? current.wins.map((win) => win.id === draft.id ? { ...win, ...draft } : win)
        : [{ ...draft, id: createId('win'), createdAt: now }, ...current.wins]
      const nextIdeas = draft.sourceIdeaId
        ? current.ideas.map((idea) => idea.id === draft.sourceIdeaId
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
      competencies,
      periodLabel,
      nextFocus,
    })
    setReportText(content)
    setNotice('Черновик отчёта собран из выбранных wins')
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
    anchor.download = `career-report-${periodStart}-${periodEnd}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `career-os-backup-${todayIso()}.json`
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
    if (!window.confirm('Удалить локальные данные Career OS на этом устройстве?')) return
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    setState(asCareerState(createDefaultState()))
    setView('today')
    setNotice('Рабочее пространство очищено')
  }

  function createIdeaFromCompetency(competency: Competency) {
    setIdeaDraft({
      ...emptyIdea,
      title: `Идея для развития: ${competency.shortTitle}`,
      details: `Какое реальное действие или эксперимент поможет проявить эту компетенцию в моей текущей работе?`,
      competencyIds: [competency.id],
    })
  }

  if (!hydrated) {
    return <main className={styles.loading}>Загружаем Career OS…</main>
  }

  return (
    <main className={styles.shell} data-patch="career-os-product-v4">
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>C</span>
          <div><strong>Career OS</strong><small>Ideas → Wins → Reports</small></div>
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
          <span>Цикл развития</span>
          <strong>{state.profile.cycleEnd ? `до ${formatDate(state.profile.cycleEnd)}` : 'Без жёсткого дедлайна'}</strong>
          <p>Компетенции помогают осмыслить опыт, но не ограничивают его.</p>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>Персональная рабочая память</p>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className={styles.profileChip}>
            <span>{state.profile.name.slice(0, 1) || 'C'}</span>
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
            prompt={prompt}
            onOpenIdea={() => setIdeaDraft({ ...emptyIdea })}
            onOpenWin={() => setWinDraft({ sourceIdeaId: null, title: '', impact: '', evidence: '', date: todayIso(), competencyIds: [], reportReady: true })}
            onEditIdea={(idea) => setIdeaDraft({ ...idea })}
            onPromote={startWinFromIdea}
            onView={setView}
          />
        )}

        {view === 'ideas' && (
          <IdeasView
            ideas={filteredIdeas}
            filter={ideaFilter}
            onFilter={setIdeaFilter}
            onNew={() => setIdeaDraft({ ...emptyIdea })}
            onEdit={(idea) => setIdeaDraft({ ...idea })}
            onStatus={changeIdeaStatus}
            onPromote={startWinFromIdea}
            onRemove={removeIdea}
          />
        )}

        {view === 'wins' && (
          <WinsView
            wins={state.wins}
            onNew={() => setWinDraft({ sourceIdeaId: null, title: '', impact: '', evidence: '', date: todayIso(), competencyIds: [], reportReady: true })}
            onEdit={(win) => setWinDraft({ ...win })}
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
            query={competencyQuery}
            domain={competencyDomain}
            expanded={expandedCompetency}
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
        <Onboarding
          initial={state.profile}
          onComplete={completeOnboarding}
          onDemo={openDemo}
        />
      )}

      {ideaDraft && (
        <IdeaModal
          draft={ideaDraft}
          onClose={() => setIdeaDraft(null)}
          onSave={saveIdea}
        />
      )}

      {winDraft && (
        <WinModal
          draft={winDraft}
          onClose={() => setWinDraft(null)}
          onSave={saveWin}
        />
      )}

      <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json" onChange={importData} />
      {notice && <div className={styles.toast} role="status">{notice}</div>}
    </main>
  )
}

function TodayView({
  quickIdea,
  onQuickIdea,
  onSubmitQuickIdea,
  insights,
  activeIdeas,
  recentWins,
  prompt,
  onOpenIdea,
  onOpenWin,
  onEditIdea,
  onPromote,
  onView,
}: {
  quickIdea: string
  onQuickIdea: (value: string) => void
  onSubmitQuickIdea: (event: FormEvent) => void
  insights: ReturnType<typeof computeInsights>
  activeIdeas: Idea[]
  recentWins: Win[]
  prompt: string
  onOpenIdea: () => void
  onOpenWin: () => void
  onEditIdea: (idea: Idea) => void
  onPromote: (idea: Idea) => void
  onView: (view: View) => void
}) {
  return (
    <div className={styles.pageStack}>
      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <span className={styles.pill}>10-секундный захват</span>
          <h2>Не потеряйте мысль, которая может стать результатом.</h2>
          <p>Сначала запишите идею. Связь с компетенциями и доказательства можно добавить позже.</p>
        </div>
        <form className={styles.quickCapture} onSubmit={onSubmitQuickIdea}>
          <input value={quickIdea} onChange={(event) => onQuickIdea(event.target.value)} placeholder="Например: проверить новый PR-угол на собственных данных…" aria-label="Новая идея" />
          <button type="submit">Сохранить идею</button>
        </form>
        <button className={styles.textButton} type="button" onClick={onOpenIdea}>Добавить детали сразу</button>
      </section>

      <section className={styles.flowGrid} aria-label="Путь от идеи до отчёта">
        <FlowStep number="01" label="Идеи" value={insights.activeIdeas} caption="в активной памяти" onClick={() => onView('ideas')} />
        <FlowArrow />
        <FlowStep number="02" label="Wins" value={insights.wins} caption={`${insights.reportReadyWins} готовы к отчёту`} onClick={() => onView('wins')} />
        <FlowArrow />
        <FlowStep number="03" label="Отчёты" value={insights.reports} caption="сохранённых версий" onClick={() => onView('reports')} />
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
                  <span className={styles.statusBadge} data-status={idea.status}>{statusLabels[idea.status]}</span>
                  <h4>{idea.title}</h4>
                  {idea.nextStep && <p>Следующий шаг: {idea.nextStep}</p>}
                  <CompetencyChips ids={idea.competencyIds} />
                </div>
                <div className={styles.compactActions}>
                  <button type="button" onClick={() => onEditIdea(idea)}>Открыть</button>
                  <button type="button" onClick={() => onPromote(idea)}>Это уже win</button>
                </div>
              </article>
            )) : <EmptyState title="Пока нет идей" text="Запишите первую мысль в поле выше. Никаких обязательных полей кроме названия." action="Добавить идею" onAction={onOpenIdea} />}
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
                <span>{formatDate(win.date)}</span>
                <h4>{win.title}</h4>
                <p>{win.impact || 'Добавьте влияние, когда оно станет понятным.'}</p>
                <CompetencyChips ids={win.competencyIds} />
              </article>
            )) : <EmptyState title="Wins ещё не зафиксированы" text="Win — это не просто завершённая задача, а изменение с понятным влиянием или доказательством." action="Добавить win" onAction={onOpenWin} />}
          </div>
        </section>
      </div>

      <section className={styles.promptCard}>
        <div><span className={styles.pill}>Подсказка для рефлексии</span><h3>{prompt}</h3></div>
        <button type="button" onClick={onOpenIdea}>Записать мысль</button>
      </section>
    </div>
  )
}

function FlowStep({ number, label, value, caption, onClick }: { number: string; label: string; value: number; caption: string; onClick: () => void }) {
  return <button className={styles.flowStep} type="button" onClick={onClick}><span>{number}</span><strong>{value}</strong><h3>{label}</h3><small>{caption}</small></button>
}

function FlowArrow() {
  return <div className={styles.flowArrow} aria-hidden="true">→</div>
}

function IdeasView({ ideas, filter, onFilter, onNew, onEdit, onStatus, onPromote, onRemove }: {
  ideas: Idea[]
  filter: 'all' | IdeaStatus
  onFilter: (value: 'all' | IdeaStatus) => void
  onNew: () => void
  onEdit: (idea: Idea) => void
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
        <div><span className={styles.eyebrow}>Capture first, structure later</span><h2>Идеи — не задачи и не обязательства.</h2><p>Это пространство для наблюдений, гипотез и возможностей. Решение о действии можно принять позже.</p></div>
        <button className={styles.primaryButton} type="button" onClick={onNew}>+ Новая идея</button>
      </section>
      <div className={styles.filterBar}>
        {filters.map((item) => <button key={item.value} type="button" className={filter === item.value ? styles.filterActive : ''} onClick={() => onFilter(item.value)}>{item.label}</button>)}
      </div>
      <section className={styles.ideaGrid}>
        {ideas.length ? ideas.map((idea) => (
          <article className={styles.ideaCard} key={idea.id}>
            <div className={styles.cardTopline}>
              <span className={styles.statusBadge} data-status={idea.status}>{statusLabels[idea.status]}</span>
              <span>{formatDate(idea.createdAt.slice(0, 10))}</span>
            </div>
            <h3>{idea.title}</h3>
            <p>{idea.details || 'Детали можно добавить, когда идея станет важнее.'}</p>
            {idea.nextStep && <div className={styles.nextStep}><span>Следующий шаг</span><strong>{idea.nextStep}</strong></div>}
            <CompetencyChips ids={idea.competencyIds} />
            <div className={styles.cardActions}>
              <select value={idea.status} onChange={(event) => onStatus(idea.id, event.target.value as IdeaStatus)} aria-label="Статус идеи">
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" onClick={() => onEdit(idea)}>Изменить</button>
              {idea.status !== 'won' && <button className={styles.accentAction} type="button" onClick={() => onPromote(idea)}>Оформить win</button>}
              <button className={styles.dangerText} type="button" onClick={() => onRemove(idea.id)}>Удалить</button>
            </div>
          </article>
        )) : <EmptyState title="В этом разделе пока пусто" text="Измените фильтр или добавьте новую идею." action="Добавить идею" onAction={onNew} />}
      </section>
    </div>
  )
}

function WinsView({ wins, onNew, onEdit, onToggleReport, onRemove, onReports }: {
  wins: Win[]
  onNew: () => void
  onEdit: (win: Win) => void
  onToggleReport: (id: string) => void
  onRemove: (id: string) => void
  onReports: () => void
}) {
  return (
    <div className={styles.pageStack}>
      <section className={styles.pageIntro}>
        <div><span className={styles.eyebrow}>Evidence over memory</span><h2>Wins фиксируют изменение, а не занятость.</h2><p>Хорошая win отвечает на три вопроса: что изменилось, почему это важно и чем это подтверждается.</p></div>
        <div className={styles.buttonRow}><button className={styles.secondaryButton} type="button" onClick={onReports}>Собрать отчёт</button><button className={styles.primaryButton} type="button" onClick={onNew}>+ Добавить win</button></div>
      </section>
      <section className={styles.winTimeline}>
        {wins.length ? [...wins].sort((a, b) => b.date.localeCompare(a.date)).map((win) => (
          <article className={styles.winCard} key={win.id}>
            <div className={styles.winDate}><strong>{new Date(`${win.date}T00:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(new Date(`${win.date}T00:00:00`))}</span></div>
            <div className={styles.winBody}>
              <div className={styles.cardTopline}><span className={styles.pill}>{win.reportReady ? 'Готова к отчёту' : 'Личная заметка'}</span>{win.sourceIdeaId && <span>Из идеи</span>}</div>
              <h3>{win.title}</h3>
              <div className={styles.winDetails}><div><span>Влияние</span><p>{win.impact || 'Пока не описано'}</p></div><div><span>Доказательство</span><p>{win.evidence || 'Пока не добавлено'}</p></div></div>
              <CompetencyChips ids={win.competencyIds} />
              <div className={styles.cardActions}>
                <button type="button" onClick={() => onEdit(win)}>Изменить</button>
                <button type="button" onClick={() => onToggleReport(win.id)}>{win.reportReady ? 'Не включать автоматически' : 'Добавлять в отчёты'}</button>
                <button className={styles.dangerText} type="button" onClick={() => onRemove(win.id)}>Удалить</button>
              </div>
            </div>
          </article>
        )) : <EmptyState title="Пока нет wins" text="Можно оформить win из идеи или записать достижение напрямую." action="Добавить win" onAction={onNew} />}
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
      <section className={styles.pageIntro}>
        <div><span className={styles.eyebrow}>From evidence to narrative</span><h2>Соберите отчёт без попыток вспомнить весь период.</h2><p>Выберите wins, проверьте факты и отредактируйте готовый текст под менеджера, review или promotion case.</p></div>
      </section>
      <div className={styles.reportLayout}>
        <section className={styles.panel}>
          <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Шаг 1</span><h3>Период и wins</h3></div><button className={styles.secondaryButton} type="button" onClick={onSelectAll}>Выбрать все</button></div>
          <div className={styles.dateGrid}><label>Начало<input type="date" value={periodStart} onChange={(event) => onPeriodStart(event.target.value)} /></label><label>Конец<input type="date" value={periodEnd} onChange={(event) => onPeriodEnd(event.target.value)} /></label></div>
          <div className={styles.reportWins}>
            {winsInPeriod.length ? winsInPeriod.map((win) => (
              <label className={styles.reportWin} key={win.id}>
                <input type="checkbox" checked={selectedWinIds.includes(win.id)} onChange={() => onSelectWin(win.id)} />
                <span><strong>{win.title}</strong><small>{formatDate(win.date)} · {win.impact || 'влияние не описано'}</small></span>
              </label>
            )) : <p className={styles.muted}>За выбранный период нет wins, отмеченных для отчёта.</p>}
          </div>
          <label className={styles.field}>Следующий фокус<textarea value={nextFocus} onChange={(event) => onNextFocus(event.target.value)} placeholder="Что вы хотите развить или проверить в следующем цикле?" /></label>
          <button className={styles.primaryButton} type="button" onClick={onGenerate} disabled={!selectedWinIds.length}>Собрать черновик</button>
        </section>
        <section className={styles.reportEditor}>
          <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Шаг 2</span><h3>Редактор отчёта</h3></div><span className={styles.autosaveLabel}>Редактируется локально</span></div>
          <textarea value={reportText} onChange={(event) => onReportText(event.target.value)} placeholder="Выберите wins и нажмите «Собрать черновик»." />
          <div className={styles.buttonRow}><button className={styles.primaryButton} type="button" onClick={onSave} disabled={!reportText}>Сохранить версию</button><button className={styles.secondaryButton} type="button" onClick={onCopy} disabled={!reportText}>Копировать</button><button className={styles.secondaryButton} type="button" onClick={onDownload} disabled={!reportText}>Скачать .md</button></div>
        </section>
      </div>
      {reports.length > 0 && <section className={styles.panel}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>История</span><h3>Сохранённые версии</h3></div></div><div className={styles.savedReports}>{reports.map((report) => <article key={report.id}><strong>{report.title}</strong><span>{formatDate(report.createdAt.slice(0, 10))} · {report.winIds.length} wins</span></article>)}</div></section>}
    </div>
  )
}

function CompetenciesView({ competencies: items, query, domain, expanded, onQuery, onDomain, onExpand, onCreateIdea }: {
  competencies: Competency[]
  query: string
  domain: 'all' | Competency['domain']
  expanded: string | null
  onQuery: (value: string) => void
  onDomain: (value: 'all' | Competency['domain']) => void
  onExpand: (id: string) => void
  onCreateIdea: (competency: Competency) => void
}) {
  return (
    <div className={styles.pageStack}>
      <section className={styles.guidanceBanner}>
        <span className={styles.pill}>Важно</span>
        <h2>Шкала компетенций — это язык для осмысления опыта, а не чеклист допуска.</h2>
        <p>Смотрите примеры поведения, когда ищете идею, описываете win или объясняете рост. Не нужно отмечать каждый пункт и доказывать соответствие всем формулировкам.</p>
      </section>
      <div className={styles.competencyToolbar}>
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Найти компетенцию или сигнал…" />
        <div className={styles.filterBar}>{[
          ['all', 'Все'], ['strategy', 'Стратегия'], ['craft', 'Профессиональные'], ['leadership', 'Лидерство'],
        ].map(([value, label]) => <button key={value} type="button" className={domain === value ? styles.filterActive : ''} onClick={() => onDomain(value as 'all' | Competency['domain'])}>{label}</button>)}</div>
      </div>
      <section className={styles.competencyGrid}>
        {items.map((competency, index) => (
          <article className={styles.competencyCard} key={competency.id}>
            <div className={styles.competencyNumber}>{String(index + 1).padStart(2, '0')}</div>
            <span className={styles.domainBadge}>{competency.domain === 'craft' ? 'Профессиональная' : competency.domain === 'strategy' ? 'Стратегическая' : 'Лидерская'}</span>
            <h3>{competency.title}</h3>
            <p>{competency.summary}</p>
            <div className={styles.cardActions}><button type="button" onClick={() => onExpand(competency.id)}>{expanded === competency.id ? 'Скрыть сигналы' : 'Посмотреть сигналы'}</button><button className={styles.accentAction} type="button" onClick={() => onCreateIdea(competency)}>Придумать действие</button></div>
            {expanded === competency.id && <div className={styles.levelSignals}>{(Object.keys(levelLabels) as Array<keyof typeof levelLabels>).map((level) => <section key={level}><h4>{levelLabels[level]}</h4><ul>{competency.levels[level].map((signal) => <li key={signal}>{signal}</li>)}</ul></section>)}</div>}
          </article>
        ))}
      </section>
    </div>
  )
}

function SettingsView({ profile, onProfile, onExport, onImport, onReset }: { profile: Profile; onProfile: (profile: Profile) => void; onExport: () => void; onImport: () => void; onReset: () => void }) {
  const [draft, setDraft] = useState(profile)
  useEffect(() => setDraft(profile), [profile])
  return (
    <div className={styles.settingsGrid}>
      <section className={styles.panel}>
        <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Контекст</span><h3>Профиль сотрудника</h3></div></div>
        <div className={styles.formGrid}><label>Имя<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Роль<input value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} /></label><label>Рынок / команда<input value={draft.market} onChange={(event) => setDraft({ ...draft, market: event.target.value })} /></label><label>Ритм отчёта<select value={draft.reportingRhythm} onChange={(event) => setDraft({ ...draft, reportingRhythm: event.target.value as ReportingRhythm })}><option value="monthly">Ежемесячно</option><option value="quarterly">Ежеквартально</option><option value="half-year">Раз в полгода</option></select></label><label>Конец текущего цикла<input type="date" value={draft.cycleEnd} onChange={(event) => setDraft({ ...draft, cycleEnd: event.target.value })} /></label></div>
        <button className={styles.primaryButton} type="button" onClick={() => onProfile(draft)}>Сохранить профиль</button>
      </section>
      <section className={styles.panel}>
        <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>Privacy-first</span><h3>Локальные данные</h3></div></div>
        <p className={styles.settingsText}>Данные хранятся в localStorage браузера. Это подходит для лёгкой версии на GitHub Pages: нет аккаунтов, сервера и передачи карьерных заметок третьим сторонам.</p>
        <div className={styles.stackButtons}><button className={styles.secondaryButton} type="button" onClick={onExport}>Экспортировать JSON</button><button className={styles.secondaryButton} type="button" onClick={onImport}>Импортировать JSON</button><button className={styles.dangerButton} type="button" onClick={onReset}>Удалить локальные данные</button></div>
      </section>
    </div>
  )
}

function IdeaModal({ draft: initial, onClose, onSave }: { draft: IdeaDraft; onClose: () => void; onSave: (draft: IdeaDraft) => void }) {
  const [draft, setDraft] = useState(initial)
  const suggested = useMemo(() => suggestCompetencyIds(`${draft.title} ${draft.details}`, competencies, competencyKeywords), [draft.details, draft.title])
  function toggleCompetency(id: string) {
    setDraft((current) => ({ ...current, competencyIds: current.competencyIds.includes(id) ? current.competencyIds.filter((item) => item !== id) : [...current.competencyIds, id] }))
  }
  return (
    <Modal title={draft.id ? 'Изменить идею' : 'Новая идея'} subtitle="Минимально достаточно названия. Всё остальное можно добавить позже." onClose={onClose}>
      <form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) onSave({ ...draft, title: draft.title.trim() }) }}>
        <label className={styles.field}>Идея<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Что стоит попробовать, исследовать или изменить?" required /></label>
        <label className={styles.field}>Контекст<textarea value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="Почему это может быть важно? Что вы заметили?" /></label>
        <label className={styles.field}>Следующий шаг<textarea value={draft.nextStep} onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })} placeholder="Один небольшой шаг, если решите продолжать." /></label>
        <label className={styles.field}>Статус<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as IdeaStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className={styles.optionalBlock}><div><strong>Контекст компетенций</strong><span>Необязательно. Система предлагает совпадения по тексту.</span></div><div className={styles.choiceChips}>{competencies.map((competency) => <button type="button" key={competency.id} className={draft.competencyIds.includes(competency.id) ? styles.choiceActive : ''} onClick={() => toggleCompetency(competency.id)}>{competency.shortTitle}</button>)}</div>{suggested.length > 0 && <small>Подсказка: {suggested.map((id) => competencyById(id)?.shortTitle).filter(Boolean).join(', ')}</small>}</div>
        <div className={styles.modalActions}><button className={styles.secondaryButton} type="button" onClick={onClose}>Отмена</button><button className={styles.primaryButton} type="submit">Сохранить идею</button></div>
      </form>
    </Modal>
  )
}

function WinModal({ draft: initial, onClose, onSave }: { draft: WinDraft; onClose: () => void; onSave: (draft: WinDraft) => void }) {
  const [draft, setDraft] = useState(initial)
  function toggleCompetency(id: string) {
    setDraft((current) => ({ ...current, competencyIds: current.competencyIds.includes(id) ? current.competencyIds.filter((item) => item !== id) : [...current.competencyIds, id] }))
  }
  return (
    <Modal title={draft.id ? 'Изменить win' : 'Зафиксировать win'} subtitle="Опишите изменение, влияние и доступное доказательство. Формулировку можно улучшить позже." onClose={onClose}>
      <form className={styles.modalForm} onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) onSave({ ...draft, title: draft.title.trim() }) }}>
        <label className={styles.field}>Что произошло<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Конкретный результат или изменение" required /></label>
        <label className={styles.field}>Почему это важно<textarea value={draft.impact} onChange={(event) => setDraft({ ...draft, impact: event.target.value })} placeholder="Влияние на бизнес, команду, пользователя или процесс" /></label>
        <label className={styles.field}>Чем подтверждается<textarea value={draft.evidence} onChange={(event) => setDraft({ ...draft, evidence: event.target.value })} placeholder="Метрика, ссылка, отзыв, артефакт, согласованное решение" /></label>
        <div className={styles.formGrid}><label>Дата<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label className={styles.checkboxField}><input type="checkbox" checked={draft.reportReady} onChange={(event) => setDraft({ ...draft, reportReady: event.target.checked })} /><span>Предлагать для отчётов</span></label></div>
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
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className={styles.modalHeader}><div><span className={styles.eyebrow}>Career OS</span><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button type="button" aria-label="Закрыть" onClick={onClose}>×</button></div>{children}</section></div>
}

function Onboarding({ initial, onComplete, onDemo }: { initial: Profile; onComplete: (profile: Profile) => void; onDemo: () => void }) {
  const [profile, setProfile] = useState(initial)
  return (
    <div className={styles.onboardingBackdrop}>
      <section className={styles.onboarding}>
        <div className={styles.onboardingVisual}><span className={styles.brandMark}>C</span><p>Career OS</p><h1>Сохраняйте идеи.<br />Доказывайте wins.<br />Собирайте отчёты.</h1><div className={styles.onboardingFlow}><span>Idea</span><i>→</i><span>Win</span><i>→</i><span>Report</span></div></div>
        <form onSubmit={(event) => { event.preventDefault(); onComplete(profile) }}>
          <span className={styles.eyebrow}>Настройка за минуту</span><h2>Добавьте рабочий контекст</h2><p>Шкала компетенций будет подсказывать формулировки, но не станет оценивать вас или навязывать чеклист.</p>
          <label>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Как к вам обращаться" required /></label>
          <label>Текущая роль<input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} required /></label>
          <label>Рынок или команда<input value={profile.market} onChange={(event) => setProfile({ ...profile, market: event.target.value })} placeholder="Например, Бразилия" /></label>
          <label>Основной ритм отчёта<select value={profile.reportingRhythm} onChange={(event) => setProfile({ ...profile, reportingRhythm: event.target.value as ReportingRhythm })}><option value="monthly">Ежемесячно</option><option value="quarterly">Ежеквартально</option><option value="half-year">Раз в полгода</option></select></label>
          <button className={styles.primaryButton} type="submit">Начать работу</button><button className={styles.textButton} type="button" onClick={onDemo}>Посмотреть с демо-данными</button>
        </form>
      </section>
    </div>
  )
}

function CompetencyChips({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return <div className={styles.competencyChips}>{ids.map((id) => <span key={id}>{competencyById(id)?.shortTitle ?? id}</span>)}</div>
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className={styles.emptyState}><span>＋</span><h3>{title}</h3><p>{text}</p><button type="button" onClick={onAction}>{action}</button></div>
}
