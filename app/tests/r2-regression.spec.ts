import { expect, test } from '@playwright/test'

type RenderNode = {
  kind: 'main' | 'projection'
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
}

type Snapshot = {
  mode: string | null
  nodes: Record<string, RenderNode[]>
  dashedOverlayLinks: number
}

function distance(a: { cx: number; cy: number } | null, b: { cx: number; cy: number } | null): number | null {
  if (!a || !b) {
    return null
  }
  return Math.round(Math.hypot(a.cx - b.cx, a.cy - b.cy))
}

function pickMain(nodes: RenderNode[]): RenderNode | null {
  return nodes.find((node) => node.kind === 'main') ?? null
}

function pickProjection(nodes: RenderNode[]): RenderNode | null {
  return nodes.find((node) => node.kind === 'projection') ?? null
}

test.describe.skip('Mode R2 regression (archived legacy suite)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/preview3', { waitUntil: 'networkidle' })
  })

  test('renders in Mode R2', async ({ page }) => {
    const mode = await page.locator('.preview3-mode-summary strong').textContent()
    expect(mode?.trim()).toBe('Mode R2: Virtual Raster Engine')
  })

  test('keeps Arwen near Elrond in main lineage and projected near Aragorn', async ({ page }) => {
    const snapshot = await captureSnapshot(page, ['Arwen', 'Elrond', 'Aragorn II'])

    expect(snapshot.mode).toBe('Mode R2: Virtual Raster Engine')
    expect(snapshot.nodes['Arwen']).toHaveLength(2)
    expect(snapshot.nodes['Elrond']).toHaveLength(2)
    expect(snapshot.nodes['Aragorn II']).toHaveLength(2)

    const arwenMain = pickMain(snapshot.nodes['Arwen'])
    const elrondMain = pickMain(snapshot.nodes['Elrond'])
    const aragornMain = pickMain(snapshot.nodes['Aragorn II'])
    const arwenProjection = pickProjection(snapshot.nodes['Arwen'])

    const mainDistance = distance(arwenMain, elrondMain)
    const projectionDistance = distance(arwenProjection, aragornMain)

    expect(mainDistance).not.toBeNull()
    expect(projectionDistance).not.toBeNull()
    expect(mainDistance!).toBeLessThanOrEqual(380)
    expect(projectionDistance!).toBeLessThanOrEqual(280)
  })

  test('keeps Aragorn centered between local Arathorn and local Gilraen projection', async ({ page }) => {
    const snapshot = await captureSnapshot(page, ['Aragorn II', 'Arathorn II', 'Gilraen'])

    const aragornMain = pickMain(snapshot.nodes['Aragorn II'])
    const arathornMain = pickMain(snapshot.nodes['Arathorn II'])
    const gilraenProjection = pickProjection(snapshot.nodes['Gilraen'])

    expect(aragornMain).not.toBeNull()
    expect(arathornMain).not.toBeNull()
    expect(gilraenProjection).not.toBeNull()

    const localMidpoint = ((arathornMain!.cx + gilraenProjection!.cx) / 2)
    const midpointDelta = Math.abs(aragornMain!.cx - localMidpoint)

    expect(midpointDelta).toBeLessThanOrEqual(24)
  })

  test('keeps spouse projections near partner for Silmariën/Elatan and Gilraen/Arathorn', async ({ page }) => {
    const snapshot = await captureSnapshot(page, ['Silmariën', 'Elatan', 'Gilraen', 'Arathorn II'])

    expect(snapshot.nodes['Silmariën']).toHaveLength(2)
    expect(snapshot.nodes['Elatan']).toHaveLength(2)
    expect(snapshot.nodes['Gilraen']).toHaveLength(2)
    expect(snapshot.nodes['Arathorn II']).toHaveLength(2)

    const silmarienProjection = pickProjection(snapshot.nodes['Silmariën'])
    const elatanMain = pickMain(snapshot.nodes['Elatan'])
    const gilraenProjection = pickProjection(snapshot.nodes['Gilraen'])
    const arathornMain = pickMain(snapshot.nodes['Arathorn II'])

    const silmarienToElatan = distance(silmarienProjection, elatanMain)
    const gilraenToArathorn = distance(gilraenProjection, arathornMain)

    expect(silmarienToElatan).not.toBeNull()
    expect(gilraenToArathorn).not.toBeNull()
    expect(silmarienToElatan!).toBeLessThanOrEqual(280)
    expect(gilraenToArathorn!).toBeLessThanOrEqual(280)
  })

  test('renders dashed overlay links from remote originals to local projections', async ({ page }) => {
    const snapshot = await captureSnapshot(page, ['Aragorn II'])
    expect(snapshot.dashedOverlayLinks).toBeGreaterThan(0)
  })
})

async function captureSnapshot(page: { evaluate: <T>(fn: () => T, arg?: unknown) => Promise<T> }, names: string[]): Promise<Snapshot> {
  return page.evaluate((targetNames: string[]) => {
    const parseTranslate = (value: string | null) => {
      if (!value) {
        return null
      }
      const match = value.match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/)
      if (!match) {
        return null
      }
      return { x: Number(match[1]), y: Number(match[2]) }
    }

    const collectNodes = (name: string): RenderNode[] => {
      const texts = Array.from(document.querySelectorAll('svg text'))
        .filter((node) => (node.textContent || '').trim() === name)

      return texts
        .map((textNode) => {
          const group = textNode.parentElement
          if (!group) {
            return null
          }

          const rect = group.querySelector(':scope > rect')
          if (!rect) {
            return null
          }

          const translation = parseTranslate(group.getAttribute('transform'))
          const width = Number(rect.getAttribute('width'))
          const height = Number(rect.getAttribute('height'))
          const x = translation ? translation.x : Number(rect.getAttribute('x'))
          const y = translation ? translation.y : Number(rect.getAttribute('y'))

          if (![x, y, width, height].every(Number.isFinite)) {
            return null
          }

          const kind: 'main' | 'projection' = translation ? 'projection' : 'main'
          return {
            kind,
            x,
            y,
            w: width,
            h: height,
            cx: x + width / 2,
            cy: y + height / 2,
          }
        })
        .filter((node): node is RenderNode => node !== null)
        .sort((left, right) => left.y - right.y || left.x - right.x)
    }

    const nodes = Object.fromEntries(targetNames.map((name) => [name, collectNodes(name)]))
    const dashedOverlayLinks = Array.from(document.querySelectorAll('svg line'))
      .filter((line) => (line.getAttribute('stroke-dasharray') || '').includes('5 7'))
      .length

    const modeNode = document.querySelector('.preview3-mode-summary strong')

    return {
      mode: modeNode ? (modeNode.textContent || '').trim() : null,
      nodes,
      dashedOverlayLinks,
    }
  }, names)
}
