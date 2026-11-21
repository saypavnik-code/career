import type { ReviewLevel } from './review-rubric.mjs'

export const REVIEW_VERSION: 1
export const SELF_REVIEW_VERSION: 2
type ReviewVersion = typeof REVIEW_VERSION | typeof SELF_REVIEW_VERSION
export const LIMITS: Readonly<Record<'points' | 'point' | 'turns' | 'answer' | 'question' | 'sections' | 'diagnostics' | 'assessmentNote' | 'bytes', number>>
export const PEER_SECTIONS: readonly string[]

export type ReviewMode = 'self' | 'peer'
export type ReviewQuestion = { point: number; text: string }
export type ReviewTurn = ReviewQuestion & { answer: string | null }
export type CompetencyAssessment = {
  competencyId: string
  status: 'evidenced' | 'insufficient' | 'not_applicable'
  note: string
  criterionIds: string[]
  turnIds: number[]
}
export type ReviewRequest = {
  action: 'next' | 'draft'
  subject: string
  period: string
  points: string[]
  turns: ReviewTurn[]
} & (
  | { mode: 'self'; version: typeof SELF_REVIEW_VERSION; level: ReviewLevel }
  | { mode: 'peer'; version: typeof REVIEW_VERSION; matrix: [] }
)
type Coverage = { version: ReviewVersion; covered: number[]; missing: number[] }
export type ReviewResponse =
  | (Coverage & { kind: 'question'; question: ReviewQuestion })
  | (Coverage & { kind: 'ready' })
  | { version: ReviewVersion; kind: 'draft'; sections: { id: number; text: string }[]; diagnostics: string; assessment?: CompetencyAssessment[] }

export function validateReviewRequest(value: unknown): ReviewRequest
export function validateReviewResponse(value: unknown, request: ReviewRequest): ReviewResponse
