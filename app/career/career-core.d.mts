export const STORAGE_KEY: string
export const LEGACY_STORAGE_KEY: string
export const SCHEMA_VERSION: number
export function createId(prefix?: string): string
export function todayIso(now?: Date): string
export function normalizeText(value?: string): string
export function suggestCompetencyIds(text: string, competencies: Array<{ id: string }>, keywordMap: Record<string, string[]>, limit?: number): string[]
export function computeInsights(state: unknown): {
  activeIdeas: number
  exploredIdeas: number
  wins: number
  reportReadyWins: number
  reports: number
  topCompetencies: Array<{ id: string; count: number }>
}
export function promoteIdeaToWin(idea: Record<string, unknown>, patch?: Record<string, unknown>): Record<string, unknown>
export function selectWinsForPeriod(wins: unknown[], start?: string, end?: string): unknown[]
export function buildReportMarkdown(input: {
  profile: Record<string, unknown>
  wins: unknown[]
  competencies: Array<{ id: string; shortTitle?: string; title: string }>
  periodLabel: string
  nextFocus?: string
}): string
export function pluralizeRu(value: number, one: string, few: string, many: string): string
export function createDefaultState(now?: Date): Record<string, any>
export function demoState(now?: Date): Record<string, any>
export function migrateState(raw: unknown, fallback?: Record<string, any>): Record<string, any>
