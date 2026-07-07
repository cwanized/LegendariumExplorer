import { cp, readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function datasetPlugin() {
  const repoRoot = path.resolve(__dirname, '..')
  const datasetRoots = new Map([
    ['testing', path.join(repoRoot, 'datasets', 'testing')],
    ['demo', path.join(repoRoot, 'datasets', 'demo')],
    ['prod', path.join(repoRoot, 'datasets', 'prod')],
  ])

  return {
    name: 'legendarium-datasets',
    configureServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body: string) => void; statusCode: number }, next: () => void) => void) => void } }) {
      server.middlewares.use(createLegendariumMiddleware(datasetRoots))
    },
    configurePreviewServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body: string) => void; statusCode: number }, next: () => void) => void) => void } }) {
      server.middlewares.use(createLegendariumMiddleware(datasetRoots))
    },
    async closeBundle() {
      const distRoot = path.resolve(__dirname, 'dist', 'datasets')

      await Promise.all(
        Array.from(datasetRoots.entries()).map(async ([datasetName, datasetRoot]) => {
          await cp(datasetRoot, path.join(distRoot, datasetName), { recursive: true, force: true })
        }),
      )
    },
  }
}

function createLegendariumMiddleware(datasetRoots: Map<string, string>) {
  return async (
    req: { url?: string },
    res: { setHeader: (name: string, value: string) => void; end: (body: string) => void; statusCode: number },
    next: () => void,
  ) => {
    const requestUrl = req.url ?? ''

    if (requestUrl.startsWith('/datasets/')) {
      const sanitizedPath = requestUrl.split('?')[0]
      const [, , datasetName, ...restSegments] = sanitizedPath.split('/')
      const datasetRoot = datasetRoots.get(datasetName)

      if (!datasetRoot || restSegments.length === 0) {
        next()
        return
      }

      const targetPath = path.resolve(datasetRoot, ...restSegments)
      if (!targetPath.startsWith(datasetRoot)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }

      try {
        const content = await readFile(targetPath, 'utf8')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(content)
        return
      } catch {
        next()
        return
      }
    }

    if (!requestUrl.startsWith('/source-preview')) {
      next()
      return
    }

    const request = new URL(requestUrl, 'http://localhost')
    const rawUrl = request.searchParams.get('url')?.trim() ?? ''

    if (!rawUrl) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Missing url parameter.' }))
      return
    }

    let sourceUrl: URL

    try {
      sourceUrl = new URL(rawUrl)
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Invalid source URL.' }))
      return
    }

    if (!['http:', 'https:'].includes(sourceUrl.protocol)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Unsupported URL protocol.' }))
      return
    }

    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), 3500)

    try {
      const response = await fetch(sourceUrl, {
        headers: {
          'User-Agent': 'LegendariumExplorer/0.1 (+source preview)',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: `Upstream responded with ${response.status}.` }))
        return
      }

      const html = await response.text()
      const title = extractMetaContent(html, 'property', 'og:title')
        ?? extractMetaContent(html, 'name', 'twitter:title')
        ?? extractTitle(html)
      const description = extractMetaContent(html, 'property', 'og:description')
        ?? extractMetaContent(html, 'name', 'description')
        ?? extractMetaContent(html, 'name', 'twitter:description')

      if (!title) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'No usable preview data found.' }))
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({
        title,
        description: description ?? null,
        sourceHost: sourceUrl.host.replace(/^www\./, ''),
        sourceUrl: sourceUrl.toString(),
      }))
      return
    } catch {
      res.statusCode = 504
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Source preview request timed out or failed.' }))
      return
    } finally {
      clearTimeout(timeoutHandle)
    }
  }
}

function extractMetaContent(html: string, attributeName: string, attributeValue: string): string | null {
  const pattern = new RegExp(`<meta[^>]+${attributeName}=["']${escapeRegExp(attributeValue)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
  const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attributeName}=["']${escapeRegExp(attributeValue)}["'][^>]*>`, 'i')
  const match = html.match(pattern) ?? html.match(reversePattern)

  return match?.[1]?.trim() ? decodeHtmlEntities(match[1].trim()) : null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match?.[1]?.trim() ? decodeHtmlEntities(match[1].trim()) : null
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// https://vite.dev/config/
export default defineConfig({
  publicDir: false,
  plugins: [react(), datasetPlugin()],
})
