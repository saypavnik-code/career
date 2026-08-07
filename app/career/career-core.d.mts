export const STORAGE_KEY: string
export const PREVIOUS_STORAGE_KEYS: string[]
export const LEGACY_STORAGE_KEY: string
export const SCHEMA_VERSION: number
export function createId(prefix?: string): string
export function todayIso(now?: Date): string
export function normalizeText(value?: string): string
export function suggestCompetencyIds(text: string, competencies: unknown[], keywordMap: Record<string, string[]>, limit?: number): string[]
export function inferLevelSignal(text: string, fallback?: string): { level: 'specialist' | 'senior' | 'lead'; reason: string }
export function parseBehaviorRef(ref: string): { competencyId: string; level: string; index: number }
export function suggestBehaviorRefs(text: string, competencyIds: string[], competencies: unknown[], level: string, limit?: number): string[]
export function computeInsights(state: Record<string, unknown>): Record<string, number | unknown[]>
export function promoteIdeaToWin(idea: Record<string, unknown>, patch?: Record<string, unknown>): Record<string, unknown>
export function selectWinsForPeriod(wins: unknown[], start: string, end: string): unknown[]
export function buildReportMarkdown(args: Record<string, unknown>): string
export function pluralizeRu(value: number, one: string, few: string, many: string): string
export function computeProgress(state: Record<string, unknown>, competencies: unknown[]): Record<string, unknown>
export function buildCoachNotes(state: Record<string, unknown>, competencies: unknown[], now?: Date): unknown[]
export function createDefaultState(now?: Date): Record<string, unknown>
export function demoState(now?: Date): Record<string, unknown>
export function migrateState(raw: unknown, fallback?: Record<string, unknown>): Record<string, unknown>
export function classifyCapture(text: string): { kind: 'idea' | 'win' | 'note'; reason: string }
export function createCapture(text: string, now?: Date): Record<string, unknown>
export function captureToIdea(capture: Record<string, unknown>, currentLevel?: string): Record<string, unknown>
export function captureToWinDraft(capture: Record<string, unknown>): Record<string, unknown>
export function deriveNoteTitle(rawText: string): { title: string; body: string }
export function createNote(rawText: string, now?: Date): Record<string, unknown> | null
export function noteToIdea(note: Record<string, unknown>, currentLevel?: string): { idea: Record<string, unknown>; note: Record<string, unknown> }
export function winGapHints(win: Record<string, unknown>): string[]
export function deleteWin(state: Record<string, unknown>, winId: string): Record<string, unknown>
export function computeGrowthPath(state: Record<string, unknown>, competencies: unknown[]): Record<string, unknown>
