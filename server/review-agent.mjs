import { createServer } from 'node:http'
import { LIMITS, validateReviewRequest, validateReviewResponse } from '../app/performance-review/review-contract.mjs'
import { buildReviewMessages } from './review-prompts.mjs'

const port = Number(process.env.ESCADA_REVIEW_PORT || 8787)
const model = process.env.ESCADA_REVIEW_MODEL?.trim()
const completionUrl = new URL(process.env.ESCADA_REVIEW_COMPLETIONS_URL || 'http://127.0.0.1:11434/v1/chat/completions')
const apiKey = process.env.ESCADA_REVIEW_API_KEY?.trim()
const origins = new Set((process.env.ESCADA_REVIEW_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',').map((value) => new URL(value.trim()).origin))

if (!model || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Set ESCADA_REVIEW_MODEL and a valid ESCADA_REVIEW_PORT before starting the review gateway')
}
if (!['http:', 'https:'].includes(completionUrl.protocol) || completionUrl.username || completionUrl.password) {
  throw new Error('Set an HTTP(S) URL without credentials in ESCADA_REVIEW_COMPLETIONS_URL')
}

function send(response, status, body) {
  response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readRequest(request) {
  const chunks = []
  let length = 0
  // Leaving the iterator early must let the server send a response before closing.
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length
    if (length > LIMITS.bytes) return null
    chunks.push(chunk)
  }
  return validateReviewRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')))
}

const server = createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (request, response) => {
  if (request.url !== '/review') return send(response, 404, { error: 'not_found' })
  const origin = request.headers.origin
  response.setHeader('Vary', 'Origin')
  if (!origins.has(origin)) return send(response, 403, { error: 'origin_denied' })
  response.setHeader('Access-Control-Allow-Origin', origin)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Private-Network': 'true',
      'Cache-Control': 'no-store',
    })
    response.end()
    return
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS')
    return send(response, 405, { error: 'method_not_allowed' })
  }
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return send(response, 415, { error: 'expected_json' })
  }
  if (Number(request.headers['content-length']) > LIMITS.bytes) {
    response.setHeader('Connection', 'close')
    return send(response, 413, { error: 'request_too_large' })
  }

  let payload
  try {
    payload = await readRequest(request)
  } catch {
    return send(response, 400, { error: 'invalid_request' })
  }
  if (payload === null) {
    response.setHeader('Connection', 'close')
    return send(response, 413, { error: 'request_too_large' })
  }

  const disconnected = new AbortController()
  response.once('close', () => {
    if (!response.writableFinished) disconnected.abort()
  })
  const timeout = AbortSignal.timeout(120000)
  const signal = AbortSignal.any([disconnected.signal, timeout])
  try {
    const completion = await fetch(completionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      redirect: 'error',
      signal,
      body: JSON.stringify({
        model,
        messages: buildReviewMessages(payload),
        stream: false,
        response_format: { type: 'json_object' },
      }),
    })
    if (!completion.ok) {
      await completion.body?.cancel()
      return send(response, 502, { error: 'model_unavailable' })
    }
    const result = await completion.json()
    const body = JSON.parse(result.choices?.[0]?.message?.content ?? '')
    return send(response, 200, validateReviewResponse(body, payload))
  } catch {
    if (response.destroyed) return
    return send(response, timeout.aborted ? 504 : 502, { error: timeout.aborted ? 'model_timeout' : 'invalid_model_response' })
  }
})

server.listen(port, '127.0.0.1', () => console.log(`Escada review gateway: http://127.0.0.1:${port}/review`))
