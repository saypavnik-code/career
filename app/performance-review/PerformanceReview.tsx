'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Listbox } from '../ui/Listbox'
import { LIMITS, PEER_SECTIONS, REVIEW_VERSION, SELF_REVIEW_VERSION, validateReviewRequest, validateReviewResponse } from './review-contract.mjs'
import type { CompetencyAssessment, ReviewMode, ReviewQuestion, ReviewRequest, ReviewTurn } from './review-contract.mjs'
import { getReviewRubric, isReviewLevel, REVIEW_LEVEL_LABELS } from './review-rubric.mjs'
import type { ReviewLevel } from './review-rubric.mjs'

const STORAGE_KEY = 'escada:performance-review:v1'
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8787/review'
const HISTORY_DATE = new Intl.DateTimeFormat('ru', { dateStyle: 'medium' })
const MODE_LABELS = { self: 'Оценка себя', peer: 'Оценка коллеги' } satisfies Record<ReviewMode, string>
const MODE_DESCRIPTIONS = {
  self: 'Сопоставьте рабочие результаты с ожиданиями для вашего уровня.',
  peer: 'Подготовьте обратную связь на основе ваших наблюдений.',
} satisfies Record<ReviewMode, string>

type Session = {
  id: string
  mode: ReviewMode
  subject: string
  period: string
  points: string[]
  level?: ReviewLevel | null
  assessment?: CompetencyAssessment[]
  turns: ReviewTurn[]
  question: ReviewQuestion | null
  covered: number[]
  missing: number[]
  ready: boolean
  updatedAt: string
  draft: string | null
  diagnostics: string
}

type Shelf = { sessions: Session[]; endpoint: string }
const EMPTY_SHELF: Shelf = { sessions: [], endpoint: '' }

function readShelf(): Shelf {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return EMPTY_SHELF
  const data = JSON.parse(raw) as Shelf
  if (!data || !Array.isArray(data.sessions) || typeof data.endpoint !== 'string' ||
    data.sessions.some((entry) => !entry || typeof entry.id !== 'string' || !Array.isArray(entry.points) ||
      !Array.isArray(entry.turns) || !Array.isArray(entry.covered) || !Array.isArray(entry.missing) ||
      (entry.draft !== null && typeof entry.draft !== 'string') || !Number.isFinite(Date.parse(entry.updatedAt)))) {
    throw new Error('Invalid local review history')
  }
  return data
}

function loadShelf() {
  try {
    return { shelf: readShelf(), error: '' }
  } catch {
    return { shelf: EMPTY_SHELF, error: 'Не удалось прочитать историю. Сохранённые записи не перезаписываются при ошибке.' }
  }
}

function parseEndpoint(value: string) {
  const endpoint = new URL(value.trim())
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && loopback))) {
    throw new Error('Invalid gateway address')
  }
  return endpoint.href
}

function title(session: Session) {
  return session.mode === 'self' ? MODE_LABELS.self : session.subject
}

function parsePoints(value: string) {
  return [...new Set(value.split('\n').map((line) =>
    line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/u, ''),
  ).filter(Boolean))]
}

const ASSESSMENT_LABELS: Record<CompetencyAssessment['status'], string> = {
  evidenced: 'Есть подтверждение',
  insufficient: 'Недостаточно данных',
  not_applicable: 'Вне зоны работы',
}

function LevelSelect({ level, onChange }: { level: ReviewLevel; onChange: (level: ReviewLevel) => void }) {
  return (
    <div className="escada-field">Ваш уровень
      <Listbox label="Ваш уровень" value={level}
        options={(Object.keys(REVIEW_LEVEL_LABELS) as ReviewLevel[]).map((value) => ({ value, label: REVIEW_LEVEL_LABELS[value] }))}
        onChange={onChange} />
    </div>
  )
}

function ReviewRubric({ level, assessment }: { level: ReviewLevel; assessment?: CompetencyAssessment[] }) {
  const { competencies, source } = getReviewRubric(level)
  const findings = new Map(assessment?.map((entry) => [entry.competencyId, entry]))
  return (
    <details className="escada-review-rubric" open={assessment ? true : undefined}>
      <summary>{assessment ? 'Оценка по шкале компетенций' : 'Компетенции выбранного уровня'}</summary>
      {source === 'working_guidance' && <p>Для младшего специалиста используется рабочий ориентир на основе шкалы Digital Marketing.</p>}
      <ul>
        {competencies.map((competency) => {
          const finding = findings.get(competency.id)
          const criteria = finding ? competency.criteria.filter(({ id }) => finding.criterionIds.includes(id)) : competency.criteria
          return (
            <li key={competency.id}>
              <strong>{competency.title}</strong>
              {finding && <><small>{ASSESSMENT_LABELS[finding.status]}</small><p>{finding.note}</p></>}
              {criteria.length > 0 && <ul>{criteria.map((criterion) =>
                <li key={criterion.id}>{criterion.text}{criterion.sourcePage && <small> · стр. {criterion.sourcePage}</small>}</li>
              )}</ul>}
              {finding && finding.turnIds.length > 0 && <small>Ответы интервью № {finding.turnIds.join(', ')}</small>}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

export default function PerformanceReview({ profileLevel }: { profileLevel: ReviewLevel }) {
  const [initial] = useState(loadShelf)
  const [shelf, setShelf] = useState(initial.shelf)
  const [storageError, setStorageError] = useState(initial.error)
  const [sessionId, setSessionId] = useState<string | null>(() => initial.shelf.sessions[0]?.id ?? null)
  const [mode, setMode] = useState<ReviewMode>('self')
  const [subject, setSubject] = useState('')
  const [period, setPeriod] = useState('H2 2026')
  const [pointsText, setPointsText] = useState('')
  const [selectedLevel, setLevel] = useState<ReviewLevel | null>(null)
  const level = selectedLevel ?? profileLevel
  const [endpointText, setEndpointText] = useState(initial.shelf.endpoint || DEFAULT_ENDPOINT)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState<ReviewRequest['action'] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const activeRequest = useRef<AbortController | null>(null)
  const questionHeading = useRef<HTMLHeadingElement>(null)

  const session = shelf.sessions.find((entry) => entry.id === sessionId)
  const activeQuestion = session?.question

  useEffect(() => () => activeRequest.current?.abort(), [])
  useEffect(() => {
    if (activeQuestion) questionHeading.current?.focus({ preventScroll: true })
  }, [activeQuestion])

  function persist(change: (current: Shelf) => Shelf) {
    const fallback = change(shelf)
    try {
      const next = change(readShelf())
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setShelf(next)
      setStorageError('')
    } catch {
      setShelf(fallback)
      setStorageError('Изменения пока в этой вкладке. Скопируйте текст перед её закрытием.')
    }
  }

  function saveSession(entry: Session) {
    persist((current) => ({
      ...current,
      sessions: [entry, ...current.sessions.filter((item) => item.id !== entry.id)],
    }))
  }

  function resetMessages() {
    setError('')
    setNotice('')
  }

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()
    const points = parsePoints(pointsText)
    if (!points.length || points.length > LIMITS.points || points.some((point) => point.length > LIMITS.point)) {
      setError(`Добавьте от 1 до ${LIMITS.points} пунктов, по одному на строку. Лимит на пункт — ${LIMITS.point} символов.`)
      return
    }
    if (!period.trim() || (mode === 'peer' && !subject.trim())) {
      setError('Заполните период и, для оценки коллеги, имя.')
      return
    }
    const entry: Session = {
      id: crypto.randomUUID(), mode, subject: mode === 'peer' ? subject.trim() : '', period: period.trim(),
      points, level: mode === 'self' ? level : null, turns: [], question: null, covered: [], missing: [], ready: false,
      updatedAt: new Date().toISOString(), draft: null, diagnostics: '',
    }
    saveSession(entry)
    setSessionId(entry.id)
    setAnswer('')
    setPointsText('')
    setSubject('')
  }

  function saveEndpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()
    try {
      const endpoint = parseEndpoint(endpointText)
      persist((current) => ({ ...current, endpoint }))
      setEndpointText(endpoint)
      setNotice('Адрес агента сохранён.')
    } catch {
      setError('Укажите HTTPS-адрес или HTTP-адрес на localhost, 127.0.0.1 или [::1].')
    }
  }

  async function ask(entry: Session, action: ReviewRequest['action']) {
    if (activeRequest.current || !shelf.endpoint || (entry.mode === 'self' && !isReviewLevel(entry.level))) return
    resetMessages()
    const controller = new AbortController()
    const timeout = AbortSignal.timeout(125000)
    activeRequest.current = controller
    setBusy(action)
    try {
      const payload = validateReviewRequest({
        version: entry.mode === 'self' ? SELF_REVIEW_VERSION : REVIEW_VERSION,
        action, mode: entry.mode, subject: entry.subject, level: entry.level,
        period: entry.period, points: entry.points, turns: entry.turns,
      })
      const response = await fetch(parseEndpoint(shelf.endpoint), {
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.any([controller.signal, timeout]),
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: 'Агент отклонил данные интервью.',
          403: 'Агенту нужно разрешить адрес этой страницы.',
          413: 'Данные интервью превышают лимит агента.',
          502: 'Модель недоступна или вернула ответ в неверном формате.',
          504: 'Модель не ответила вовремя.',
        }
        setError(messages[response.status] || `Агент вернул ошибку HTTP ${response.status}.`)
        return
      }
      const result = validateReviewResponse(await response.json(), payload)
      const updated = { ...entry, updatedAt: new Date().toISOString() }
      if (result.kind === 'draft') {
        const headings = entry.mode === 'peer' ? PEER_SECTIONS : entry.points
        const draft = result.sections.map(({ id, text }) => `${headings[id - 1]}\n\n${text}`).join('\n\n')
        saveSession({ ...updated, draft, diagnostics: result.diagnostics, assessment: result.assessment })
      } else {
        saveSession({
          ...updated, ready: result.kind === 'ready', covered: result.covered, missing: result.missing,
          question: result.kind === 'question' ? result.question : null,
        })
      }
    } catch (caught) {
      if (controller.signal.aborted) return
      if (timeout.aborted) {
        setError('Агент не ответил вовремя. Ответ сохранён, можно повторить запрос.')
      } else if (caught instanceof TypeError) {
        setError('Не удалось связаться с агентом. Проверьте адрес, сервер и разрешения браузера.')
      } else {
        setError('Не удалось обработать данные агента. Можно повторить запрос.')
      }
    } finally {
      activeRequest.current = null
      if (!controller.signal.aborted) setBusy(null)
    }
  }

  function submitAnswer(entry: Session, value: string | null) {
    if (!entry.question || activeRequest.current || !shelf.endpoint) return
    const next: Session = {
      ...entry, question: null, turns: [...entry.turns, { ...entry.question, answer: value }],
      updatedAt: new Date().toISOString(),
    }
    saveSession(next)
    setAnswer('')
    if (next.turns.length < LIMITS.turns) void ask(next, 'next')
  }

  function open(id: string | null) {
    setSessionId(id)
    setAnswer('')
    resetMessages()
  }

  function remove(entry: Session) {
    if (!window.confirm(`Удалить «${title(entry)}» вместе с интервью и черновиком?`)) return
    persist((current) => ({ ...current, sessions: current.sessions.filter((item) => item.id !== entry.id) }))
    open(null)
  }

  async function copyDraft(text: string) {
    resetMessages()
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Текст скопирован.')
    } catch {
      setError('Буфер обмена недоступен. Выделите и скопируйте текст вручную.')
    }
  }

  const needsLevel = session?.mode === 'self' && session.draft === null && !isReviewLevel(session.level)
  const hasEvidence = session?.turns.some((turn) => turn.answer !== null) ?? false
  const canContinue = session && !session.ready && session.turns.length < LIMITS.turns
  const allPointsAsked = session?.points.every((_, index) =>
    session.turns.some((turn) => turn.point === index + 1)) ?? false
  const canDraft = hasEvidence && (allPointsAsked || session?.turns.length === LIMITS.turns)

  return (
    <section className="escada-review" aria-label="Ревью">
      <header className="escada-review-hero">
        <div>
          <h2>{session ? title(session) : 'Подготовка к ревью'}</h2>
          <p>{session ? [session.period, session.level ? REVIEW_LEVEL_LABELS[session.level] : null].filter(Boolean).join(' · ') : 'Добавьте пункты оценки, пройдите интервью и соберите черновик.'}</p>
        </div>
        {session && <button className="escada-secondary-button" type="button" disabled={busy !== null} onClick={() => open(null)}>Новое ревью</button>}
      </header>
      <div className="escada-review-layout">
        <div className="escada-review-main">
          {storageError && <p className="escada-review-alert" role="alert">{storageError}</p>}
          {error && <p className="escada-review-alert" role="alert">{error}</p>}
          {notice && <p className="escada-review-notice" role="status">{notice}</p>}
          {busy && <p className="escada-review-notice" role="status">{busy === 'draft' ? 'Агент готовит черновик…' : 'Агент подбирает следующий вопрос…'}</p>}
          {!session && (
            <form className="escada-review-card" onSubmit={start}>
              <fieldset className="escada-review-modes">
                <legend>Кого оцениваем?</legend>
                {(['self', 'peer'] as const).map((option) => (
                  <label key={option} data-selected={option === mode}>
                    <input type="radio" name="review-mode" value={option} checked={option === mode} onChange={() => setMode(option)} />
                    <span><strong>{MODE_LABELS[option]}</strong><small>{MODE_DESCRIPTIONS[option]}</small></span>
                  </label>
                ))}
              </fieldset>
              <div className="escada-review-fields">
                <label>Период<input value={period} maxLength={100} onChange={(event) => setPeriod(event.target.value)} required /></label>
                {mode === 'peer'
                  ? <label>Имя коллеги<input value={subject} maxLength={150} onChange={(event) => setSubject(event.target.value)} required /></label>
                  : <LevelSelect level={level} onChange={setLevel} />}
              </div>
              <label>Пункты ревью
                <textarea rows={7} value={pointsText} maxLength={LIMITS.points * (LIMITS.point + 8)} onChange={(event) => setPointsText(event.target.value)} aria-describedby="review-points-help" required />
              </label>
              <small id="review-points-help">Вставьте пункты из вашей формы. Один пункт на строку.</small>
              {mode === 'self' && <ReviewRubric level={level} />}
              <button className="escada-primary-button" type="submit">Подготовить интервью</button>
            </form>
          )}
          {session && needsLevel && (
            <form className="escada-review-card" onSubmit={(event) => {
              event.preventDefault()
              saveSession({ ...session, level, updatedAt: new Date().toISOString() })
            }}>
              <h3>Укажите уровень для этого интервью</h3>
              <p>Вопросы и итоговая оценка будут опираться на выбранный уровень.</p>
              <LevelSelect level={level} onChange={setLevel} />
              <button className="escada-primary-button" type="submit">Сохранить уровень</button>
            </form>
          )}
          {session && session.draft === null && !needsLevel && (
            <section className="escada-review-card" aria-labelledby="review-question">
              <h3 id="review-question" ref={questionHeading} tabIndex={-1}>
                {session.question?.text || (session.ready ? 'Интервью завершено' : 'Интервью')}
              </h3>
              {session.question && <p className="escada-review-point">{session.points[session.question.point - 1]}</p>}
              {!shelf.endpoint && <p><a href="#review-agent">Укажите адрес локального агента</a>, чтобы получить вопросы и черновик.</p>}
              {session.question && (
                <form className="escada-review-card-form" onSubmit={(event) => { event.preventDefault(); if (answer.trim()) submitAnswer(session, answer.trim()) }}>
                  <label>Ваш ответ<textarea rows={5} value={answer} maxLength={LIMITS.answer} onChange={(event) => setAnswer(event.target.value)} required /></label>
                  <div className="escada-button-row">
                    <button type="submit" className="escada-primary-button" disabled={!answer.trim() || busy !== null || !shelf.endpoint}>Ответить</button>
                    <button type="button" className="escada-secondary-button" disabled={busy !== null || !shelf.endpoint} onClick={() => submitAnswer(session, null)}>Пропустить вопрос</button>
                  </div>
                </form>
              )}
              <div className="escada-button-row">
                {!session.question && canContinue && <button className="escada-primary-button" type="button" disabled={busy !== null || !shelf.endpoint} onClick={() => void ask(session, 'next')}>{session.turns.length ? 'Следующий вопрос' : 'Начать интервью'}</button>}
                {canDraft && <button type="button" className={canContinue ? 'escada-secondary-button' : 'escada-primary-button'} disabled={busy !== null || !shelf.endpoint} onClick={() => void ask(session, 'draft')}>Собрать черновик</button>}
              </div>
              {(session.ready || session.turns.length === LIMITS.turns) && !hasEvidence && <p>Для черновика нужен хотя бы один ответ. Начните новое ревью, чтобы добавить наблюдения.</p>}
            </section>
          )}
          {session && session.draft !== null && (
            <section className="escada-review-card">
              {session.diagnostics && <details className="escada-review-diagnostics" open><summary>Выводы по интервью</summary><p>{session.diagnostics}</p></details>}
              <label>Черновик<textarea rows={18} value={session.draft} maxLength={150000}
                onChange={(event) => saveSession({ ...session, draft: event.target.value, updatedAt: new Date().toISOString() })} /></label>
              <button className="escada-primary-button" type="button" disabled={!session.draft.trim()} onClick={() => void copyDraft(session.draft ?? '')}>Скопировать текст</button>
              {isReviewLevel(session.level) && session.assessment && <ReviewRubric level={session.level} assessment={session.assessment} />}
            </section>
          )}
          {session && session.turns.length > 0 && (
            <details className="escada-review-card escada-review-transcript">
              <summary>Ответы интервью ({session.turns.length})</summary>
              <ol>{session.turns.map((turn) => <li key={turn.text}><strong>{turn.text}</strong><p>{turn.answer ?? 'Вопрос пропущен.'}</p></li>)}</ol>
            </details>
          )}
        </div>
        <aside className="escada-review-rail" aria-label="Пункты, агент и история">
          {session && (
            <section className="escada-review-card">
              <h3>Пункты ревью</h3>
              <progress value={session.covered.length} max={session.points.length} aria-label="Пункты с подтверждениями" />
              <ol className="escada-review-checklist">{session.points.map((point, index) => (
                <li key={point}><span>{point}</span><small data-covered={session.covered.includes(index + 1)}>
                  {session.covered.includes(index + 1) ? 'Есть материал' : session.missing.includes(index + 1) ? 'Мало данных' : 'Открыт'}
                </small></li>
              ))}</ol>
            </section>
          )}
          <details id="review-agent" className="escada-review-card" open={!shelf.endpoint}>
            <summary>Подключение агента</summary>
            <form className="escada-review-card-form" onSubmit={saveEndpoint}>
              <label>Адрес шлюза<input type="url" value={endpointText} onChange={(event) => setEndpointText(event.target.value)} maxLength={500} required /></label>
              <small>При запросе вопросы, ответы и выбранная шкала отправляются на указанный сервер.</small>
              <button className="escada-secondary-button" type="submit" disabled={busy !== null}>Сохранить адрес</button>
            </form>
          </details>
          {shelf.sessions.length > 0 && (
            <section className="escada-review-card">
              <h3>Мои ревью</h3>
              <ul className="escada-review-history">{shelf.sessions.map((entry) => (
                <li key={entry.id}>
                  <button type="button" aria-current={entry.id === sessionId ? 'true' : undefined} disabled={busy !== null} onClick={() => open(entry.id)}>
                    <strong>{title(entry)}</strong><small>{entry.level && <>{REVIEW_LEVEL_LABELS[entry.level]} · </>}{entry.period} · {entry.draft === null ? 'Интервью' : 'Черновик'} · {HISTORY_DATE.format(new Date(entry.updatedAt))}</small>
                  </button>
                </li>
              ))}</ul>
              {session && <button className="escada-review-delete" type="button" disabled={busy !== null} onClick={() => remove(session)}>Удалить это ревью</button>}
            </section>
          )}
        </aside>
      </div>
    </section>
  )
}
