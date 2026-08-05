import { NextRequest, NextResponse } from 'next/server'
import {
  buildClosedWorldMessages,
  buildRepairMessages,
  parseAndValidateAiResponse,
  retrieveCriteria,
  validateAiRequest,
} from '../../career/ai-contract.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 20
const REQUEST_TIMEOUT_MS = 45_000
const rateBuckets = new Map<string, number[]>()

function clientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'local'
}

function consumeRateLimit(key: string) {
  const now = Date.now()
  const recent = (rateBuckets.get(key) ?? []).filter((time) => now - time < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS) return false
  recent.push(now)
  rateBuckets.set(key, recent)
  return true
}

function providerContent(data: unknown) {
  const message = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
  if (typeof message === 'string') return message
  if (Array.isArray(message)) {
    return message.map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part) return String((part as { text: unknown }).text ?? '')
      return ''
    }).join('')
  }
  return ''
}

async function callProvider(messages: Array<{ role: string; content: string }>) {
  const baseUrl = process.env.ESCADA_AI_BASE_URL?.replace(/\/$/, '')
  const model = process.env.ESCADA_AI_MODEL
  const apiKey = process.env.ESCADA_AI_API_KEY
  if (!baseUrl || !model) {
    throw new Error('AI_NOT_CONFIGURED')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.15,
        max_tokens: 1800,
      }),
      cache: 'no-store',
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`AI_PROVIDER_${response.status}:${text.slice(0, 400)}`)
    }
    const data = JSON.parse(text) as unknown
    const content = providerContent(data)
    if (!content) throw new Error('AI_PROVIDER_EMPTY')
    return content
  } finally {
    clearTimeout(timer)
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
  if (message === 'AI_NOT_CONFIGURED') {
    return NextResponse.json({
      error: 'AI_NOT_CONFIGURED',
      message: 'AI-провайдер ещё не настроен на сервере. Добавьте ESCADA_AI_BASE_URL и ESCADA_AI_MODEL.',
    }, { status: 503 })
  }
  if (message === 'REQUEST_TOO_LARGE') return NextResponse.json({ error: message, message: 'Выбранный контекст слишком большой.' }, { status: 413 })
  if (message.startsWith('INVALID_') || message === 'PROFILE_REQUIRED') return NextResponse.json({ error: message, message: 'Некорректный запрос.' }, { status: 400 })
  console.error('[Escada AI]', message)
  return NextResponse.json({ error: 'AI_REQUEST_FAILED', message: 'Не удалось получить подсказку. Попробуйте ещё раз.' }, { status: 502 })
}

export async function POST(request: NextRequest) {
  if (!consumeRateLimit(clientKey(request))) {
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'Слишком много запросов. Попробуйте немного позже.' }, { status: 429 })
  }

  try {
    const payload = validateAiRequest(await request.json())
    const retrieval = retrieveCriteria(payload)
    const messages = buildClosedWorldMessages(payload, retrieval)
    let raw = await callProvider(messages)
    try {
      return NextResponse.json(parseAndValidateAiResponse(raw, retrieval, payload.action))
    } catch (firstError) {
      raw = await callProvider(buildRepairMessages(messages, raw, firstError instanceof Error ? firstError.message : 'invalid response'))
      return NextResponse.json(parseAndValidateAiResponse(raw, retrieval, payload.action))
    }
  } catch (error) {
    return errorResponse(error)
  }
}
