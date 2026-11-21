export type ReviewLevel = 'junior' | 'specialist' | 'senior' | 'lead'
export type RubricCriterion = { id: string; text: string; sourcePage?: number }
export type RubricCompetency = {
  id: string
  title: string
  criteria: readonly RubricCriterion[]
  nextCriteria: readonly RubricCriterion[]
}
export type ReviewRubric = {
  version: string
  level: ReviewLevel
  label: string
  source: 'working_guidance' | 'pdf'
  nextLevel: ReviewLevel | null
  nextLevelLabel: string | null
  competencies: RubricCompetency[]
}

export const REVIEW_RUBRIC_VERSION: string
export const REVIEW_LEVEL_LABELS: Readonly<Record<ReviewLevel, string>>
export function isReviewLevel(value: unknown): value is ReviewLevel
export function getReviewRubric(level: ReviewLevel): ReviewRubric
