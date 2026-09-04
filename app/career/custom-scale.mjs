// v31 (mock stage): turns a user-supplied career instructions document into
// the same shape as the built-in competency-knowledge.mjs base.
//
// IMPORTANT: this is a deterministic, offline HEURISTIC — not a real AI call.
// It exists so the rest of the app (state shape, UI, reset flow) can be built
// and tested now, and later swapped for a real model call behind the same
// function signature (parseCustomScaleMock -> parseCustomScale) without
// touching any caller.

export const CUSTOM_SCALE_MIN_CHARS = 40

export const MOCK_PARSER_DISCLAIMER =
  'Разбор выполняется локальной заглушкой (эвристика по строкам), а не настоящей моделью. ' +
  'Результат может быть грубым — проверьте критерии перед использованием.'

const LEVEL_KEYS = ['specialist', 'senior', 'lead']
const LEVEL_HINTS = {
  specialist: ['специалист', 'junior', 'начальн', 'базов'],
  senior: ['senior', 'старш', 'ведущ специалист', 'опытн'],
  lead: ['lead', 'лид', 'руковод', 'директор', 'head'],
}
const DOMAIN_ORDER = ['strategy', 'craft', 'leadership']

function normalizeLine(line) {
  return line.replace(/\r/g, '').trimEnd()
}

function isHeadingLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return false
  // Markdown headings, numbered sections ("1. Title", "1) Title"),
  // or a short standalone line that ends with a colon (a common way to
  // introduce a section in plain-text instructions).
  if (/^#{1,3}\s+\S/.test(trimmed)) return true
  if (/^\d+[.)]\s+\S/.test(trimmed) && trimmed.length < 90) return true
  if (/^[-*•]/.test(trimmed)) return false
  if (/^[A-ZА-ЯЁ][^:]{2,80}:\s*$/.test(trimmed)) return true
  return false
}

function isBulletLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return false
  return /^[-*•]\s+\S/.test(trimmed) || /^\d+[.)]\s+\S/.test(trimmed) === false && /^[-*•]/.test(trimmed)
}

function stripHeadingMarkers(line) {
  return line.trim().replace(/^#{1,3}\s+/, '').replace(/^\d+[.)]\s+/, '').replace(/:\s*$/, '').trim()
}

function stripBulletMarker(line) {
  return line.trim().replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()
}

function slugify(value, fallbackIndex) {
  const base = value
    .toLocaleLowerCase('ru-RU')
    .replace(/[^a-zа-яё0-9]+/giu, '-')
    .replace(/^-+|-+$/g, '')
  return base || `competency-${fallbackIndex + 1}`
}

function guessLevelForLine(line) {
  const lower = line.toLocaleLowerCase('ru-RU')
  for (const level of LEVEL_KEYS) {
    if (LEVEL_HINTS[level].some((hint) => lower.includes(hint))) return level
  }
  return null
}

// Splits raw text into blocks, each block being one candidate competency:
// a heading line followed by its bullet/body lines, until the next heading.
function splitIntoBlocks(lines) {
  const blocks = []
  let current = null
  for (const rawLine of lines) {
    const line = normalizeLine(rawLine)
    if (!line.trim()) continue
    if (isHeadingLine(line)) {
      if (current) blocks.push(current)
      current = { heading: stripHeadingMarkers(line), lines: [] }
    } else if (current) {
      current.lines.push(line)
    } else {
      // Text before any heading: treat as an implicit first competency.
      current = { heading: 'Общие ожидания', lines: [line] }
    }
  }
  if (current) blocks.push(current)
  return blocks
}

// Distributes a block's content lines across the three levels. If lines carry
// an explicit level hint (e.g. "Senior: ...") they go to that level; otherwise
// lines are split evenly in document order across specialist -> senior -> lead,
// which is a rough but predictable stand-in for real judgement.
function distributeCriteria(block, competencyId) {
  const contentLines = block.lines
    .filter((line) => line.trim())
    .map((line) => (isBulletLine(line) ? stripBulletMarker(line) : line.trim()))
    .filter((text) => text.length > 3)

  const buckets = { specialist: [], senior: [], lead: [] }
  const unassigned = []

  for (const text of contentLines) {
    const hinted = guessLevelForLine(text)
    if (hinted) buckets[hinted].push(text)
    else unassigned.push(text)
  }

  if (unassigned.length) {
    const perLevel = Math.max(1, Math.ceil(unassigned.length / LEVEL_KEYS.length))
    unassigned.forEach((text, index) => {
      const level = LEVEL_KEYS[Math.min(LEVEL_KEYS.length - 1, Math.floor(index / perLevel))]
      buckets[level].push(text)
    })
  }

  // Every level needs at least one criterion for the rest of the app
  // (ScaleReference, computeGrowthPath) to render sensibly.
  for (const level of LEVEL_KEYS) {
    if (!buckets[level].length) {
      buckets[level].push(`Ожидания уровня «${level}» не удалось выделить из текста — уточните вручную.`)
    }
  }

  const levels = {}
  for (const level of LEVEL_KEYS) {
    levels[level] = buckets[level].map((text, index) => ({
      id: `${competencyId}.${level}.${String(index + 1).padStart(2, '0')}`,
      text,
      sourcePage: 0,
    }))
  }
  return levels
}

/**
 * Deterministic, offline heuristic parse of raw instructions into the same
 * shape as competencyKnowledge in competency-knowledge.mjs. Not a real model
 * call — see MOCK_PARSER_DISCLAIMER.
 */
export function parseCustomScaleMock(rawText, title, now = new Date()) {
  const text = String(rawText ?? '').trim()
  const parseNotes = []
  const lines = text.split('\n')
  const blocks = splitIntoBlocks(lines)

  if (!blocks.length) {
    parseNotes.push('Не удалось найти структуру в тексте — весь текст сохранён как одна компетенция.')
    blocks.push({ heading: title || 'Пользовательская компетенция', lines })
  }

  if (blocks.length === 1) {
    parseNotes.push('Найдена только одна смысловая секция. Если инструкции описывают несколько компетенций, разделите их заголовками.')
  }

  const usedIds = new Set()
  const competencies = blocks.map((block, index) => {
    let id = slugify(block.heading, index)
    while (usedIds.has(id)) id = `${id}-${index + 1}`
    usedIds.add(id)

    const levels = distributeCriteria(block, id)
    const domain = DOMAIN_ORDER[index % DOMAIN_ORDER.length]
    const totalCriteria = LEVEL_KEYS.reduce((sum, level) => sum + levels[level].length, 0)

    return {
      id,
      title: block.heading || `Компетенция ${index + 1}`,
      shortTitle: (block.heading || `Компетенция ${index + 1}`).slice(0, 24),
      domain,
      summary: `Загружено из пользовательских инструкций (${totalCriteria} критериев, домен назначен автоматически).`,
      levels,
    }
  })

  if (competencies.length > 12) {
    parseNotes.push(`Найдено ${competencies.length} секций — это больше, чем в стандартной шкале (12). Проверьте, не разбился ли текст лишний раз.`)
  }

  const knowledgeBaseVersion = `custom-scale-mock-${now.toISOString().slice(0, 10)}-${competencies.length}c`

  return { competencies, knowledgeBaseVersion, parseNotes }
}

export function createCustomScaleDraft(rawInput, sourceType, sourceFileName, title, now = new Date()) {
  return {
    id: `custom-scale-${now.getTime()}`,
    title: title?.trim() || 'Моя шкала',
    sourceType,
    sourceFileName: sourceFileName ?? null,
    rawInput: String(rawInput ?? ''),
    status: 'draft',
    competencies: null,
    knowledgeBaseVersion: null,
    parseNotes: [],
    errorMessage: null,
    createdAt: now.toISOString(),
    isMock: true,
  }
}
