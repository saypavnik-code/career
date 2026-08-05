export type AiAction = 'idea_review' | 'win_rewrite' | 'report_draft' | 'report_review' | 'growth_guidance'
export interface AiPayload { action: AiAction; profile: Record<string, unknown>; artifact?: Record<string, unknown>; context?: Record<string, unknown>; competencyIds?: string[] }
export interface Retrieval { knowledgeBaseVersion: string; currentLevel: string; targetLevel: string | null; competencyIds: string[]; criteria: Array<Record<string, unknown>> }
export const AI_ACTIONS: AiAction[]
export function validateAiRequest(payload: unknown): AiPayload
export function retrieveCriteria(payload: AiPayload): Retrieval
export function buildClosedWorldMessages(payload: AiPayload, retrieval: Retrieval): Array<{ role: string; content: string }>
export function parseAndValidateAiResponse(rawText: unknown, retrieval: Retrieval, action: AiAction): Record<string, unknown>
export function buildRepairMessages(messages: Array<{ role: string; content: string }>, invalidText: unknown, errorMessage: string): Array<{ role: string; content: string }>
