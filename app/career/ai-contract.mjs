import { levelLabels, nextLevel } from './competency-knowledge.mjs'
import { deriveActiveScale } from './active-scale.mjs'

export const AI_ACTIONS = ['idea_review', 'win_rewrite', 'report_draft', 'report_review', 'growth_guidance']
const MAX_CONTEXT_CHARS = 24000
const MAX_CRITERIA = 18

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('ru-RU').replace(/[^a-zа-яё0-9%]+/giu, ' ').trim()
}

function tokens(value) {
  return new Set(normalize(value).split(/\s+/).filter((item) => item.length > 2))
}

function flattenText(value, depth = 0) {
  if (depth > 5 || value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => flattenText(item, depth + 1)).join(' ')
  if (typeof value === 'object') return Object.values(value).map((item) => flattenText(item, depth + 1)).join(' ')
  return ''
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function inferCompetencyIds(text, competencyKeywords, explicitIds = []) {
  const haystack = normalize(text)
  const scored = Object.entries(competencyKeywords).map(([id, words]) => ({
    id,
    score: words.reduce((sum, word) => sum + (haystack.includes(normalize(word)) ? 1 : 0), 0),
  }))
  return unique([
    ...explicitIds,
    ...scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map((item) => item.id),
  ]).slice(0, 6)
}

export function validateAiRequest(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_REQUEST')
  if (!AI_ACTIONS.includes(payload.action)) throw new Error('INVALID_ACTION')
  if (!payload.profile || typeof payload.profile !== 'object') throw new Error('PROFILE_REQUIRED')
  if (!['specialist', 'senior', 'lead'].includes(payload.profile.currentLevel)) throw new Error('INVALID_LEVEL')
  const raw = JSON.stringify(payload)
  if (raw.length > MAX_CONTEXT_CHARS) throw new Error('REQUEST_TOO_LARGE')
  return payload
}

// v32: activeScale (from active-scale.mjs's deriveActiveScale) replaces the
// static allCriteria/competencyKeywords/knowledgeBaseVersion imports, so
// retrieval reads whichever scale — default or a user's uploaded custom one —
// is currently active.
export function retrieveCriteria(payload, activeScale = deriveActiveScale(null)) {
  const { allCriteria, competencyKeywords, knowledgeBaseVersion } = activeScale
  const text = flattenText(payload.artifact ?? payload.context ?? '')
  const explicit = unique([
    ...(payload.competencyIds ?? []),
    ...((payload.artifact && payload.artifact.competencyIds) ?? []),
  ])
  const competencyIds = inferCompetencyIds(text, competencyKeywords, explicit)
  const currentLevel = payload.profile.currentLevel
  const targetLevel = nextLevel(currentLevel)
  const allowedLevels = targetLevel ? [currentLevel, targetLevel] : [currentLevel]
  const textTokens = tokens(text)

  const candidates = allCriteria
    .filter((criterion) => allowedLevels.includes(criterion.level))
    .map((criterion) => {
      const criterionTokens = tokens(criterion.text)
      let overlap = 0
      for (const token of textTokens) if (criterionTokens.has(token)) overlap += 1
      const explicitBoost = competencyIds.includes(criterion.competencyId) ? 8 : 0
      const currentBoost = criterion.level === currentLevel ? 2 : 1
      return { criterion, score: explicitBoost + overlap * 2 + currentBoost }
    })
    .filter((item) => item.score > 1 || competencyIds.includes(item.criterion.competencyId))
    .sort((a, b) => b.score - a.score || a.criterion.id.localeCompare(b.criterion.id))

  const selected = []
  const seen = new Set()
  for (const item of candidates) {
    if (seen.has(item.criterion.id)) continue
    selected.push(item.criterion)
    seen.add(item.criterion.id)
    if (selected.length >= MAX_CRITERIA) break
  }

  if (!selected.length) {
    for (const criterion of allCriteria.filter((item) => allowedLevels.includes(item.level)).slice(0, 8)) selected.push(criterion)
  }

  return {
    knowledgeBaseVersion,
    currentLevel,
    targetLevel,
    competencyIds,
    criteria: selected,
  }
}

function reportDraftInstruction(reportType) {
  const label = String(reportType ?? '').toLowerCase()
  const plainTextRule = 'Output must be PLAIN TEXT, never Markdown: no #, no **bold**, no Markdown "- " list syntax. Use uppercase section headers on their own line, "\u2022 " for bullet points, and "Label: value" instead of bold labels.'
  if (label.includes('недел')) {
    return `Create a short Russian weekly pulse from only the selected wins and ideas: a few bullet lines per win, one line per idea in progress, one next-week focus. No headline ceremony, no invented metrics or impact. ${plainTextRule}`
  }
  if (label.includes('performance')) {
    return `Create a thorough Russian performance-review draft covering the FULL period: every selected win in full detail, ideas in progress, and a competency-signal summary derived only from the competencyIds already present on the supplied wins/ideas (counts only, never invented scores or percentages). Do not invent metrics, impact, recognition, or causal claims. ${plainTextRule}`
  }
  if (label.includes('promotion')) {
    return `Create a Russian promotion case that presents the employee in the strongest honest light supported by the data: lead with the strongest competency signals mapped to the next-level criteria supplied, then the key results with full detail, then initiatives showing scope. Never invent a metric, stakeholder confirmation, or causal claim that is not already in the supplied facts — end with an explicit "не забудьте" checklist of what the user must still verify (numbers, confirmations) before submitting. ${plainTextRule}`
  }
  return `Create a concise Russian monthly draft from only the selected wins and ideas. Do not invent metrics, impact, recognition, or causal claims. ${plainTextRule}`
}

function actionInstruction(action, artifact) {
  if (action === 'idea_review') return 'Analyze the idea. Return strengths, how to exceed expectations, evidence to preserve, and one concrete next step.'
  if (action === 'win_rewrite') return 'Improve wording without inventing facts. Return a rewrite object with title, impact, and evidence using only supplied facts.'
  if (action === 'report_draft') return reportDraftInstruction(artifact?.reportType)
  if (action === 'report_review') return 'Review the report against supplied criteria. Identify well-supported signals, missing evidence, and one next action.'
  return 'Recommend no more than three development directions based only on supplied artifacts and the criteria for the current and next level.'
}

export function buildClosedWorldMessages(payload, retrieval) {
  const allowedIds = retrieval.criteria.map((criterion) => criterion.id)
  const criteriaText = retrieval.criteria.map((criterion) => (
    `[${criterion.id}] ${criterion.competencyTitle} / ${levelLabels[criterion.level]} / стр. ${criterion.sourcePage}: ${criterion.text}`
  )).join('\n')
  const targetLabel = retrieval.targetLevel ? levelLabels[retrieval.targetLevel] : 'следующего уровня в документе нет'

  const system = `You are Escada, a closed-world career guidance assistant for a Digital Marketing employee.\n\nNON-NEGOTIABLE RULES:\n1. Use only the COMPETENCY CRITERIA included in this request and facts explicitly present in USER DATA.\n2. Do not use internet knowledge, generic career frameworks, other companies' practices, or your own definitions of seniority.\n3. Never assign an official level, predict promotion, compare the user with colleagues, or calculate a percentage fit.\n4. Phrase conclusions as signals in the user's records, not as formal assessment.\n5. Never invent numbers, impact, causality, recognition, stakeholders, evidence, or competency links.\n6. Every item in strengths and stretch MUST cite one allowed criterionId. If evidence is insufficient, say so plainly.\n7. Return valid JSON only. No Markdown fences and no prose outside JSON.\n8. Use Russian for all user-facing text.\n9. Return at most 3 strengths, 3 stretch items, 3 evidence items, and exactly one practical nextStep when possible.\n10. The only allowed criterion IDs are: ${allowedIds.join(', ')}.\n\nOUTPUT JSON SHAPE:\n{\n  "headline": "string",\n  "strengths": [{"text":"string","criterionId":"allowed id"}],\n  "stretch": [{"text":"string","criterionId":"allowed id"}],\n  "evidence": ["string"],\n  "nextStep": "string",\n  "rewrite": {"title":"string","impact":"string","evidence":"string"} | null,\n  "draftMarkdown": "string" | null,\n  "caveat": "string"\n}`

  const user = `ACTION: ${payload.action}\nTASK: ${actionInstruction(payload.action, payload.artifact)}\nCURRENT LEVEL: ${levelLabels[retrieval.currentLevel]}\nNEXT LEVEL: ${targetLabel}\nROLE: ${payload.profile.role ?? ''}\nMARKET/TEAM: ${payload.profile.market ?? ''}\nKNOWLEDGE BASE VERSION: ${retrieval.knowledgeBaseVersion}\n\nCOMPETENCY CRITERIA:\n${criteriaText}\n\nUSER DATA (facts only):\n${JSON.stringify(payload.artifact ?? payload.context ?? {}, null, 2)}\n\nRemember: if USER DATA does not support a claim, do not make it.`

  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

function extractJson(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) throw new Error('EMPTY_AI_RESPONSE')
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('AI_RESPONSE_NOT_JSON')
  return JSON.parse(unfenced.slice(start, end + 1))
}

function cleanText(value, max = 1600) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanCited(items, allowedIds) {
  if (!Array.isArray(items)) return []
  return items.slice(0, 3).map((item) => ({
    text: cleanText(item?.text, 700),
    criterionId: cleanText(item?.criterionId, 120),
  })).filter((item) => item.text && allowedIds.has(item.criterionId))
}

export function parseAndValidateAiResponse(rawText, retrieval, action) {
  const parsed = typeof rawText === 'string' ? extractJson(rawText) : rawText
  const allowedIds = new Set(retrieval.criteria.map((criterion) => criterion.id))
  const response = {
    headline: cleanText(parsed?.headline, 300) || 'Подсказка Эскады',
    strengths: cleanCited(parsed?.strengths, allowedIds),
    stretch: cleanCited(parsed?.stretch, allowedIds),
    evidence: Array.isArray(parsed?.evidence) ? parsed.evidence.slice(0, 3).map((item) => cleanText(item, 500)).filter(Boolean) : [],
    nextStep: cleanText(parsed?.nextStep, 700),
    rewrite: null,
    draftMarkdown: cleanText(parsed?.draftMarkdown, 12000) || null,
    caveat: cleanText(parsed?.caveat, 500) || 'Подсказка основана только на выбранных записях и шкале компетенций.',
    sources: retrieval.criteria.map((criterion) => ({
      id: criterion.id,
      competencyTitle: criterion.competencyTitle,
      level: criterion.level,
      text: criterion.text,
      sourcePage: criterion.sourcePage,
    })),
    knowledgeBaseVersion: retrieval.knowledgeBaseVersion,
  }

  if (parsed?.rewrite && typeof parsed.rewrite === 'object') {
    response.rewrite = {
      title: cleanText(parsed.rewrite.title, 500),
      impact: cleanText(parsed.rewrite.impact, 1600),
      evidence: cleanText(parsed.rewrite.evidence, 1600),
    }
  }

  if (action === 'report_draft' && !response.draftMarkdown) throw new Error('AI_DRAFT_MISSING')
  if (action === 'win_rewrite' && !response.rewrite) throw new Error('AI_REWRITE_MISSING')
  if (!response.strengths.length && !response.stretch.length && !response.nextStep && !response.draftMarkdown && !response.rewrite) {
    throw new Error('AI_RESPONSE_EMPTY')
  }
  return response
}

export function buildRepairMessages(messages, invalidText, errorMessage) {
  return [
    ...messages,
    { role: 'assistant', content: String(invalidText ?? '').slice(0, 6000) },
    { role: 'user', content: `The previous response was invalid (${errorMessage}). Return the same answer again as valid JSON matching the required schema. Use only allowed criterion IDs.` },
  ]
}
