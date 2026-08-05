export type LevelKey = 'specialist' | 'senior' | 'lead'
export type CompetencyDomain = 'strategy' | 'craft' | 'leadership'
export interface Criterion { id: string; text: string; sourcePage: number }
export interface CompetencyKnowledge {
  id: string
  title: string
  shortTitle: string
  domain: CompetencyDomain
  summary: string
  levels: Record<LevelKey, Criterion[]>
}
export interface FlatCriterion extends Criterion {
  competencyId: string
  competencyTitle: string
  competencyShortTitle: string
  level: LevelKey
}
export const knowledgeBaseVersion: string
export const levelOrder: LevelKey[]
export const levelLabels: Record<LevelKey, string>
export const competencyKnowledge: CompetencyKnowledge[]
export const competencyKeywords: Record<string, string[]>
export const allCriteria: FlatCriterion[]
export function findCriterion(criterionId: string): FlatCriterion | null
export function getCompetency(competencyId: string): CompetencyKnowledge | null
export function nextLevel(level: LevelKey): LevelKey | null
