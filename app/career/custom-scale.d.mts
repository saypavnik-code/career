import type { Competency, LevelKey } from './career-data'

export type CustomScaleSourceType = 'text' | 'file'
export type CustomScaleStatus = 'draft' | 'parsing' | 'ready' | 'error'

export interface CustomCompetencyScale {
  id: string
  title: string
  sourceType: CustomScaleSourceType
  sourceFileName: string | null
  rawInput: string
  status: CustomScaleStatus
  competencies: Competency[] | null
  knowledgeBaseVersion: string | null
  parseNotes: string[]
  errorMessage: string | null
  createdAt: string
  isMock: true
}

export interface ParsedScaleResult {
  competencies: Competency[]
  knowledgeBaseVersion: string
  parseNotes: string[]
}

export function parseCustomScaleMock(
  rawText: string,
  title: string,
  now?: Date,
): ParsedScaleResult

export function createCustomScaleDraft(
  rawInput: string,
  sourceType: CustomScaleSourceType,
  sourceFileName: string | null,
  title: string,
  now?: Date,
): CustomCompetencyScale

export const CUSTOM_SCALE_MIN_CHARS: number
export const MOCK_PARSER_DISCLAIMER: string
