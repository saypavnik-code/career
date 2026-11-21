export const REVIEW_HISTORY_KEY = 'escada:performance-review:v1'
const ENDPOINT_KEY = 'escada:review-agent:endpoint'
export const DEFAULT_REVIEW_ENDPOINT = 'http://127.0.0.1:8787/review'

export function parseReviewEndpoint(value: string): string {
  const endpoint = new URL(value.trim())
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && loopback))) {
    throw new Error('Invalid review gateway address')
  }
  return endpoint.href
}

export function readReviewEndpoint(storage: Storage): string {
  try {
    // A saved empty value intentionally disconnects a previously configured agent.
    const current = storage.getItem(ENDPOINT_KEY)
    const legacy = current === null ? JSON.parse(storage.getItem(REVIEW_HISTORY_KEY) ?? 'null')?.endpoint : null
    const value: unknown = current ?? legacy
    return typeof value === 'string' && value.trim() ? parseReviewEndpoint(value) : ''
  } catch {
    return ''
  }
}

export function saveReviewEndpoint(storage: Storage, endpoint: string) {
  storage.setItem(ENDPOINT_KEY, endpoint ? parseReviewEndpoint(endpoint) : '')
}
