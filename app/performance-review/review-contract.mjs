export const REVIEW_VERSION = 1
export const LIMITS = Object.freeze({
  points: 20,
  point: 700,
  turns: 45,
  answer: 3000,
  question: 900,
  sections: 6500,
  diagnostics: 10000,
  criteria: 200,
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

function criteria(value) {
  const entry = object(value)
  if (!['specialist', 'senior', 'lead'].includes(entry.level)) invalid()
  return {
    id: string(entry.id, 150),
    competency: string(entry.competency, 300),
    level: entry.level,
    text: string(entry.text, 1500),
  }
}

export function validateReviewRequest(value) {
  const data = object(value)
  if (data.version !== REVIEW_VERSION || !['self', 'peer'].includes(data.mode) || !['next', 'draft'].includes(data.action)) invalid()
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
    version: REVIEW_VERSION,
    action: data.action,
    mode: data.mode,
    period: string(data.period, 100),
    subject: data.mode === 'peer' ? string(data.subject, 150) : '',
    points,
    turns,
    matrix: data.mode === 'self' ? list(data.matrix ?? [], LIMITS.criteria, criteria) : [],
  }
}

export function validateReviewResponse(value, request) {
  const data = object(value)
  if (data.version !== REVIEW_VERSION) invalid()
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
    return { version: REVIEW_VERSION, kind: 'draft', sections: sections.sort((a, b) => a.id - b.id), diagnostics }
  }

  if (!['question', 'ready'].includes(data.kind)) invalid()
  const attempted = new Set(request.turns.map((entry) => entry.point))
  const observed = new Set(request.turns.filter((entry) => entry.answer !== null).map((entry) => entry.point))
  const covered = unique(list(data.covered, pointIds.length, (value) => id(value, pointIds)))
  const missing = unique(list(data.missing, pointIds.length, (value) => id(value, pointIds)))
  if (covered.some((point) => !observed.has(point) || missing.includes(point))) invalid()

  if (data.kind === 'ready') {
    if (pointIds.some((point) => !attempted.has(point) || (!covered.includes(point) && !missing.includes(point)))) invalid()
    return { version: REVIEW_VERSION, kind: 'ready', covered, missing }
  }

  if (request.turns.length >= LIMITS.turns) invalid()
  const next = question(data.question, pointIds)
  const normalized = next.text.toLocaleLowerCase('ru').replace(/\s+/g, ' ')
  if (request.turns.some((entry) => entry.text.toLocaleLowerCase('ru').replace(/\s+/g, ' ') === normalized)) invalid()
  return { version: REVIEW_VERSION, kind: 'question', question: next, covered, missing }
}
