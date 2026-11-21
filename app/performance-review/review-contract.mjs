import { getReviewRubric, isReviewLevel } from './review-rubric.mjs'

export const REVIEW_VERSION = 1
export const SELF_REVIEW_VERSION = 2
export const LIMITS = Object.freeze({
  points: 20,
  point: 700,
  turns: 45,
  answer: 3000,
  question: 900,
  sections: 6500,
  diagnostics: 10000,
  assessmentNote: 750,
  bytes: 1024 * 1024,
})
export const PEER_SECTIONS = Object.freeze([
  'В каких рабочих проектах или задачах мы взаимодействовали? Какие результаты я наблюдал?',
  'Какие сильные стороны я вижу в работе коллеги?',
  'Какие зоны роста я вижу?',
  'Комментарий',
])

function invalid() {
  throw new Error('Invalid performance review data')
}

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value
}

function string(value, max, optional = false) {
  if (typeof value !== 'string' || value.length > max) invalid()
  const text = value.trim()
  if (!optional && !text) invalid()
  return text
}

function list(value, max, parse) {
  if (!Array.isArray(value) || value.length > max) invalid()
  return value.map(parse)
}

function id(value, ids) {
  if (!Number.isInteger(value) || !ids.includes(value)) invalid()
  return value
}

function question(value, ids) {
  const data = object(value)
  return { point: id(data.point, ids), text: string(data.text, LIMITS.question) }
}

function unique(values) {
  if (new Set(values).size !== values.length) invalid()
  return values
}

function validateAssessment(value, request) {
  const { competencies } = getReviewRubric(request.level)
  const byId = new Map(competencies.map((competency) => [competency.id, competency]))
  const answeredTurns = request.turns.flatMap((turn, index) => turn.answer === null ? [] : [index + 1])
  const assessments = new Map()

  const entries = list(value, competencies.length, (entry) => object(entry))
  for (const entry of entries) {
    const competency = byId.get(entry.competencyId)
    if (!competency || assessments.has(competency.id)) invalid()
    if (!['evidenced', 'insufficient', 'not_applicable'].includes(entry.status)) invalid()
    const allowedCriteria = new Set(competency.criteria.map((criterion) => criterion.id))
    const criterionIds = unique(list(entry.criterionIds, competency.criteria.length, (criterionId) => {
      if (!allowedCriteria.has(criterionId)) invalid()
      return criterionId
    }))
    const turnIds = unique(list(entry.turnIds, answeredTurns.length, (turnId) => id(turnId, answeredTurns)))
    if (entry.status === 'evidenced' && (!criterionIds.length || !turnIds.length)) invalid()
    if (entry.status === 'not_applicable' && (criterionIds.length || turnIds.length)) invalid()
    assessments.set(competency.id, {
      competencyId: competency.id,
      status: entry.status,
      note: string(entry.note, LIMITS.assessmentNote),
      criterionIds,
      turnIds,
    })
  }

  if (assessments.size !== competencies.length) invalid()
  return competencies.map(({ id }) => assessments.get(id))
}

export function validateReviewRequest(value) {
  const data = object(value)
  if (!['self', 'peer'].includes(data.mode) || !['next', 'draft'].includes(data.action)) invalid()
  const isSelf = data.mode === 'self'
  const version = isSelf ? SELF_REVIEW_VERSION : REVIEW_VERSION
  if (data.version !== version || (isSelf && !isReviewLevel(data.level))) invalid()
  const points = unique(list(data.points, LIMITS.points, (point) => string(point, LIMITS.point)))
  if (!points.length) invalid()
  const pointIds = points.map((_, index) => index + 1)
  const turns = list(data.turns, LIMITS.turns, (value) => {
    const entry = object(value)
    return {
      ...question(entry, pointIds),
      answer: entry.answer === null ? null : string(entry.answer, LIMITS.answer),
    }
  })
  if (data.action === 'draft') {
    const attempted = new Set(turns.map((entry) => entry.point))
    if (!turns.some((entry) => entry.answer !== null) || (attempted.size < points.length && turns.length < LIMITS.turns)) invalid()
  }
  return {
    version,
    action: data.action,
    mode: data.mode,
    period: string(data.period, 100),
    subject: data.mode === 'peer' ? string(data.subject, 150) : '',
    points,
    turns,
    ...(isSelf ? { level: data.level } : { matrix: [] }),
  }
}

export function validateReviewResponse(value, request) {
  const data = object(value)
  if (data.version !== request.version) invalid()
  const pointIds = request.points.map((_, index) => index + 1)
  if (request.action === 'draft') {
    const sectionIds = request.mode === 'peer' ? [1, 2, 3, 4] : pointIds
    if (data.kind !== 'draft') invalid()
    const sections = list(data.sections, sectionIds.length, (value) => {
      const section = object(value)
      return { id: id(section.id, sectionIds), text: string(section.text, LIMITS.sections) }
    })
    if (sections.length !== sectionIds.length) invalid()
    unique(sections.map((section) => section.id))
    const diagnostics = request.mode === 'self' ? string(data.diagnostics, LIMITS.diagnostics) : ''
    const assessment = request.mode === 'self' ? validateAssessment(data.assessment, request) : undefined
    return {
      version: request.version, kind: 'draft', sections: sections.sort((a, b) => a.id - b.id), diagnostics,
      ...(assessment ? { assessment } : {}),
    }
  }

  if (!['question', 'ready'].includes(data.kind)) invalid()
  const attempted = new Set(request.turns.map((entry) => entry.point))
  const observed = new Set(request.turns.filter((entry) => entry.answer !== null).map((entry) => entry.point))
  const covered = unique(list(data.covered, pointIds.length, (value) => id(value, pointIds)))
  const missing = unique(list(data.missing, pointIds.length, (value) => id(value, pointIds)))
  if (covered.some((point) => !observed.has(point) || missing.includes(point))) invalid()

  if (data.kind === 'ready') {
    if (pointIds.some((point) => !attempted.has(point) || (!covered.includes(point) && !missing.includes(point)))) invalid()
    return { version: request.version, kind: 'ready', covered, missing }
  }

  if (request.turns.length >= LIMITS.turns) invalid()
  const next = question(data.question, pointIds)
  const normalized = next.text.toLocaleLowerCase('ru').replace(/\s+/g, ' ')
  if (request.turns.some((entry) => entry.text.toLocaleLowerCase('ru').replace(/\s+/g, ' ') === normalized)) invalid()
  return { version: request.version, kind: 'question', question: next, covered, missing }
}
