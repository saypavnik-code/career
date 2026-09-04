import type { Competency } from './career-data'
import type { CustomCompetencyScale } from './custom-scale'

export interface ActiveScale {
  competencies: Competency[]
  allCriteria: Array<{
    id: string
    text: string
    sourcePage: number
    competencyId: string
    competencyTitle: string
    competencyShortTitle: string
    level: 'specialist' | 'senior' | 'lead'
  }>
  competencyKeywords: Record<string, string[]>
  knowledgeBaseVersion: string
  isCustom: boolean
}

export function deriveActiveScale(customScale: CustomCompetencyScale | null): ActiveScale
