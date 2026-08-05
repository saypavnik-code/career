import {
  competencyKnowledge,
  competencyKeywords,
  levelLabels,
  levelOrder,
  nextLevel,
} from './competency-knowledge.mjs'

export type LevelKey = 'specialist' | 'senior' | 'lead'
export type CompetencyDomain = 'strategy' | 'craft' | 'leadership'

export interface Criterion {
  id: string
  text: string
  sourcePage: number
}

export interface Competency {
  id: string
  title: string
  shortTitle: string
  domain: CompetencyDomain
  summary: string
  levels: Record<LevelKey, Criterion[]>
}

export const competencies = competencyKnowledge as Competency[]
export { competencyKeywords, levelLabels, levelOrder, nextLevel }
