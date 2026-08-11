import { expect, test } from '@playwright/test'

const STORAGE_KEY = 'legendarium.preview3.preferences.v1'

function buildStoredPreferences(followRulerLine = false) {
  return {
    version: 1,
    datasetName: 'demo',
    activePage: 'family-tree',
    treeMode: 'modeR3',
    followRulerLine,
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

async function gotoR3WithPreferences(page: import('@playwright/test').Page, followRulerLine = false) {
  await page.addInitScript(({ key, payload }) => {
    window.localStorage.setItem(key, JSON.stringify(payload))
  }, { key: STORAGE_KEY, payload: buildStoredPreferences(followRulerLine) })

  await page.goto('/preview3', { waitUntil: 'networkidle' })
}

test.describe('Mode R3 smoke', () => {
  test.beforeEach(async ({ page }) => {
    await gotoR3WithPreferences(page)
  })

  test('renders in Mode R3', async ({ page }) => {
    const mode = await page.locator('.preview3-mode-summary strong').textContent()
    expect(mode?.trim()).toBe('Mode R3: Structured Raster Engine')
  })

  test('shows start-house anchors but suppresses later-tier anchors', async ({ page }) => {
    const labels = await page.locator('svg text').evaluateAll((nodes) => {
      return nodes
        .map((node) => (node.textContent || '').trim())
        .filter((text) => text.length > 0)
    })

    expect(labels).toContain('Minyar and Vanyar line')
    expect(labels).toContain('Tatyar and Noldor line')
    expect(labels).toContain('Nelyar and Teleri line')
    expect(labels).not.toContain('Vanyar')
    expect(labels).not.toContain('Noldor')
    expect(labels).not.toContain('Teleri')
  })

  test('renders each start-house anchor exactly once', async ({ page }) => {
    const expectedAnchorLabels = [
      'Minyar and Vanyar line',
      'Tatyar and Noldor line',
      'Nelyar and Teleri line',
    ]

    for (const label of expectedAnchorLabels) {
      await expect(page.locator('svg text').filter({ hasText: label })).toHaveCount(1)
    }

    const anchorLabelHits = await page.locator('svg text').evaluateAll((nodes, labels) => {
      const targets = new Set(labels as string[])
      return nodes
        .map((node) => (node.textContent || '').trim())
        .filter((text) => targets.has(text))
        .length
    }, expectedAnchorLabels)

    expect(anchorLabelHits).toBe(3)
  })

  test('enables spouse projections for cross-line couples', async ({ page }) => {
    await expect(page.locator('svg text').filter({ hasText: 'Aragorn II' })).toHaveCount(2)
    await expect(page.locator('svg text').filter({ hasText: 'Arwen' })).toHaveCount(2)
    await expect(page.locator('svg text').filter({ hasText: 'Beren Erchamion' })).toHaveCount(2)
    await expect(page.locator('svg text').filter({ hasText: 'Luthien' })).toHaveCount(2)
  })

  test('keeps parentless spouse coupled to anchored lineage row (Silmariën/Elatan)', async ({ page }) => {
    const findNodeY = async (nameFragment: string) => {
      const y = await page.locator('svg text').evaluateAll((nodes, fragment) => {
        const needle = String(fragment).toLowerCase()
        const match = nodes.find((node) => (node.textContent || '').toLowerCase().includes(needle))
        if (!match) {
          return null
        }

        const group = match.closest('g')
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return null
        }

        const rawY = Number(rect.getAttribute('y') ?? 'NaN')
        return Number.isFinite(rawY) ? rawY : null
      }, nameFragment)

      expect(y).not.toBeNull()
      return y as number
    }

    const silmarienY = await findNodeY('silmari')
    const elatanY = await findNodeY('elatan')
    const tarElendilY = await findNodeY('tar-elendil')

    expect(Math.abs(silmarienY - elatanY)).toBeLessThanOrEqual(1)
    expect(tarElendilY).toBeLessThan(silmarienY)
  })

  test('keeps downstream heirs on a stable axis (Valandil/Eärendur/Numendil)', async ({ page }) => {
    const findNodeXById = async (personId: string) => {
      const x = await page.locator('svg.preview3-graph').evaluate((svg, id) => {
        const group = svg.querySelector(`g[data-person-id="${id}"]`)
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return null
        }

        const rawX = Number(rect.getAttribute('x') ?? 'NaN')
        const rawWidth = Number(rect.getAttribute('width') ?? 'NaN')
        if (!Number.isFinite(rawX) || !Number.isFinite(rawWidth)) {
          return null
        }

        return rawX + rawWidth / 2
      }, personId)

      expect(x).not.toBeNull()
      return x as number
    }

    const valandilX = await findNodeXById('d19f8ab1-491c-49ec-9ef0-593adda1ffbf')
    const earendurX = await findNodeXById('96e5fbf0-86e7-4fea-914b-d3b0c9eed8bb')
    const numendilX = await findNodeXById('5c25ed30-f137-4dcd-9c69-9d8354e00c76')

    expect(Math.abs(valandilX - earendurX)).toBeLessThanOrEqual(1)
    expect(Math.abs(earendurX - numendilX)).toBeLessThanOrEqual(1)
  })

  test('renders Elrond and Elros as distinct sibling nodes (no overlap)', async ({ page }) => {
    const positions = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const centerByNameFragment = (fragment: string) => {
        const needle = fragment.toLowerCase()
        const labels = Array.from(svg.querySelectorAll('text'))
        for (const label of labels) {
          if (!(label.textContent || '').toLowerCase().includes(needle)) {
            continue
          }

          const group = label.closest('g')
          const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
          if (!rect) {
            continue
          }

          const x = Number(rect.getAttribute('x') ?? 'NaN')
          const y = Number(rect.getAttribute('y') ?? 'NaN')
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          const height = Number(rect.getAttribute('height') ?? 'NaN')
          if (![x, y, width, height].every(Number.isFinite)) {
            continue
          }

          return {
            x,
            y,
            width,
            height,
            centerX: x + width / 2,
            centerY: y + height / 2,
          }
        }

        return null
      }

      return {
        elrond: centerByNameFragment('elrond'),
        elros: centerByNameFragment('elros'),
      }
    })

    expect(positions.elrond).not.toBeNull()
    expect(positions.elros).not.toBeNull()

    const elrond = positions.elrond as { centerX: number; centerY: number; width: number }
    const elros = positions.elros as { centerX: number; centerY: number; width: number }

    expect(Math.abs(elrond.centerY - elros.centerY)).toBeLessThanOrEqual(1)
    expect(Math.abs(elrond.centerX - elros.centerX)).toBeGreaterThanOrEqual(elrond.width)
  })

  test('keeps Halmir siblings compact on the sibling row (Haldir/Hundar/Hareth/Hiril)', async ({ page }) => {
    const result = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const ids = [
        '18cbdafe-88b8-4e52-974f-62b74f99f1f9', // Haldir
        '5a58ea18-9a08-4d05-982c-de24706fffcc', // Hundar
        '550e8400-e29b-41d4-a716-446655440018', // Hareth
        '7e2dfb20-8599-43bf-8b85-7fcccbccdc14', // Hiril
      ]

      const nodes = ids
        .map((id) => {
          const group = svg.querySelector(`g[data-person-id="${id}"]`)
          const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
          const name = (group?.querySelector('text')?.textContent ?? '').trim()
          if (!group || !rect) {
            return null
          }

          const x = Number(rect.getAttribute('x') ?? 'NaN')
          const y = Number(rect.getAttribute('y') ?? 'NaN')
          const w = Number(rect.getAttribute('width') ?? 'NaN')
          if (![x, y, w].every(Number.isFinite)) {
            return null
          }

          return {
            id,
            name,
            rowY: y,
            centerX: x + w / 2,
          }
        })
        .filter((node): node is { id: string; name: string; rowY: number; centerX: number } => node !== null)
        .sort((left, right) => left.centerX - right.centerX)

      if (nodes.length !== 4) {
        return { nodes, maxGap: null, sameRow: false }
      }

      const rowMin = Math.min(...nodes.map((node) => node.rowY))
      const rowMax = Math.max(...nodes.map((node) => node.rowY))
      const sameRow = Math.abs(rowMax - rowMin) <= 1
      const gaps = nodes.slice(1).map((node, index) => node.centerX - nodes[index].centerX)
      const maxGap = Math.max(...gaps)

      return {
        nodes,
        sameRow,
        maxGap,
      }
    })

    expect(result.nodes.length).toBe(4)
    expect(result.sameRow).toBe(true)
    expect(result.maxGap ?? Number.NaN).toBeLessThanOrEqual(1200)
  })

  test('keeps two-child sibling groups compact even with heavy downstream trees', async ({ page }) => {
    const result = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const centerXById = (personId: string) => {
        const group = svg.querySelector(`g[data-person-id="${personId}"]`)
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!group || !rect) {
          return null
        }

        const x = Number(rect.getAttribute('x') ?? 'NaN')
        const w = Number(rect.getAttribute('width') ?? 'NaN')
        if (![x, w].every(Number.isFinite)) {
          return null
        }

        return x + w / 2
      }

      const halethX = centerXById('0469c9c1-58f0-4c19-a6ab-ca79f103c64f')
      const haldarX = centerXById('550e8400-e29b-41d4-a716-446655440019')
      const huorX = centerXById('5d9eaf01-c304-4068-bf94-3b5a7e980005')
      const hurinX = centerXById('550e8400-e29b-41d4-a716-446655440022')

      return {
        halethHaldarGap: halethX !== null && haldarX !== null ? Math.abs(halethX - haldarX) : null,
        huorHurinGap: huorX !== null && hurinX !== null ? Math.abs(huorX - hurinX) : null,
      }
    })

    expect(result.halethHaldarGap).not.toBeNull()
    expect(result.huorHurinGap).not.toBeNull()

    expect(result.halethHaldarGap ?? Number.NaN).toBeLessThanOrEqual(900)
    expect(result.huorHurinGap ?? Number.NaN).toBeLessThanOrEqual(1000)
  })

  test('prevents same-row overlap for Idril and Turin', async ({ page }) => {
    const result = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const findByName = (needle: string) => {
        const groups = Array.from(svg.querySelectorAll('g[data-person-id]'))
        for (const group of groups) {
          const text = (group.querySelector('text')?.textContent ?? '').trim().toLowerCase()
          if (!text.includes(needle)) {
            continue
          }

          const rect = group.querySelector('rect[rx="18"]') as SVGRectElement | null
          if (!rect) {
            continue
          }

          const x = Number(rect.getAttribute('x') ?? 'NaN')
          const y = Number(rect.getAttribute('y') ?? 'NaN')
          const width = Number(rect.getAttribute('width') ?? 'NaN')
          const height = Number(rect.getAttribute('height') ?? 'NaN')
          if (![x, y, width, height].every(Number.isFinite)) {
            continue
          }

          return {
            x,
            y,
            width,
            height,
            right: x + width,
            bottom: y + height,
          }
        }

        return null
      }

      const idril = findByName('idril')
      const turin = findByName('turin')
      if (!idril || !turin) {
        return null
      }

      const overlap = !(
        idril.right <= turin.x
        || turin.right <= idril.x
        || idril.bottom <= turin.y
        || turin.bottom <= idril.y
      )

      return {
        overlap,
        horizontalGap: Math.max(turin.x - idril.right, idril.x - turin.right),
      }
    })

    expect(result).not.toBeNull()
    expect(result?.overlap).toBe(false)
    expect((result?.horizontalGap ?? Number.NaN)).toBeGreaterThanOrEqual(0)
  })

  test('defaults FollowRulerLine to off and stores toggle state', async ({ page }) => {
    const followRulerLineToggle = page.getByLabel('FollowRulerLine')

    await expect(followRulerLineToggle).toBeVisible()
    await expect(followRulerLineToggle).not.toBeChecked()

    await followRulerLineToggle.check()
    await expect(followRulerLineToggle).toBeChecked()

    await page.waitForFunction(({ key }) => {
      const raw = window.localStorage.getItem(key)
      if (!raw) {
        return false
      }
      try {
        return JSON.parse(raw)?.followRulerLine === true
      } catch {
        return false
      }
    }, { key: STORAGE_KEY })

    const storedFollowRulerLine = await page.evaluate(({ key }) => {
      const raw = window.localStorage.getItem(key)
      if (!raw) {
        return null
      }
      try {
        return JSON.parse(raw)?.followRulerLine ?? null
      } catch {
        return null
      }
    }, { key: STORAGE_KEY })

    expect(storedFollowRulerLine).toBe(true)
  })

  test('keeps Luthien main node anchored to Thingol/Melian lineage', async ({ page }) => {
    const centers = await page.locator('svg.preview3-graph').evaluate((svg) => {
      const centerForId = (personId: string) => {
        const group = svg.querySelector(`g[data-person-id="${personId}"]`)
        const rect = group?.querySelector('rect[rx="18"]') as SVGRectElement | null
        if (!rect) {
          return null
        }

        const x = Number(rect.getAttribute('x') ?? 'NaN')
        const y = Number(rect.getAttribute('y') ?? 'NaN')
        const w = Number(rect.getAttribute('width') ?? 'NaN')
        const h = Number(rect.getAttribute('height') ?? 'NaN')
        if (![x, y, w, h].every(Number.isFinite)) {
          return null
        }

        return { x: x + w / 2, y: y + h / 2 }
      }

      return {
        luthien: centerForId('e8116f81-e20a-4d76-babe-71a29fad8dc8'),
        beren: centerForId('a5def383-7ae8-4a1e-bff9-615e9c80e6e7'),
        thingol: centerForId('1f2c5d4e-8a71-4e6d-9f3a-2c1b7a540001'),
        melian: centerForId('2a6b7c8d-91e2-4f35-8c61-0e2d4b650002'),
      }
    })

    expect(centers.luthien).not.toBeNull()
    expect(centers.beren).not.toBeNull()
    expect(centers.thingol).not.toBeNull()
    expect(centers.melian).not.toBeNull()

    const luthien = centers.luthien as { x: number; y: number }
    const beren = centers.beren as { x: number; y: number }
    const thingol = centers.thingol as { x: number; y: number }
    const melian = centers.melian as { x: number; y: number }
    const parentMidX = (thingol.x + melian.x) / 2

    expect(Math.abs(luthien.x - parentMidX)).toBeLessThan(Math.abs(luthien.x - beren.x))
  })
})