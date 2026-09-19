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

      return {
        feanorChildren: feanorChildren.map((node) => node.name),
        intruders,
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
})