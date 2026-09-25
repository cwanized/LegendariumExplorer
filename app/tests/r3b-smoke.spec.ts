import { expect, test } from '@playwright/test'

const STORAGE_KEY = 'legendarium.preview3.preferences.v1'

function buildStoredPreferences() {
  return {
    version: 1,
    datasetName: 'demo',
    activePage: 'family-tree',
    treeMode: 'modeR3B',
    followRulerLine: false,
    overlayEnabled: true,
    debugOverlaysEnabled: false,
    pageTheme: {
      mode: 'light',
      preset: 'custom',
      custom: {},
      fontBody: 'Aptos, Segoe UI Variable, Trebuchet MS, sans-serif',
      fontDisplay: 'Iowan Old Style, Palatino Linotype, Book Antiqua, serif',
    },
    treeTheme: {
      mode: 'light',
      preset: 'custom',
      custom: {},
      fontBody: 'Aptos, Segoe UI Variable, Trebuchet MS, sans-serif',
      fontDisplay: 'Iowan Old Style, Palatino Linotype, Book Antiqua, serif',
    },
    leftPanel: { collapsed: false, undocked: false, x: 24, y: 84, width: 336, height: 640 },
    rightPanel: { collapsed: false, undocked: false, x: 820, y: 84, width: 336, height: 640 },
    legendMinimized: false,
    wideMode: false,
    filterLogic: 'or',
    showInTree: true,
    fadeMode: 'dim',
    filters: { houses: [], species: [], genders: [], eras: [] },
    searchQuery: '',
  }
}

async function gotoR3BWithPreferences(page: import('@playwright/test').Page) {
  await page.addInitScript(({ key, payload }) => {
    window.localStorage.setItem(key, JSON.stringify(payload))
  }, { key: STORAGE_KEY, payload: buildStoredPreferences() })

  await page.goto('/preview3', { waitUntil: 'networkidle' })
}

function countLabelMatches(texts: string[], fragment: string): number {
  const needle = fragment.toLowerCase()
  return texts.filter((text) => text.toLowerCase().includes(needle)).length
}

async function getProjectionSnapshot(page: import('@playwright/test').Page) {
  return page.locator('svg.preview3-graph').evaluate((svg) => {
    return Array.from(svg.querySelectorAll('g')).flatMap((group) => {
      const transform = group.getAttribute('transform') ?? ''
      const rect = group.querySelector(':scope > rect[rx="16"]')
      const label = group.querySelector(':scope > text.preview3-svg-name')
      if (!transform.startsWith('translate(') || !rect || !label) {
        return []
      }

      return [{
        label: (label.textContent || '').trim(),
        transform,
      }]
    }).sort((left, right) => left.label.localeCompare(right.label) || left.transform.localeCompare(right.transform))
  })
}

test.describe('Mode R3B smoke', () => {
  test.beforeEach(async ({ page }) => {
    await gotoR3BWithPreferences(page)
  })

  test('renders in Mode R3B', async ({ page }) => {
    const mode = await page.locator('.preview3-mode-summary strong').textContent()
    expect(mode?.trim()).toBe('Mode R3B: Structured Raster Engine v2')
  })

  test('shows start-house anchors in R3B', async ({ page }) => {
    const labels = await page.locator('svg text').evaluateAll((nodes) => {
      return nodes
        .map((node) => (node.textContent || '').trim())
        .filter((text) => text.length > 0)
    })

    expect(labels).toContain('Minyar and Vanyar line')
    expect(labels).toContain('Tatyar and Noldor line')
    expect(labels).toContain('Nelyar and Teleri line')
  })

  test('keeps seeded house y-offset separation after subtree stabilization', async ({ page }) => {
    const positions = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const getAbsoluteTextY = (label: string) => {
        const text = Array.from(svg.querySelectorAll('text')).find((node) => (node.textContent || '').trim() === label) as SVGTextElement | undefined
        if (!text) {
          return null
        }

        const matrix = text.getCTM()
        const localY = Number(text.getAttribute('y') ?? 'NaN')
        if (!matrix || !Number.isFinite(localY)) {
          return null
        }

        return matrix.f + localY
      }

      return {
        beor: getAbsoluteTextY('House of Beor'),
        eorl: getAbsoluteTextY('House of Eorl'),
      }
    })

    expect(positions.beor).not.toBeNull()
    expect(positions.eorl).not.toBeNull()
    expect(positions.eorl as number).toBeGreaterThan(positions.beor as number)
  })

  test('keeps Hurin and Huor family blocks local to their spouse projections', async ({ page }) => {
    const positions = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const getNode = (personId: string) => {
        const group = svg.querySelector(`g[data-person-id="${personId}"]`)
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return null
        }

        const x = Number(rect.getAttribute('x') ?? 'NaN')
        const width = Number(rect.getAttribute('width') ?? 'NaN')
        const y = Number(rect.getAttribute('y') ?? 'NaN')
        const height = Number(rect.getAttribute('height') ?? 'NaN')
        if (!Number.isFinite(x) || !Number.isFinite(width) || !Number.isFinite(y) || !Number.isFinite(height)) {
          return null
        }

        return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 }
      }

      const getProjection = (label: string, side: 'left' | 'right') => {
        const matches = Array.from(svg.querySelectorAll('g')).flatMap((group) => {
          const transform = group.getAttribute('transform') ?? ''
          const rect = group.querySelector(':scope > rect[rx="16"]') as SVGRectElement | null
          const name = group.querySelector(':scope > text.preview3-svg-name')
          if (!transform.startsWith('translate(') || !rect || !name || (name.textContent || '').trim() !== label) {
            return []
          }

          const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(transform)
          if (!match) {
            return []
          }

          const x = Number(match[1])
          const y = Number(match[2])
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          const height = Number(rect.getAttribute('height') ?? 'NaN')
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
            return []
          }

          return [{ x, y, width, height, cx: x + width / 2, cy: y + height / 2 }]
        })

        if (matches.length === 0) {
          return null
        }

        return matches.sort((left, right) => side === 'right' ? left.x - right.x : right.x - left.x)[0]
      }

      return {
        morwen: getNode('b7c4a2f1-6d9e-4b31-8f72-1a9c5e440101'),
        hurin: getNode('550e8400-e29b-41d4-a716-446655440022'),
        rian: getNode('6eaf1023-d415-4179-8ca5-4c6b8fa90006'),
        huor: getNode('5d9eaf01-c304-4068-bf94-3b5a7e980005'),
        tuor: getNode('3b7c8d9e-a1f2-4e46-9d72-1f3e5c760003'),
        turin: getNode('b7c4a2f1-6d9e-4b31-8f72-1a9c5e440102'),
        nienor: getNode('b7c4a2f1-6d9e-4b31-8f72-1a9c5e440103'),
        hurinProjectionNearMorwen: getProjection('Hurin', 'right'),
        huorProjectionNearRian: getProjection('Huor', 'right'),
        morwenProjectionNearHurin: getProjection('Morwen', 'left'),
        rianProjectionNearHuor: getProjection('Rían', 'left'),
      }
    })

    expect(positions.morwen).not.toBeNull()
    expect(positions.hurin).not.toBeNull()
    expect(positions.rian).not.toBeNull()
    expect(positions.huor).not.toBeNull()
    expect(positions.tuor).not.toBeNull()
    expect(positions.turin).not.toBeNull()
    expect(positions.nienor).not.toBeNull()
    expect(positions.hurinProjectionNearMorwen).not.toBeNull()
    expect(positions.huorProjectionNearRian).not.toBeNull()
    expect(positions.morwenProjectionNearHurin).not.toBeNull()
    expect(positions.rianProjectionNearHuor).not.toBeNull()

    expect((positions.hurinProjectionNearMorwen as { cx: number }).cx).toBeGreaterThan((positions.morwen as { cx: number }).cx)
    expect((positions.hurinProjectionNearMorwen as { cx: number }).cx - (positions.morwen as { cx: number }).cx).toBeLessThan(240)
    expect((positions.huorProjectionNearRian as { cx: number }).cx).toBeGreaterThan((positions.rian as { cx: number }).cx)
    expect((positions.huorProjectionNearRian as { cx: number }).cx - (positions.rian as { cx: number }).cx).toBeLessThan(240)
    expect((positions.morwenProjectionNearHurin as { cx: number }).cx).toBeLessThan((positions.hurin as { cx: number }).cx)
    expect((positions.hurin as { cx: number }).cx - (positions.morwenProjectionNearHurin as { cx: number }).cx).toBeLessThan(240)
    expect((positions.rianProjectionNearHuor as { cx: number }).cx).toBeLessThan((positions.huor as { cx: number }).cx)
    expect((positions.huor as { cx: number }).cx - (positions.rianProjectionNearHuor as { cx: number }).cx).toBeLessThan(240)
    expect((positions.morwen as { x: number }).x).toBeGreaterThanOrEqual(40)
    expect((positions.hurin as { x: number }).x).toBeGreaterThanOrEqual(40)
    const hurinVisibleMidX = ((positions.hurin as { cx: number }).cx + (positions.morwenProjectionNearHurin as { cx: number }).cx) / 2
    const hurinChildBandMidX = ((positions.turin as { cx: number }).cx + (positions.nienor as { cx: number }).cx) / 2
    expect(Math.abs(hurinChildBandMidX - hurinVisibleMidX)).toBeLessThan(90)

    const huorVisibleMidX = ((positions.huor as { cx: number }).cx + (positions.rianProjectionNearHuor as { cx: number }).cx) / 2
    expect(Math.abs((positions.tuor as { cx: number }).cx - huorVisibleMidX)).toBeLessThan(90)
    expect((positions.turin as { cx: number }).cx).toBeLessThan((positions.nienor as { cx: number }).cx)

    const overlaps = (left: { x: number; width: number }, right: { x: number; width: number }) => {
      return left.x < right.x + right.width && right.x < left.x + left.width
    }

    expect(overlaps(
      positions.hurinProjectionNearMorwen as { x: number; width: number },
      positions.rian as { x: number; width: number },
    )).toBe(false)
    expect(overlaps(
      positions.huorProjectionNearRian as { x: number; width: number },
      positions.hurinProjectionNearMorwen as { x: number; width: number },
    )).toBe(false)
  })

  test('keeps Elrond and Elros separated and centers their descendant blocks', async ({ page }) => {
    const positions = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const getNode = (personId: string) => {
        const group = svg.querySelector(`g[data-person-id="${personId}"]`)
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return null
        }

        const x = Number(rect.getAttribute('x') ?? 'NaN')
        const width = Number(rect.getAttribute('width') ?? 'NaN')
        const y = Number(rect.getAttribute('y') ?? 'NaN')
        const height = Number(rect.getAttribute('height') ?? 'NaN')
        if (!Number.isFinite(x) || !Number.isFinite(width) || !Number.isFinite(y) || !Number.isFinite(height)) {
          return null
        }

        return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 }
      }

      const getProjection = (label: string, side: 'left' | 'right') => {
        const matches = Array.from(svg.querySelectorAll('g')).flatMap((group) => {
          const transform = group.getAttribute('transform') ?? ''
          const rect = group.querySelector(':scope > rect[rx="16"]') as SVGRectElement | null
          const name = group.querySelector(':scope > text.preview3-svg-name')
          if (!transform.startsWith('translate(') || !rect || !name || (name.textContent || '').trim() !== label) {
            return []
          }

          const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(transform)
          if (!match) {
            return []
          }

          const x = Number(match[1])
          const y = Number(match[2])
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          const height = Number(rect.getAttribute('height') ?? 'NaN')
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
            return []
          }

          return [{ x, y, width, height, cx: x + width / 2, cy: y + height / 2 }]
        })

        if (matches.length === 0) {
          return null
        }

        return matches.sort((left, right) => side === 'right' ? left.x - right.x : right.x - left.x)[0]
      }

      return {
        elrond: getNode('550e8400-e29b-41d4-a716-446655440006'),
        elros: getNode('8cf5f5c9-3d67-4311-8d85-a9a9ff76ef11'),
        vardame: getNode('d40dea93-09ac-4950-8051-0556ad3c40a1'),
        celebrianProjectionNearElrond: getProjection('Celebrian', 'right'),
        elladan: getNode('c8f580da-37a5-41b3-a792-a4a45a89d0c8'),
        elrohir: getNode('1a71c783-4611-43c2-997e-e1c31650516b'),
        arwen: getNode('550e8400-e29b-41d4-a716-446655440004'),
      }
    })

    expect(positions.elrond).not.toBeNull()
    expect(positions.elros).not.toBeNull()
    expect(positions.vardame).not.toBeNull()
    expect(positions.celebrianProjectionNearElrond).not.toBeNull()
    expect(positions.elladan).not.toBeNull()
    expect(positions.elrohir).not.toBeNull()
    expect(positions.arwen).not.toBeNull()

    expect((positions.elros as { cx: number }).cx - (positions.elrond as { cx: number }).cx).toBeGreaterThan(620)
    expect(Math.abs((positions.vardame as { cx: number }).cx - (positions.elros as { cx: number }).cx)).toBeLessThan(90)
    expect((positions.elrond as { x: number }).x).toBeGreaterThanOrEqual(40)
    expect((positions.elros as { x: number }).x).toBeGreaterThanOrEqual(40)

    const elrondVisibleMidX = ((positions.elrond as { cx: number }).cx + (positions.celebrianProjectionNearElrond as { cx: number }).cx) / 2
    const elrondChildBandMidX = ((positions.elladan as { cx: number }).cx + (positions.arwen as { cx: number }).cx) / 2
    expect(Math.abs(elrondChildBandMidX - elrondVisibleMidX)).toBeLessThan(90)
    expect((positions.elladan as { cx: number }).cx).toBeLessThan((positions.elrohir as { cx: number }).cx)
    expect((positions.elrohir as { cx: number }).cx).toBeLessThan((positions.arwen as { cx: number }).cx)
  })

  test('keeps Feanor descendants grouped apart from cousin blocks on the same row', async ({ page }) => {
    const rowState = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const targetNames = new Set([
        'Maedhros',
        'Maglor',
        'Celegorm',
        'Caranthir',
        'Curufin',
        'Amrod',
        'Amras',
        'Fingon',
        'Turgon',
        'Aredhel',
        'Angrod',
        'Aegnor',
        'Galadriel',
      ])

      const nodes = Array.from(svg.querySelectorAll('g[data-person-id]'))
        .map((group) => {
          const rect = group.querySelector('rect[rx="18"]') as SVGRectElement | null
          const label = group.querySelector('text.preview3-svg-name')
          if (!rect || !label) {
            return null
          }

          const name = (label.textContent || '').trim()
          if (!targetNames.has(name)) {
            return null
          }

          const x = Number(rect.getAttribute('x') ?? 'NaN')
          const y = Number(rect.getAttribute('y') ?? 'NaN')
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width)) {
            return null
          }

          return {
            name,
            x,
            y,
            width,
            cx: x + width / 2,
          }
        })
        .filter((node): node is { name: string; x: number; y: number; width: number; cx: number } => node !== null)

      const feanorChildren = nodes
        .filter((node) => ['Maedhros', 'Maglor', 'Celegorm', 'Caranthir', 'Curufin', 'Amrod', 'Amras'].includes(node.name))
        .sort((left, right) => left.cx - right.cx)
      const firstCousin = nodes.find((node) => node.name === 'Fingon' && Math.abs(node.y - (feanorChildren[0]?.y ?? Number.NaN)) < 1) ?? null

      if (feanorChildren.length === 0) {
        return null
      }

      const minCx = Math.min(...feanorChildren.map((node) => node.cx))
      const maxCx = Math.max(...feanorChildren.map((node) => node.cx))
      const rowY = feanorChildren[0].y
      const intruders = nodes
        .filter((node) => !['Maedhros', 'Maglor', 'Celegorm', 'Caranthir', 'Curufin', 'Amrod', 'Amras'].includes(node.name))
        .filter((node) => Math.abs(node.y - rowY) < 1)
        .filter((node) => node.cx > minCx && node.cx < maxCx)
        .map((node) => node.name)
      const siblingEdgeGaps = feanorChildren.slice(1).map((node, index) => node.x - (feanorChildren[index].x + feanorChildren[index].width))
      const cousinEdgeGap = firstCousin ? firstCousin.x - (feanorChildren[feanorChildren.length - 1].x + feanorChildren[feanorChildren.length - 1].width) : null

      return {
        feanorChildren: feanorChildren.map((node) => node.name),
        intruders,
        siblingEdgeGaps,
        cousinEdgeGap,
      }
    })

    expect(rowState).not.toBeNull()
    expect((rowState as { feanorChildren: string[] }).feanorChildren).toEqual([
      'Maedhros',
      'Maglor',
      'Celegorm',
      'Caranthir',
      'Curufin',
      'Amrod',
      'Amras',
    ])
    expect((rowState as { intruders: string[] }).intruders).toEqual([])
    expect(Math.max(...(rowState as { siblingEdgeGaps: number[] }).siblingEdgeGaps)).toBeLessThan(160)
    expect((rowState as { cousinEdgeGap: number | null }).cousinEdgeGap).not.toBeNull()
    expect((rowState as { cousinEdgeGap: number }).cousinEdgeGap).toBeGreaterThan(120)
  })

  test('keeps Aragorn projection beside Arwen without overlapping Vardame', async ({ page }) => {
    const positions = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const getNode = (personId: string) => {
        const group = svg.querySelector(`g[data-person-id="${personId}"]`)
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return null
        }

        const x = Number(rect.getAttribute('x') ?? 'NaN')
        const width = Number(rect.getAttribute('width') ?? 'NaN')
        const y = Number(rect.getAttribute('y') ?? 'NaN')
        const height = Number(rect.getAttribute('height') ?? 'NaN')
        if (!Number.isFinite(x) || !Number.isFinite(width) || !Number.isFinite(y) || !Number.isFinite(height)) {
          return null
        }

        return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 }
      }

      const getProjection = (label: string) => {
        const matches = Array.from(svg.querySelectorAll('g')).flatMap((group) => {
          const transform = group.getAttribute('transform') ?? ''
          const rect = group.querySelector(':scope > rect[rx="16"]') as SVGRectElement | null
          const name = group.querySelector(':scope > text.preview3-svg-name')
          if (!transform.startsWith('translate(') || !rect || !name || (name.textContent || '').trim() !== label) {
            return []
          }

          const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(transform)
          if (!match) {
            return []
          }

          const x = Number(match[1])
          const y = Number(match[2])
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          const height = Number(rect.getAttribute('height') ?? 'NaN')
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
            return []
          }

          return [{ x, y, width, height, cx: x + width / 2, cy: y + height / 2 }]
        })

        return matches.sort((left, right) => left.x - right.x)[0] ?? null
      }

      return {
        arwen: getNode('550e8400-e29b-41d4-a716-446655440004'),
        vardame: getNode('d40dea93-09ac-4950-8051-0556ad3c40a1'),
        aragornProjectionNearArwen: getProjection('Aragorn II'),
      }
    })

    expect(positions.arwen).not.toBeNull()
    expect(positions.vardame).not.toBeNull()
    expect(positions.aragornProjectionNearArwen).not.toBeNull()

    expect((positions.aragornProjectionNearArwen as { cx: number }).cx).toBeGreaterThan((positions.arwen as { cx: number }).cx)
    const overlaps = (left: { x: number; width: number }, right: { x: number; width: number }) => {
      return left.x < right.x + right.width && right.x < left.x + left.width
    }
    expect(overlaps(
      positions.aragornProjectionNearArwen as { x: number; width: number },
      positions.vardame as { x: number; width: number },
    )).toBe(false)
  })

  test('uses Eol main node for Aredhel primary marriage without overlapping Argon', async ({ page }) => {
    const positions = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const getMainByLabel = (labelText: string) => {
        const groups = Array.from(svg.querySelectorAll('g[data-person-id]'))
        for (const group of groups) {
          const rect = group.querySelector('rect[rx="18"]') as SVGRectElement | null
          const label = group.querySelector('text.preview3-svg-name')
          if (!rect || !label || (label.textContent || '').trim() !== labelText) {
            continue
          }

          const x = Number(rect.getAttribute('x') ?? 'NaN')
          const y = Number(rect.getAttribute('y') ?? 'NaN')
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          const height = Number(rect.getAttribute('height') ?? 'NaN')
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
            continue
          }

          return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 }
        }

        return null
      }

      const getProjection = (labelText: string) => {
        const matches = Array.from(svg.querySelectorAll('g')).flatMap((group) => {
          const transform = group.getAttribute('transform') ?? ''
          const rect = group.querySelector(':scope > rect[rx="16"]') as SVGRectElement | null
          const label = group.querySelector(':scope > text.preview3-svg-name')
          if (!transform.startsWith('translate(') || !rect || !label || (label.textContent || '').trim() !== labelText) {
            return []
          }

          const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(transform)
          if (!match) {
            return []
          }

          const x = Number(match[1])
          const y = Number(match[2])
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          const height = Number(rect.getAttribute('height') ?? 'NaN')
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
            return []
          }

          return [{ x, y, width, height, cx: x + width / 2, cy: y + height / 2 }]
        })

        return matches.sort((left, right) => left.x - right.x || left.y - right.y)[0] ?? null
      }

      return {
        galadriel: getMainByLabel('Galadriel'),
        celebornProjection: getProjection('Celeborn'),
        aredhel: getMainByLabel('Aredhel'),
        eol: getMainByLabel('Eöl'),
        eolMainCount: Array.from(svg.querySelectorAll('g[data-person-id]')).filter((group) => (
          (group.querySelector('text.preview3-svg-name')?.textContent || '').trim() === 'Eöl'
        )).length,
        eolProjection: getProjection('Eöl'),
        argon: getMainByLabel('Argon'),
      }
    })

    expect(positions.galadriel).not.toBeNull()
    expect(positions.celebornProjection).not.toBeNull()
    expect(positions.aredhel).not.toBeNull()
    expect(positions.eol).not.toBeNull()
    expect(positions.eolMainCount).toBe(1)
    expect(positions.eolProjection).toBeNull()
    expect(positions.argon).not.toBeNull()

    expect((positions.celebornProjection as { cx: number }).cx).toBeGreaterThan((positions.galadriel as { cx: number }).cx)
    expect((positions.celebornProjection as { x: number }).x - ((positions.galadriel as { x: number; width: number }).x + (positions.galadriel as { width: number }).width)).toBeLessThan(180)

    expect((positions.eol as { cx: number }).cx).toBeGreaterThan((positions.aredhel as { cx: number }).cx)
    expect((positions.eol as { x: number }).x - ((positions.aredhel as { x: number; width: number }).x + (positions.aredhel as { width: number }).width)).toBeLessThan(80)
    expect((positions.eol as { y: number }).y).toBe((positions.aredhel as { y: number }).y)

    const overlaps = (left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }) => {
      return left.x < right.x + right.width
        && right.x < left.x + left.width
        && left.y < right.y + right.height
        && right.y < left.y + left.height
    }
    expect(overlaps(
      positions.eol as { x: number; y: number; width: number; height: number },
      positions.argon as { x: number; y: number; width: number; height: number },
    )).toBe(false)

  })

  test('keeps projection as the default for cross-line couples', async ({ page }) => {
    const labels = await page.locator('svg text').evaluateAll((nodes) => {
      return nodes
        .map((node) => (node.textContent || '').trim())
        .filter((text) => text.length > 0)
    })

    expect(countLabelMatches(labels, 'aragorn ii')).toBe(2)
    expect(countLabelMatches(labels, 'arwen')).toBe(2)
    expect(countLabelMatches(labels, 'beren erchamion')).toBe(2)
    expect(countLabelMatches(labels, 'luthien')).toBe(2)
  })

  test('uses the visible companion projection as the child connector parent anchor', async ({ page }) => {
    const agreement = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const projection = Array.from(svg.querySelectorAll('g')).flatMap((group) => {
        const transform = group.getAttribute('transform') ?? ''
        const rect = group.querySelector(':scope > rect[rx="16"]') as SVGRectElement | null
        const label = group.querySelector(':scope > text.preview3-svg-name')
        if (!transform.startsWith('translate(') || !rect || (label?.textContent || '').trim() !== 'Morwen') {
          return []
        }

        const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(transform)
        const width = Number(rect.getAttribute('width') ?? 'NaN')
        const height = Number(rect.getAttribute('height') ?? 'NaN')
        if (!match || !Number.isFinite(width) || !Number.isFinite(height)) {
          return []
        }

        const x = Number(match[1])
        const y = Number(match[2])
        return [{ centerX: x + width / 2, bottomY: y + height }]
      }).sort((left, right) => left.centerX - right.centerX)[0] ?? null

      if (!projection) {
        return null
      }

      return Array.from(svg.querySelectorAll('line')).some((line) => {
        const x1 = Number(line.getAttribute('x1') ?? 'NaN')
        const y1 = Number(line.getAttribute('y1') ?? 'NaN')
        const x2 = Number(line.getAttribute('x2') ?? 'NaN')
        const y2 = Number(line.getAttribute('y2') ?? 'NaN')
        return Math.abs(x1 - projection.centerX) < 0.5
          && Math.abs(x2 - projection.centerX) < 0.5
          && Math.abs(y1 - projection.bottomY) < 0.5
          && y2 > y1
      })
    })

    expect(agreement).toBe(true)
  })

  test('suppresses projection for the local parentless inline couple case', async ({ page }) => {
    const labels = await page.locator('svg text').evaluateAll((nodes) => {
      return nodes
        .map((node) => (node.textContent || '').trim())
        .filter((text) => text.length > 0)
    })

    expect(countLabelMatches(labels, 'silmari')).toBe(1)
    expect(countLabelMatches(labels, 'elatan')).toBe(1)
  })

  test('places first and second marriages asymmetrically around the owner', async ({ page }) => {
    const positions = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const getCenterX = (personId: string) => {
        const group = svg.querySelector(`g[data-person-id="${personId}"]`)
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return null
        }

        const x = Number(rect.getAttribute('x') ?? 'NaN')
        const width = Number(rect.getAttribute('width') ?? 'NaN')
        if (!Number.isFinite(x) || !Number.isFinite(width)) {
          return null
        }

        return x + width / 2
      }

      return {
        finwe: getCenterX('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01'),
        miriel: getCenterX('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02'),
        indis: getCenterX('g7h8i9j0-k1l2-4m3n-4o5p-6q7r8s9t0u10'),
      }
    })

    expect(positions.finwe).not.toBeNull()
    expect(positions.miriel).not.toBeNull()
    expect(positions.indis).not.toBeNull()

    expect((positions.miriel as number)).toBeLessThan(positions.finwe as number)
    expect((positions.indis as number)).toBeGreaterThan(positions.finwe as number)
  })

  test('keeps projection-aware upper-family reservations and busy local projections compact', async ({ page }) => {
    const geometry = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const getMain = (labelText: string) => {
        const group = Array.from(svg.querySelectorAll('g[data-person-id]')).find((candidate) => {
          return (candidate.querySelector('text.preview3-svg-name')?.textContent || '').trim() === labelText
        })
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return null
        }

        const x = Number(rect.getAttribute('x') ?? 'NaN')
        const y = Number(rect.getAttribute('y') ?? 'NaN')
        const width = Number(rect.getAttribute('width') ?? 'NaN')
        const height = Number(rect.getAttribute('height') ?? 'NaN')
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)
          ? { x, y, width, height }
          : null
      }

      const getProjection = (labelText: string) => {
        return Array.from(svg.querySelectorAll('g')).flatMap((group) => {
          const transform = group.getAttribute('transform') ?? ''
          const rect = group.querySelector(':scope > rect[rx="16"]') as SVGRectElement | null
          const label = group.querySelector(':scope > text.preview3-svg-name')
          if (!transform.startsWith('translate(') || !rect || (label?.textContent || '').trim() !== labelText) {
            return []
          }

          const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(transform)
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          const height = Number(rect.getAttribute('height') ?? 'NaN')
          if (!match || !Number.isFinite(width) || !Number.isFinite(height)) {
            return []
          }

          return [{ x: Number(match[1]), y: Number(match[2]), width, height }]
        })
      }

      const mainNodes = Array.from(svg.querySelectorAll('g[data-person-id]')).flatMap((group) => {
        const rect = group.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return []
        }

        const x = Number(rect.getAttribute('x') ?? 'NaN')
        const y = Number(rect.getAttribute('y') ?? 'NaN')
        const width = Number(rect.getAttribute('width') ?? 'NaN')
        const height = Number(rect.getAttribute('height') ?? 'NaN')
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)
          ? [{ x, y, width, height }]
          : []
      })

      return {
        aredhel: getMain('Aredhel'),
        finrod: getMain('Finrod Felagund'),
        earwen: getMain('Eärwen'),
        luthien: getMain('Luthien'),
        finarfinProjections: getProjection('Finarfin'),
        berenProjections: getProjection('Beren Erchamion'),
        mainNodes,
      }
    })

    expect(geometry.aredhel).not.toBeNull()
    expect(geometry.finrod).not.toBeNull()
    expect(geometry.earwen).not.toBeNull()
    expect(geometry.luthien).not.toBeNull()
    expect(geometry.finarfinProjections).not.toEqual([])
    expect(geometry.berenProjections).not.toEqual([])

    const aredhel = geometry.aredhel as { x: number; width: number }
    const finrod = geometry.finrod as { x: number }
    expect(finrod.x - (aredhel.x + aredhel.width)).toBeLessThan(900)

    const overlaps = (left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }) => {
      return left.x < right.x + right.width
        && right.x < left.x + left.width
        && left.y < right.y + right.height
        && right.y < left.y + left.height
    }
    const busyProjections = [
      ...(geometry.finarfinProjections as Array<{ x: number; y: number; width: number; height: number }>),
      ...(geometry.berenProjections as Array<{ x: number; y: number; width: number; height: number }>),
    ]

    for (const projection of busyProjections) {
      expect(geometry.mainNodes.some((node) => overlaps(projection, node))).toBe(false)
    }

    const earwen = geometry.earwen as { x: number; y: number; width: number; height: number }
    const finarfinProjection = (geometry.finarfinProjections as Array<{ x: number; y: number; width: number; height: number }>)
      .sort((left, right) => Math.abs(left.y - (geometry.earwen as { y: number }).y) - Math.abs(right.y - (geometry.earwen as { y: number }).y))[0]
    expect(finarfinProjection).toBeDefined()
    expect(Math.abs(finarfinProjection.y - earwen.y)).toBeLessThan(earwen.height * 3)
    expect(overlaps(finarfinProjection, geometry.luthien as { x: number; y: number; width: number; height: number })).toBe(false)
  })

  test('keeps both final Finarfin and Earwen projection contexts independently addressable', async ({ page }) => {
    const geometry = await page.locator('svg.preview3-graph').evaluate((svg) => {
      type Box = { id: string; label: string; x: number; y: number; width: number; height: number }
      const getNumber = (element: Element, attribute: string) => Number(element.getAttribute(attribute) ?? 'NaN')
      const getTranslate = (element: Element) => {
        const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(element.getAttribute('transform') ?? '')
        return match ? { x: Number(match[1]), y: Number(match[2]) } : null
      }
      const mainById = new Map<string, Box>()
      for (const group of Array.from(svg.querySelectorAll('g[data-person-id]'))) {
        const rect = group.querySelector(':scope > rect[rx="18"]')
        const label = group.querySelector(':scope > text.preview3-svg-name')?.textContent?.trim() ?? ''
        const id = group.getAttribute('data-person-id')
        if (!rect || !id) {
          continue
        }

        const x = getNumber(rect, 'x')
        const y = getNumber(rect, 'y')
        const width = getNumber(rect, 'width')
        const height = getNumber(rect, 'height')
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)) {
          mainById.set(id, { id, label, x, y, width, height })
        }
      }

      const projections = Array.from(svg.querySelectorAll('g[data-projection-context]')).flatMap((group) => {
        const rect = group.querySelector(':scope > rect[rx="16"]')
        const translate = getTranslate(group)
        const ownerId = group.getAttribute('data-projection-owner-id')
        const companionId = group.getAttribute('data-projection-companion-id')
        const context = group.getAttribute('data-projection-context')
        const planned = group.getAttribute('data-projection-planned')
        if (!rect || !translate || !ownerId || !companionId || !context) {
          return []
        }

        const width = getNumber(rect, 'width')
        const height = getNumber(rect, 'height')
        const owner = mainById.get(ownerId)
        const companion = mainById.get(companionId)
        return Number.isFinite(width) && Number.isFinite(height) && owner && companion
          ? [{ context, planned, owner, companion, x: translate.x, y: translate.y, width, height }]
          : []
      }).filter((projection) => {
        return (projection.owner.label === 'Finarfin' && projection.companion.label === 'Eärwen')
          || (projection.owner.label === 'Eärwen' && projection.companion.label === 'Finarfin')
      })

      return { projections }
    })

    expect(geometry.projections).toHaveLength(2)
    expect(new Set(geometry.projections.map((projection) => projection.context.split(':').slice(1).join(':'))).size).toBe(2)
    expect(geometry.projections.map((projection) => projection.planned)).toEqual(['true', 'true'])

    for (const projection of geometry.projections) {
      const ownerRight = projection.owner.x + projection.owner.width
      const projectionRight = projection.x + projection.width
      const horizontalGap = projection.x >= ownerRight
        ? projection.x - ownerRight
        : projection.owner.x - projectionRight
      expect(horizontalGap).toBe(28)
      expect(projection.y - projection.owner.y).toBe(6)
    }

    const [first, second] = geometry.projections
    const overlaps = first.x < second.x + second.width
      && second.x < first.x + first.width
      && first.y < second.y + second.height
      && second.y < first.y + first.height
    expect(overlaps).toBe(false)
  })

  test('completes final R3B geometry without box collisions and preserves shared start-house roots', async ({ page }) => {
    const geometry = await page.locator('svg.preview3-graph').evaluate((svg) => {
      type Box = { id: string; label: string; kind: 'main' | 'projection'; x: number; y: number; width: number; height: number }

      const getNumber = (element: Element, attribute: string) => Number(element.getAttribute(attribute) ?? 'NaN')
      const getTranslate = (group: Element) => {
        const match = /translate\(([-0-9.]+)\s+([-0-9.]+)\)/.exec(group.getAttribute('transform') ?? '')
        return match ? { x: Number(match[1]), y: Number(match[2]) } : null
      }
      const getMainBoxes = (): Box[] => Array.from(svg.querySelectorAll('g[data-person-id]')).flatMap((group) => {
        const rect = group.querySelector(':scope > rect[rx="18"]')
        const label = group.querySelector(':scope > text.preview3-svg-name')?.textContent?.trim() ?? ''
        if (!rect) {
          return []
        }

        const x = getNumber(rect, 'x')
        const y = getNumber(rect, 'y')
        const width = getNumber(rect, 'width')
        const height = getNumber(rect, 'height')
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)
          ? [{ id: group.getAttribute('data-person-id') ?? label, label, kind: 'main' as const, x, y, width, height }]
          : []
      })
      const getProjectionBoxes = (): Box[] => Array.from(svg.querySelectorAll('g')).flatMap((group) => {
        const rect = group.querySelector(':scope > rect[rx="16"]')
        const label = group.querySelector(':scope > text.preview3-svg-name')?.textContent?.trim() ?? ''
        const translate = getTranslate(group)
        if (!rect || !label || !translate) {
          return []
        }

        const width = getNumber(rect, 'width')
        const height = getNumber(rect, 'height')
        return Number.isFinite(width) && Number.isFinite(height)
          ? [{ id: `${label}:${translate.x}:${translate.y}`, label, kind: 'projection' as const, x: translate.x, y: translate.y, width, height }]
          : []
      })
      const mainBoxes = getMainBoxes()
      const projectionBoxes = getProjectionBoxes()
      const boxes = [...mainBoxes, ...projectionBoxes]
      const overlaps = (left: Box, right: Box) => left.x < right.x + right.width
        && right.x < left.x + left.width
        && left.y < right.y + right.height
        && right.y < left.y + left.height
      const overlapsByPair = boxes.flatMap((left, index) => boxes.slice(index + 1)
        .filter((right) => overlaps(left, right))
        .map((right) => `${left.kind}:${left.label}|${right.kind}:${right.label}`))
      const mainByLabel = (label: string) => mainBoxes.filter((box) => box.label === label)
      const enel = mainByLabel('Enel')[0] ?? null
      const enelye = mainByLabel('Enelyë')[0] ?? null
      const sharedChildren = ['Elwë (Thingol)', 'Olwë']
        .map((label) => mainByLabel(label)[0] ?? null)
        .filter((node): node is Box => node !== null)
      const parentCenterX = enel && enelye
        ? ((enel.x + enel.width / 2) + (enelye.x + enelye.width / 2)) / 2
        : null
      const sharedChildBandCenterX = sharedChildren.length === 0
        ? null
        : (Math.min(...sharedChildren.map((node) => node.x + node.width / 2))
          + Math.max(...sharedChildren.map((node) => node.x + node.width / 2))) / 2
      const mainParentLines = enel && enelye
        ? [enel, enelye].filter((parent) => Array.from(svg.querySelectorAll('line')).some((line) => {
            const x1 = getNumber(line, 'x1')
            const y1 = getNumber(line, 'y1')
            const x2 = getNumber(line, 'x2')
            const y2 = getNumber(line, 'y2')
            return Math.abs(x1 - (parent.x + parent.width / 2)) < 0.5
              && Math.abs(x2 - x1) < 0.5
              && Math.abs(y1 - (parent.y + parent.height)) < 0.5
              && y2 > y1
          })).length
        : 0
      const nelyarAnchor = Array.from(svg.querySelectorAll('text')).flatMap((text) => {
        if (text.textContent?.trim() !== 'Nelyar and Teleri line') {
          return []
        }

        const group = text.parentElement
        const rect = group?.querySelector(':scope > rect')
        const translate = group ? getTranslate(group) : null
        if (!group || !rect || !translate) {
          return []
        }

        const width = getNumber(rect, 'width')
        return Number.isFinite(width) ? [{ centerX: translate.x + width / 2 }] : []
      })[0] ?? null

      return {
        overlapsByPair,
        enelMainCount: mainByLabel('Enel').length,
        enelyeMainCount: mainByLabel('Enelyë').length,
        enelProjectionCount: projectionBoxes.filter((box) => box.label === 'Enel').length,
        enelyeProjectionCount: projectionBoxes.filter((box) => box.label === 'Enelyë').length,
        sharedChildBandCenterX,
        parentCenterX,
        mainParentLines,
        nelyarAnchorCenterX: nelyarAnchor?.centerX ?? null,
      }
    })

    expect(geometry.overlapsByPair).toEqual([])
    expect(geometry.enelMainCount).toBe(1)
    expect(geometry.enelyeMainCount).toBe(1)
    expect(geometry.enelProjectionCount).toBe(0)
    expect(geometry.enelyeProjectionCount).toBe(0)
    expect(geometry.mainParentLines).toBe(2)
    expect(geometry.sharedChildBandCenterX).not.toBeNull()
    expect(geometry.parentCenterX).not.toBeNull()
    expect(Math.abs((geometry.sharedChildBandCenterX as number) - (geometry.parentCenterX as number))).toBeLessThan(1)
    expect(geometry.nelyarAnchorCenterX).not.toBeNull()
    expect(Math.abs((geometry.nelyarAnchorCenterX as number) - (geometry.parentCenterX as number))).toBeLessThan(1)
  })

  test('keeps projection slots deterministic across a reload', async ({ page }) => {
    const initialSnapshot = await getProjectionSnapshot(page)

    await page.reload({ waitUntil: 'networkidle' })

    expect(await getProjectionSnapshot(page)).toEqual(initialSnapshot)
  })
})