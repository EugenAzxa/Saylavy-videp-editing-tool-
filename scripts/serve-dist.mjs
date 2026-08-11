/**
 * Serves `dist/` with the exact headers from `vercel.json`.
 *
 * `vite preview` does not apply them, which means the production
 * Content-Security-Policy is otherwise never exercised until it is live. A
 * CSP that blocks your own bundle is a very bad thing to discover on the
 * domain you just sent to someone.
 *
 *   npm run build && npm run preview:prod
 *
 * `npm run test:prod` points Playwright at this and drives a real export
 * through it.
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const CONFIG = resolve(fileURLToPath(new URL('../vercel.json', import.meta.url)))
const PORT = Number(process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

const { headers: rules } = JSON.parse(await readFile(CONFIG, 'utf8'))

/** Vercel `source` patterns in this project are plain path regexes. */
function headersFor(pathname) {
  const applied = {}
  for (const rule of rules) {
    if (new RegExp(`^${rule.source}$`).test(pathname)) {
      for (const { key, value } of rule.headers) applied[key] = value
    }
  }
  return applied
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`)
  let pathname = decodeURIComponent(url.pathname)

  // Contain traversal: resolve, then confirm the result is still inside dist.
  let filePath = resolve(join(ROOT, normalize(pathname)))
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // Single page app: anything unresolved falls back to the document.
    filePath = join(ROOT, 'index.html')
    pathname = '/index.html'
  }

  try {
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream',
      ...headersFor(pathname),
    })
    response.end(body)
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(PORT, () => {
  console.log(`Serving dist/ with production headers on http://localhost:${PORT}`)
})
