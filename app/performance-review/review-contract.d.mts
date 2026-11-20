export const REVIEW_VERSION: 1
export const LIMITS: Readonly<Record<'points' | 'point' | 'turns' | 'answer' | 'question' | 'sections' | 'diagnostics' | 'criteria' | 'bytes', number>>
export const PEER_SECTIONS: readonly string[]

export type ReviewMode = 'self' | 'peer'
export type ReviewQuestion = { point: number; text: string }
export type ReviewTurn = ReviewQuestion & { answer: string | null }
export type ReviewCriterion = {
  id: string
  competency: string
  level: 'specialist' | 'senior' | 'lead'
  text: string
}
export type ReviewRequest = {
  version: typeof REVIEW_VERSION
  action: 'next' | 'draft'
  mode: ReviewMode
  subject: string
  period: string
  points: string[]
  matrix: ReviewCriterion[]
  turns: ReviewTurn[]
}
type Coverage = { version: typeof REVIEW_VERSION; covered: number[]; missing: number[] }
export type ReviewResponse =
  | (Coverage & { kind: 'question'; question: ReviewQuestion })
  | (Coverage & { kind: 'ready' })
  | { version: typeof REVIEW_VERSION; kind: 'draft'; sections: { id: number; text: string }[]; diagnostics: string }

export function validateReviewRequest(value: unknown): ReviewRequest
export function validateReviewResponse(value: unknown, request: ReviewRequest): ReviewResponse
