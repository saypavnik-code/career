export interface LocalGuidanceSource {
  id: string
  competencyTitle: string
  level: 'specialist' | 'senior' | 'lead'
  text: string
  sourcePage: number
}

export interface LocalGuidanceResponse {
  headline: string
  strengths: Array<{ text: string; criterionId: string }>
  stretch: Array<{ text: string; criterionId: string }>
  evidence: string[]
  nextStep: string
  rewrite: { title: string; impact: string; evidence: string } | null
  draftMarkdown: string | null
  caveat: string
  sources: LocalGuidanceSource[]
  knowledgeBaseVersion: string
}

export function buildLocalGuidance(
  action: string,
  payload: {
    profile: Record<string, unknown>
    artifact: Record<string, unknown>
    competencyIds?: string[]
  },
  activeScale?: import('./active-scale.mjs').ActiveScale,
): LocalGuidanceResponse
