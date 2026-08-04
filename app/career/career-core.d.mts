export const STORAGE_KEY: string
export const PREVIOUS_STORAGE_KEYS: string[]
export const LEGACY_STORAGE_KEY: string
export const SCHEMA_VERSION: number
export function createId(prefix?: string): string
export function todayIso(now?: Date): string
export function normalizeText(value?: string): string
export function suggestCompetencyIds(text: string, competencies: unknown[], keywordMap: Record<string, string[]>, limit?: number): string[]
export function inferLevelSignal(text: string, fallback?: string): { level: string; reason: string }
export function parseBehaviorRef(ref: string): { competencyId: string; level: string; index: number }
export function suggestBehaviorRefs(text: string, competencyIds: string[], competencies: unknown[], level: string, limit?: number): string[]
export function computeInsights(state: Record<string, unknown>): {
  activeIdeas: number; exploredIdeas: number; wins: number; reportReadyWins: number; reports: number; completedWork: number; topCompetencies: Array<{ id: string; count: number }>
}
export function promoteIdeaToWin(idea: Record<string, unknown>, patch?: Record<string, unknown>): Record<string, unknown>
export function selectWinsForPeriod(wins: unknown[], start: string, end: string): unknown[]
export function buildReportMarkdown(input: Record<string, unknown>): string
export function pluralizeRu(value: number, one: string, few: string, many: string): string
export function computeProgress(state: Record<string, unknown>, competencies: unknown[]): Record<string, unknown>
export function buildCoachNotes(state: Record<string, unknown>, competencies: unknown[], now?: Date): Array<Record<string, unknown>>
export function createDefaultState(now?: Date): Record<string, unknown>
export function demoState(now?: Date): Record<string, unknown>
export function migrateState(raw: Record<string, unknown> | null, fallback?: Record<string, unknown>): Record<string, unknown>
