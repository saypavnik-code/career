import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.cwd()
const outDir = join(root, 'out')
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const isUserSite = repository.endsWith('.github.io')
const basePath = isGitHubActions && repository && !isUserSite ? `/${repository}` : ''

function collect(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? collect(path) : [path]
  })
}

function asUrl(relativePath) {
  const path = relativePath.split(sep).join('/')
  if (path === 'index.html') return `${basePath}/`
  if (path.endsWith('/index.html')) return `${basePath}/${path.slice(0, -'index.html'.length)}`
  return `${basePath}/${path}`
}

const files = collect(outDir)
  .map((file) => relative(outDir, file))
  .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
  .sort()
const precacheUrls = [...new Set(files.map(asUrl))]
const fingerprint = createHash('sha256')
for (const file of files) {
  fingerprint.update(file)
  fingerprint.update(readFileSync(join(outDir, file)))
}
const version = fingerprint.digest('hex').slice(0, 16)
const shellUrl = `${basePath}/`

const serviceWorker = `// escada-pwa-shell-v29 — generated after static export; do not edit by hand.\n` +
`const CACHE_NAME = ${JSON.stringify(`escada-shell-${version}`)};\n` +
`const BASE_PATH = ${JSON.stringify(basePath)};\n` +
`const APP_SHELL_URL = ${JSON.stringify(shellUrl)};\n` +
`const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};\n\n` +
`self.addEventListener('install', (event) => {\n` +
`  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));\n` +
`});\n\n` +
`self.addEventListener('activate', (event) => {\n` +
`  event.waitUntil(Promise.all([\n` +
`    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('escada-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))),\n` +
`    self.clients.claim(),\n` +
`  ]));\n` +
`});\n\n` +
`self.addEventListener('message', (event) => {\n` +
`  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();\n` +
`});\n\n` +
`function remember(request, response) {\n` +
`  if (!response || !response.ok || response.type === 'opaque') return response;\n` +
`  const copy = response.clone();\n` +
`  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));\n` +
`  return response;\n` +
`}\n\n` +
`self.addEventListener('fetch', (event) => {\n` +
`  const request = event.request;\n` +
`  if (request.method !== 'GET') return;\n` +
`  const url = new URL(request.url);\n` +
`  if (url.origin !== self.location.origin) return;\n` +
`  if (BASE_PATH && !url.pathname.startsWith(BASE_PATH + '/')) return;\n\n` +
`  if (request.mode === 'navigate') {\n` +
`    event.respondWith(fetch(request).then((response) => remember(request, response)).catch(async () => {\n` +
`      return (await caches.match(request)) || (await caches.match(APP_SHELL_URL));\n` +
`    }));\n` +
`    return;\n` +
`  }\n\n` +
`  const isStatic = url.pathname.includes('/_next/static/') || /\\.(?:css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname);\n` +
`  if (isStatic) {\n` +
`    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => remember(request, response))));\n` +
`    return;\n` +
`  }\n\n` +
`  event.respondWith(fetch(request).then((response) => remember(request, response)).catch(() => caches.match(request)));\n` +
`});\n`

writeFileSync(join(outDir, 'sw.js'), serviceWorker)
console.log(`PWA service worker: ${precacheUrls.length} URLs, cache ${version}, basePath ${basePath || '/'}`)
