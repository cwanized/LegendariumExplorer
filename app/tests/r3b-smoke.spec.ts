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