// v32: single seam that decides which competency scale AI retrieval reads
// from — the built-in Bitrix24 scale, or a user-uploaded custom scale once
// it has status 'ready'. Both ai-contract.mjs and local-guidance.mjs take
// the result of deriveActiveScale() as a parameter instead of importing
// competency-knowledge.mjs directly, so retrieval always matches whatever
// scale the rest of the UI (ScaleReference, computeGrowthPath) is showing.
import {
  competencyKnowledge,
  competencyKeywords as defaultCompetencyKeywords,
  knowledgeBaseVersion as defaultKnowledgeBaseVersion,
  levelOrder,
} from './competency-knowledge.mjs'

const STOPWORDS = new Set([
  'и', 'в', 'во', 'не', 'на', 'с', 'со', 'что', 'а', 'по', 'к', 'у', 'из', 'от', 'до', 'за',
  'о', 'об', 'для', 'как', 'это', 'при', 'через', 'но', 'или', 'же', 'уже', 'бы', 'ли', 'то',
  'так', 'вы', 'мы', 'он', 'она', 'они', 'его', 'её', 'их', 'себя', 'свой', 'своей', 'своих',
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'is', 'are', 'for', 'on', 'in',
])

function toAllCriteria(competencies) {
  return competencies.flatMap((competency) =>
    levelOrder.flatMap((level) => (competency.levels[level] ?? []).map((criterion) => ({
      ...criterion,
      competencyId: competency.id,
      competencyTitle: competency.title,
      competencyShortTitle: competency.shortTitle,
      level,
    }))),
  )
}

// Custom scales don't come with hand-picked keywords like the built-in scale
// does (competency-knowledge.mjs's competencyKeywords was curated by hand).
// This derives a rough equivalent: the most frequent non-trivial words across
// a competency's own criterion text, which is enough for retrieveCriteria's
// keyword-overlap scoring to have something to work with.
function deriveKeywordsForCompetency(competency) {
  const text = levelOrder
    .flatMap((level) => (competency.levels[level] ?? []).map((criterion) => criterion.text))
    .join(' ')
  const words = text
    .toLocaleLowerCase('ru-RU')
    .replace(/[^a-zа-яё0-9\s]+/giu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word))

  const counts = new Map()
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word)
}

function deriveCustomKeywords(competencies) {
  const result = {}
  for (const competency of competencies) {
    result[competency.id] = deriveKeywordsForCompetency(competency)
  }
  return result
}

/**
 * Returns { competencies, allCriteria, competencyKeywords, knowledgeBaseVersion, isCustom }
 * for whichever scale is currently active. Pass the result to retrieveCriteria
 * (ai-contract.mjs) and buildLocalGuidance (local-guidance.mjs).
 */
export function deriveActiveScale(customScale) {
  const isCustom = Boolean(customScale?.status === 'ready' && customScale.competencies?.length)
  if (!isCustom) {
    return {
      competencies: competencyKnowledge,
      allCriteria: toAllCriteria(competencyKnowledge),
      competencyKeywords: defaultCompetencyKeywords,
      knowledgeBaseVersion: defaultKnowledgeBaseVersion,
      isCustom: false,
    }
  }
  return {
    competencies: customScale.competencies,
    allCriteria: toAllCriteria(customScale.competencies),
    competencyKeywords: deriveCustomKeywords(customScale.competencies),
    knowledgeBaseVersion: customScale.knowledgeBaseVersion ?? 'custom-scale-unknown-version',
    isCustom: true,
  }
}
