import { startTransition, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Rnd } from 'react-rnd'
import './Preview3App.css'
import {
  getGraphBounds,
  loadDataset,
} from './graph'
import type {
  CameraView,
  DatasetName,
  GraphMvpState,
  Person,
  UUID,
} from './graph'
import {
  expandCameraBounds,
} from './preview3/treeCore'
import {
  buildPreview3RenderedTree,
  buildPreview3TreePipeline,
} from './preview3/treePipeline'
import { buildPreview3ViewState } from './preview3/analysis'
import {
  defaultLeftPanel,
  defaultPageTheme,
  defaultRightPanel,
  defaultTreeTheme,
  emptyFilters,
  type FadeMode,
  type FilterLogic,
  type FilterState,
  type PageKey,
  type PanelSide,
  type PanelState,
  type PersistedState,
  type ThemeMode,
  type ThemePalette,
  type ThemePreset,
  type ThemeScope,
  type ThemeState,
  type ExportScope,
} from './preview3/state'
import { AppSelect, IconButton, Preview3Icon } from './preview3/ui'
import { Preview3TreeCanvas } from './preview3/components/Preview3TreeCanvas'
import { Preview3Header } from './preview3/components/Preview3Header'
import { Preview3FamilyPage } from './preview3/components/Preview3FamilyPage'

type DragState = {
  side: PanelSide
  startX: number
  startY: number
  originX: number
  originY: number
}

type ResizeState = {
  side: PanelSide
  undocked: boolean
  startX: number
  startY: number
  originWidth: number
  originHeight: number
}

type PanState = {
  startX: number
  startY: number
  origin: CameraView
}

const STORAGE_KEY = 'legendarium.preview3.preferences.v1'
const COMPACT_BREAKPOINT = 1024

const fontOptions = [
  'Aptos, Segoe UI Variable, Trebuchet MS, sans-serif',
  'Source Sans 3, Aptos, Segoe UI Variable, sans-serif',
  'Iowan Old Style, Palatino Linotype, Book Antiqua, serif',
  'Cormorant Garamond, Palatino Linotype, serif',
]

function getPresetPalette(scope: ThemeScope, preset: Exclude<ThemePreset, 'custom'>, mode: ThemeMode): ThemePalette {
  const normalizedMode = mode === 'dark' ? 'dark' : 'light'
  const pagePalettes: Record<Exclude<ThemePreset, 'custom'>, { light: ThemePalette; dark: ThemePalette }> = {
    tolkien: {
      light: { background: '#ece4d3', surface: '#f8f2e6', surfaceStrong: '#fffcf5', border: '#a39176', text: '#1f1b16', muted: '#675949', accent: '#305870', accentSoft: '#d9e5ec', shadow: 'rgba(41, 32, 19, 0.16)' },
      dark: { background: '#1d2024', surface: '#2a2f35', surfaceStrong: '#343b43', border: '#59626b', text: '#f0ebe0', muted: '#c5bbaa', accent: '#8ab0ca', accentSoft: '#3a4653', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
    gondor: {
      light: { background: '#e6eaed', surface: '#f6f8fa', surfaceStrong: '#ffffff', border: '#8b98a3', text: '#18222b', muted: '#536471', accent: '#2a4a66', accentSoft: '#dbe5ee', shadow: 'rgba(24, 34, 43, 0.16)' },
      dark: { background: '#1a2128', surface: '#27323d', surfaceStrong: '#31404a', border: '#67727d', text: '#edf3f7', muted: '#c1cad3', accent: '#8cb1cd', accentSoft: '#3b4957', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
    rohan: {
      light: { background: '#ede4cf', surface: '#f9f3e5', surfaceStrong: '#fffdf5', border: '#9f8a61', text: '#251d12', muted: '#6e5d43', accent: '#6c4e23', accentSoft: '#ebddbf', shadow: 'rgba(37, 29, 18, 0.16)' },
      dark: { background: '#211d18', surface: '#302921', surfaceStrong: '#3a3127', border: '#77664d', text: '#f3e7d3', muted: '#d3c3aa', accent: '#c9a369', accentSoft: '#4b3c2a', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
    mirkwood: {
      light: { background: '#dde6dc', surface: '#eef4eb', surfaceStrong: '#fafdf8', border: '#7b8d76', text: '#1b241b', muted: '#526150', accent: '#315845', accentSoft: '#d6e5dc', shadow: 'rgba(27, 36, 27, 0.16)' },
      dark: { background: '#1a201c', surface: '#263029', surfaceStrong: '#303b34', border: '#607467', text: '#edf3ee', muted: '#c0cbc2', accent: '#86b394', accentSoft: '#39463e', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
    imladris: {
      light: { background: '#e8e8ee', surface: '#f6f6fb', surfaceStrong: '#ffffff', border: '#9d97ad', text: '#201c2b', muted: '#5e566f', accent: '#4b5c8a', accentSoft: '#dfe5f5', shadow: 'rgba(32, 28, 43, 0.16)' },
      dark: { background: '#1b1e26', surface: '#272c37', surfaceStrong: '#313746', border: '#6a7187', text: '#f1f2f8', muted: '#cdd1dd', accent: '#9caee0', accentSoft: '#404a5d', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
  }

  const treePalettes: Record<Exclude<ThemePreset, 'custom'>, { light: ThemePalette; dark: ThemePalette }> = {
    tolkien: {
      light: { background: '#f5f1e6', surface: '#fffaf1', surfaceStrong: '#ffffff', border: '#9d8b72', text: '#1f1912', muted: '#615646', accent: '#305870', accentSoft: '#d7e5ed', nodeFill: '#fff9ee', edge: '#41617d', overlay: '#8f6537', shadow: 'rgba(35, 27, 18, 0.16)' },
      dark: { background: '#1b2026', surface: '#28303a', surfaceStrong: '#323b46', border: '#63707c', text: '#f2edde', muted: '#c7bdab', accent: '#93bad5', accentSoft: '#3b4754', nodeFill: '#37414d', edge: '#94bcda', overlay: '#d2a86f', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
    gondor: {
      light: { background: '#edf3f8', surface: '#fbfdff', surfaceStrong: '#ffffff', border: '#8b98a4', text: '#18242d', muted: '#5d6b77', accent: '#274c69', accentSoft: '#dce7ef', nodeFill: '#f5f9fc', edge: '#345a79', overlay: '#70859b', shadow: 'rgba(24, 36, 45, 0.16)' },
      dark: { background: '#1a232d', surface: '#263240', surfaceStrong: '#31404f', border: '#657588', text: '#eef4f8', muted: '#c4cdd6', accent: '#95b8d3', accentSoft: '#3b4b5d', nodeFill: '#394a59', edge: '#94bcdc', overlay: '#c0cfdd', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
    rohan: {
      light: { background: '#f1e8d5', surface: '#fff8eb', surfaceStrong: '#fffdf7', border: '#9f8b64', text: '#231c11', muted: '#67563d', accent: '#785b28', accentSoft: '#ecdfbf', nodeFill: '#fff7e6', edge: '#8c6b33', overlay: '#58734f', shadow: 'rgba(35, 28, 17, 0.16)' },
      dark: { background: '#221d17', surface: '#312920', surfaceStrong: '#3a3127', border: '#78684c', text: '#f5e9d5', muted: '#d1c0a4', accent: '#d0a96b', accentSoft: '#4c3d2a', nodeFill: '#403428', edge: '#d3ab6d', overlay: '#95ae76', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
    mirkwood: {
      light: { background: '#e4ece2', surface: '#f5faf2', surfaceStrong: '#fbfef9', border: '#7e8e79', text: '#1a2419', muted: '#556452', accent: '#335946', accentSoft: '#d7e4da', nodeFill: '#f3faef', edge: '#487260', overlay: '#6f5b37', shadow: 'rgba(26, 36, 25, 0.16)' },
      dark: { background: '#1a211c', surface: '#263029', surfaceStrong: '#303b33', border: '#62766a', text: '#edf3ed', muted: '#c0cbc2', accent: '#92bc9f', accentSoft: '#39473e', nodeFill: '#39453c', edge: '#90bb9d', overlay: '#cfb173', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
    imladris: {
      light: { background: '#eef0f8', surface: '#fbfbff', surfaceStrong: '#ffffff', border: '#9b98ad', text: '#201d2e', muted: '#625b70', accent: '#4a5f91', accentSoft: '#dee5f5', nodeFill: '#f7f8ff', edge: '#5c6fa4', overlay: '#7a698f', shadow: 'rgba(32, 29, 46, 0.16)' },
      dark: { background: '#1b1f28', surface: '#282f3b', surfaceStrong: '#333b4a', border: '#6c7489', text: '#f1f3fa', muted: '#ced2de', accent: '#9baddf', accentSoft: '#414c61', nodeFill: '#3a4455', edge: '#9eb0e2', overlay: '#d8cdef', shadow: 'rgba(0, 0, 0, 0.28)' },
    },
  }

  return scope === 'page' ? pagePalettes[preset][normalizedMode] : treePalettes[preset][normalizedMode]
}

function getNeutralPalette(scope: ThemeScope, mode: Extract<ThemeMode, 'light' | 'dark'>): ThemePalette {
  if (scope === 'page') {
    return mode === 'dark'
      ? {
          background: '#1b1f24',
          surface: '#252c34',
          surfaceStrong: '#2f3842',
          border: '#5f6a77',
          text: '#edf1f5',
          muted: '#c0c8d2',
          accent: '#8fb2d1',
          accentSoft: '#3c4a59',
          shadow: 'rgba(0, 0, 0, 0.28)',
        }
      : {
          background: '#e9edf2',
          surface: '#f5f8fb',
          surfaceStrong: '#ffffff',
          border: '#95a2af',
          text: '#1b2632',
          muted: '#566473',
          accent: '#365a78',
          accentSoft: '#dce5ee',
          shadow: 'rgba(27, 38, 50, 0.16)',
        }
  }

  return mode === 'dark'
    ? {
        background: '#182028',
        surface: '#242f3a',
        surfaceStrong: '#2f3c49',
        border: '#607080',
        text: '#edf2f6',
        muted: '#bfccd6',
        accent: '#94b8d8',
        accentSoft: '#3b4d60',
        nodeFill: '#374657',
        edge: '#90b8db',
        overlay: '#b7cbe0',
        shadow: 'rgba(0, 0, 0, 0.28)',
      }
    : {
        background: '#edf2f7',
        surface: '#f9fbfd',
        surfaceStrong: '#ffffff',
        border: '#97a7b6',
        text: '#1c2b36',
        muted: '#5a6e7f',
        accent: '#3d6281',
        accentSoft: '#dce7f2',
        nodeFill: '#f6f9fc',
        edge: '#4f6f8b',
        overlay: '#7b93aa',
        shadow: 'rgba(28, 43, 54, 0.16)',
      }
}

function getCustomPalette(theme: ThemeState): ThemePalette {
  if (theme.mode !== 'dark') {
    return theme.custom
  }

  const source = theme.custom
  return {
    background: `color-mix(in srgb, ${source.background} 18%, black 82%)`,
    surface: `color-mix(in srgb, ${source.surface} 22%, black 78%)`,
    surfaceStrong: `color-mix(in srgb, ${source.surfaceStrong} 30%, black 70%)`,
    border: `color-mix(in srgb, ${source.border} 48%, white 52%)`,
    text: `color-mix(in srgb, ${source.text} 12%, white 88%)`,
    muted: `color-mix(in srgb, ${source.muted} 28%, white 72%)`,
    accent: `color-mix(in srgb, ${source.accent} 68%, white 32%)`,
    accentSoft: `color-mix(in srgb, ${source.accentSoft} 38%, black 62%)`,
    nodeFill: source.nodeFill ? `color-mix(in srgb, ${source.nodeFill} 30%, black 70%)` : `color-mix(in srgb, ${source.surfaceStrong} 30%, black 70%)`,
    edge: source.edge ? `color-mix(in srgb, ${source.edge} 70%, white 30%)` : `color-mix(in srgb, ${source.accent} 70%, white 30%)`,
    overlay: source.overlay ? `color-mix(in srgb, ${source.overlay} 68%, white 32%)` : `color-mix(in srgb, ${source.border} 68%, white 32%)`,
    shadow: 'rgba(0, 0, 0, 0.38)',
  }
}

function getActivePalette(scope: ThemeScope, theme: ThemeState) {
  if (theme.preset === 'custom') {
    return getCustomPalette(theme)
  }

  if (theme.mode === 'thematic') {
    return getPresetPalette(scope, theme.preset, 'light')
  }

  return getNeutralPalette(scope, theme.mode)
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'thematic'
}

function isThemePreset(value: unknown): value is ThemePreset {
  return value === 'tolkien' || value === 'gondor' || value === 'rohan' || value === 'mirkwood' || value === 'imladris' || value === 'custom'
}

function isFilterLogic(value: unknown): value is FilterLogic {
  return value === 'and' || value === 'or'
}

function isFadeMode(value: unknown): value is FadeMode {
  return value === 'dim' || value === 'hide'
}

function sanitizeThemeState(input: unknown, fallback: ThemeState): ThemeState {
  if (!input || typeof input !== 'object') {
    return fallback
  }

  const raw = input as Partial<ThemeState>
  const mode = isThemeMode(raw.mode) ? raw.mode : fallback.mode
  const preset = isThemePreset(raw.preset) ? raw.preset : fallback.preset
  const custom = typeof raw.custom === 'object' && raw.custom
    ? { ...fallback.custom, ...(raw.custom as Partial<ThemePalette>) }
    : fallback.custom

  return {
    mode,
    preset,
    custom,
    fontBody: typeof raw.fontBody === 'string' && raw.fontBody.length > 0 ? raw.fontBody : fallback.fontBody,
    fontDisplay: typeof raw.fontDisplay === 'string' && raw.fontDisplay.length > 0 ? raw.fontDisplay : fallback.fontDisplay,
  }
}

function sanitizePanelState(input: unknown, fallback: PanelState): PanelState {
  if (!input || typeof input !== 'object') {
    return fallback
  }

  const raw = input as Partial<PanelState>
  return {
    collapsed: typeof raw.collapsed === 'boolean' ? raw.collapsed : fallback.collapsed,
    undocked: typeof raw.undocked === 'boolean' ? raw.undocked : fallback.undocked,
    x: typeof raw.x === 'number' ? raw.x : fallback.x,
    y: typeof raw.y === 'number' ? raw.y : fallback.y,
    width: clamp(typeof raw.width === 'number' ? raw.width : fallback.width, 280, 640),
    height: clamp(typeof raw.height === 'number' ? raw.height : fallback.height, 320, 900),
  }
}

function sanitizeFilterState(input: unknown): FilterState {
  if (!input || typeof input !== 'object') {
    return emptyFilters
  }

  const raw = input as Partial<FilterState>
  const pick = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

  return {
    houses: pick(raw.houses),
    species: pick(raw.species),
    genders: pick(raw.genders),
    eras: pick(raw.eras),
  }
}

function normalizePersistedState(input: PersistedState): PersistedState {
  const datasetName: DatasetName = input.datasetName === 'demo' || input.datasetName === 'testing' || input.datasetName === 'prod' ? input.datasetName : 'demo'
  const activePage: PageKey = input.activePage === 'family-tree' || input.activePage === 'impressum' || input.activePage === 'disclaimer' ? input.activePage : 'family-tree'

  return {
    version: 1,
    datasetName,
    activePage,
    pageTheme: sanitizeThemeState(input.pageTheme, defaultPageTheme),
    treeTheme: sanitizeThemeState(input.treeTheme, defaultTreeTheme),
    leftPanel: sanitizePanelState(input.leftPanel, defaultLeftPanel),
    rightPanel: sanitizePanelState(input.rightPanel, defaultRightPanel),
    legendMinimized: Boolean(input.legendMinimized),
    wideMode: Boolean(input.wideMode),
    filterLogic: isFilterLogic(input.filterLogic) ? input.filterLogic : 'and',
    showInTree: typeof input.showInTree === 'boolean' ? input.showInTree : true,
    fadeMode: isFadeMode(input.fadeMode) ? input.fadeMode : 'dim',
    filters: sanitizeFilterState(input.filters),
    searchQuery: typeof input.searchQuery === 'string' ? input.searchQuery : '',
  }
}

function readStoredState(): PersistedState | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as PersistedState
    return parsed.version === 1 ? normalizePersistedState(parsed) : null
  } catch {
    return null
  }
}

function formatTimeLabel(value: Person['birth']) {
  return value ? `${value.era} ${value.year}` : 'Unknown'
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportSvgAsPng(svgElement: SVGSVGElement, filename: string) {
  const clone = svgElement.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('style', collectSvgThemeVariables(svgElement))
  const serialized = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const width = svgElement.clientWidth || 1600
      const height = svgElement.clientHeight || 900
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')

      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to create canvas context.'))
        return
      }

      context.drawImage(image, 0, 0, width, height)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          URL.revokeObjectURL(url)
          reject(new Error('Unable to create PNG export.'))
          return
        }

        const pngUrl = URL.createObjectURL(pngBlob)
        const link = document.createElement('a')
        link.href = pngUrl
        link.download = filename
        link.click()
        URL.revokeObjectURL(pngUrl)
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to load SVG for export.'))
    }
    image.src = url
  })
}

async function exportSvgWithViewBoxAsPng(svgElement: SVGSVGElement, filename: string, viewBox: string) {
  const clone = svgElement.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('viewBox', viewBox)
  clone.setAttribute('width', '2200')
  clone.setAttribute('height', '1400')
  clone.setAttribute('style', collectSvgThemeVariables(svgElement))

  const serialized = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 2200
      canvas.height = 1400
      const context = canvas.getContext('2d')

      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to create export canvas.'))
        return
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          URL.revokeObjectURL(url)
          reject(new Error('Unable to create PNG export.'))
          return
        }

        const pngUrl = URL.createObjectURL(pngBlob)
        const link = document.createElement('a')
        link.href = pngUrl
        link.download = filename
        link.click()
        URL.revokeObjectURL(pngUrl)
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to load SVG for export.'))
    }
    image.src = url
  })
}

function collectSvgThemeVariables(svgElement: SVGSVGElement) {
  const computed = window.getComputedStyle(svgElement)
  const names = [
    '--preview3-tree-text',
    '--preview3-tree-muted',
    '--preview3-tree-border',
    '--preview3-tree-node-fill',
    '--preview3-tree-edge',
    '--preview3-tree-overlay',
    '--preview3-tree-accent',
    '--preview3-tree-bg',
  ]

  return names
    .map((name) => `${name}:${computed.getPropertyValue(name).trim()}`)
    .join(';')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isFilterActive(filters: FilterState) {
  return filters.houses.length > 0 || filters.species.length > 0 || filters.genders.length > 0 || filters.eras.length > 0
}

export default function Preview3App() {
  const storedState = readStoredState()
  const [activePage, setActivePage] = useState<PageKey>(storedState?.activePage ?? 'family-tree')
  const [menuOpen, setMenuOpen] = useState(false)
  const [datasetName, setDatasetName] = useState<DatasetName>(storedState?.datasetName ?? 'demo')
  const [pageTheme, setPageTheme] = useState<ThemeState>(storedState?.pageTheme ?? defaultPageTheme)
  const [treeTheme, setTreeTheme] = useState<ThemeState>(storedState?.treeTheme ?? defaultTreeTheme)
  const [leftPanel, setLeftPanel] = useState<PanelState>(storedState?.leftPanel ?? defaultLeftPanel)
  const [rightPanel, setRightPanel] = useState<PanelState>(storedState?.rightPanel ?? defaultRightPanel)
  const [legendMinimized, setLegendMinimized] = useState(storedState?.legendMinimized ?? false)
  const [wideMode, setWideMode] = useState(storedState?.wideMode ?? false)
  const [contentFullscreen, setContentFullscreen] = useState(false)
  const [browserFullscreen, setBrowserFullscreen] = useState(false)
  const [filterLogic, setFilterLogic] = useState<FilterLogic>(storedState?.filterLogic ?? 'and')
  const [showInTree, setShowInTree] = useState(storedState?.showInTree ?? true)
  const [fadeMode, setFadeMode] = useState<FadeMode>(storedState?.fadeMode ?? 'dim')
  const [filters, setFilters] = useState<FilterState>(storedState?.filters ?? emptyFilters)
  const [searchQuery, setSearchQuery] = useState(storedState?.searchQuery ?? '')
  const [graphState, setGraphState] = useState<GraphMvpState | null>(null)
  const [camera, setCamera] = useState<CameraView | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectionA, setSelectionA] = useState<UUID | null>(null)
  const [selectionB, setSelectionB] = useState<UUID | null>(null)
  const [spouseOwnerOverrides, setSpouseOwnerOverrides] = useState<Record<string, UUID>>({})
  const [focusedPersonId, setFocusedPersonId] = useState<UUID | null>(null)
  const [inspectedPersonId, setInspectedPersonId] = useState<UUID | null>(null)
  const [themeEditorScope, setThemeEditorScope] = useState<ThemeScope | null>(null)
  const [compactLayout, setCompactLayout] = useState(typeof window !== 'undefined' ? window.innerWidth < COMPACT_BREAKPOINT : false)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [panState, setPanState] = useState<PanState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [exportState, setExportState] = useState<'idle' | 'working' | 'error'>('idle')
  const [exportMessage, setExportMessage] = useState('')
  const canvasViewportRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pinchDistanceRef = useRef<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const panelId = useId().replace(/:/g, '-')

  useEffect(() => {
    let isMounted = true

    async function initialize() {
      setIsLoading(true)
      setErrorMessage(null)
      setSelectionA(null)
      setSelectionB(null)
      setSpouseOwnerOverrides({})
      setFocusedPersonId(null)
      setInspectedPersonId(null)

      try {
        const dataset = await loadDataset(datasetName)
        const { graphState: nextGraphState, initialCamera } = await buildPreview3TreePipeline(dataset)

        if (!isMounted) {
          return
        }

        setGraphState(nextGraphState)
        setCamera(initialCamera)
        setIsLoading(false)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : String(error))
        setIsLoading(false)
      }
    }

    void initialize()

    return () => {
      isMounted = false
    }
  }, [datasetName])

  useEffect(() => {
    const handleResize = () => {
      const nextCompact = window.innerWidth < COMPACT_BREAKPOINT
      setCompactLayout(nextCompact)

      if (nextCompact) {
        setLeftPanel((current) => ({ ...current, collapsed: true }))
        setRightPanel((current) => ({ ...current, collapsed: true }))
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setBrowserFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setThemeEditorScope(null)

        if (selectionA || selectionB) {
          setSelectionA(null)
          setSelectionB(null)
        } else {
          setFocusedPersonId(null)
          setInspectedPersonId(null)
        }
      }

      if (((event.ctrlKey && event.key.toLocaleLowerCase() === 'f') || (!event.ctrlKey && event.key.toLocaleLowerCase() === 'f' && activePage === 'family-tree'))) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }

      if (event.ctrlKey && event.key === '0' && graphState) {
        event.preventDefault()
        setCamera(getGraphBounds(graphState.layout.nodes))
      }

      if (event.key === 'F11' && activePage === 'family-tree') {
        event.preventDefault()
        void toggleBrowserFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activePage, graphState, selectionA, selectionB])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        datasetName,
        activePage,
        pageTheme,
        treeTheme,
        leftPanel,
        rightPanel,
        legendMinimized,
        wideMode,
        filterLogic,
        showInTree,
        fadeMode,
        filters,
        searchQuery,
      } satisfies PersistedState),
    )
  }, [activePage, datasetName, fadeMode, filterLogic, filters, leftPanel, legendMinimized, pageTheme, rightPanel, searchQuery, showInTree, treeTheme, wideMode])

  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const shellRect = canvasViewportRef.current?.getBoundingClientRect()
      if (!shellRect) {
        return
      }

      const panel = dragState.side === 'left' ? leftPanel : rightPanel
      const nextX = clamp(dragState.originX + (event.clientX - dragState.startX), 12, Math.max(12, shellRect.width - panel.width - 12))
      const nextY = clamp(dragState.originY + (event.clientY - dragState.startY), 64, Math.max(64, shellRect.height - panel.height - 12))

      if (dragState.side === 'left') {
        setLeftPanel((current) => ({ ...current, x: nextX, y: nextY }))
      } else {
        setRightPanel((current) => ({ ...current, x: nextX, y: nextY }))
      }
    }

    const stopDragging = () => {
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
    }
  }, [dragState, leftPanel, rightPanel])

  useEffect(() => {
    if (!resizeState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - resizeState.startX
      const deltaY = event.clientY - resizeState.startY

      if (resizeState.side === 'left') {
        setLeftPanel((current) => {
          const width = clamp(resizeState.originWidth + deltaX, 280, resizeState.undocked ? 640 : 520)
          const height = resizeState.undocked ? clamp(resizeState.originHeight + deltaY, 320, 900) : current.height
          return { ...current, width, height }
        })
      } else {
        setRightPanel((current) => {
          const width = clamp(resizeState.originWidth - deltaX, 280, resizeState.undocked ? 640 : 520)
          const height = resizeState.undocked ? clamp(resizeState.originHeight + deltaY, 320, 900) : current.height
          return { ...current, width, height }
        })
      }
    }

    const stopResizing = () => {
      setResizeState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
    }
  }, [resizeState])

  useEffect(() => {
    if (!panState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvasViewportRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }

      const deltaX = ((event.clientX - panState.startX) / rect.width) * panState.origin.width
      const deltaY = ((event.clientY - panState.startY) / rect.height) * panState.origin.height

      setCamera({
        ...panState.origin,
        x: panState.origin.x - deltaX,
        y: panState.origin.y - deltaY,
      })
    }

    const stopPanning = () => {
      setPanState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopPanning)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopPanning)
    }
  }, [panState])

  useEffect(() => {
    if (isLoading || activePage !== 'family-tree') {
      return
    }

    const shell = canvasViewportRef.current
    if (!shell) {
      return
    }

    const isPanelInteraction = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return false
      }

      return Boolean(target.closest('.preview3-panel-body, .preview3-stats-panel, .preview3-theme-editor'))
    }

    const isInsideTreeShell = (clientX: number, clientY: number) => {
      const rect = shell.getBoundingClientRect()
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    }

    const handleWheel = (event: WheelEvent) => {
      if (isPanelInteraction(event.target) || !isInsideTreeShell(event.clientX, event.clientY)) {
        return
      }

      event.preventDefault()
      zoomCanvas(event.deltaY, event.clientX, event.clientY)
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2 || isPanelInteraction(event.target)) {
        return
      }

      const first = event.touches[0]
      const second = event.touches[1]
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
      const centerX = (first.clientX + second.clientX) / 2
      const centerY = (first.clientY + second.clientY) / 2

      if (!isInsideTreeShell(centerX, centerY)) {
        pinchDistanceRef.current = null
        return
      }

      if (pinchDistanceRef.current === null) {
        pinchDistanceRef.current = distance
        event.preventDefault()
        return
      }

      const previousDistance = pinchDistanceRef.current
      const distanceDelta = Math.abs(distance - previousDistance)
      pinchDistanceRef.current = distance
      event.preventDefault()
      if (distanceDelta < 1.5 || distance <= 0) {
        return
      }

      const factor = clamp(previousDistance / distance, 0.92, 1.08)
      zoomCanvasWithFactor(factor, centerX, centerY)
    }

    const resetPinch = () => {
      pinchDistanceRef.current = null
    }

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    shell.addEventListener('touchmove', handleTouchMove, { passive: false })
    shell.addEventListener('touchend', resetPinch)
    shell.addEventListener('touchcancel', resetPinch)

    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true })
      shell.removeEventListener('touchmove', handleTouchMove)
      shell.removeEventListener('touchend', resetPinch)
      shell.removeEventListener('touchcancel', resetPinch)
    }
  }, [activePage, isLoading])

  useEffect(() => {
    if (!graphState || !showInTree || activePage !== 'family-tree') {
      return
    }

    const matchedNodes = new Map(
      searchResults
        .flatMap((person) => {
          const node = graphState.layout.nodes.get(person.id)
          return node ? [[person.id, node] as const] : []
        }),
    )

    if (matchedNodes.size === 0) {
      return
    }

    setCamera(getGraphBounds(matchedNodes))
  }, [activePage, filterLogic, filters, graphState, searchQuery, showInTree])

  const pagePalette = getActivePalette('page', pageTheme)
  const treePalette = getActivePalette('tree', treeTheme)
  const rootStyle = {
    '--preview3-page-bg': pagePalette.background,
    '--preview3-page-surface': pagePalette.surface,
    '--preview3-page-surface-strong': pagePalette.surfaceStrong,
    '--preview3-page-border': pagePalette.border,
    '--preview3-page-text': pagePalette.text,
    '--preview3-page-muted': pagePalette.muted,
    '--preview3-page-accent': pagePalette.accent,
    '--preview3-page-accent-soft': pagePalette.accentSoft,
    '--preview3-page-shadow': pagePalette.shadow ?? 'rgba(0, 0, 0, 0.18)',
    '--preview3-tree-bg': treePalette.background,
    '--preview3-tree-surface': treePalette.surface,
    '--preview3-tree-surface-strong': treePalette.surfaceStrong,
    '--preview3-tree-border': treePalette.border,
    '--preview3-tree-text': treePalette.text,
    '--preview3-tree-muted': treePalette.muted,
    '--preview3-tree-accent': treePalette.accent,
    '--preview3-tree-accent-soft': treePalette.accentSoft,
    '--preview3-tree-node-fill': treePalette.nodeFill ?? treePalette.surfaceStrong,
    '--preview3-tree-edge': treePalette.edge ?? treePalette.accent,
    '--preview3-tree-overlay': treePalette.overlay ?? treePalette.border,
    '--preview3-tree-shadow': treePalette.shadow ?? 'rgba(0, 0, 0, 0.16)',
    '--preview3-font-body': activePage === 'family-tree' ? treeTheme.fontBody : pageTheme.fontBody,
    '--preview3-font-display': activePage === 'family-tree' ? treeTheme.fontDisplay : pageTheme.fontDisplay,
  } as CSSProperties

  useEffect(() => {
    const root = document.documentElement
    const entries = Object.entries(rootStyle).filter(([key, value]) => key.startsWith('--') && typeof value === 'string') as Array<[string, string]>
    const previousValues = new Map<string, string | null>()

    entries.forEach(([key, value]) => {
      previousValues.set(key, root.style.getPropertyValue(key) || null)
      root.style.setProperty(key, value)
    })

    return () => {
      previousValues.forEach((previousValue, key) => {
        if (previousValue === null) {
          root.style.removeProperty(key)
        } else {
          root.style.setProperty(key, previousValue)
        }
      })
    }
  }, [rootStyle])

  if (errorMessage) {
    return (
      <main className="preview3-root preview3-loading" style={rootStyle}>
        <section className="preview3-loading-card">
          <p className="preview3-kicker">Legendarium Explorer</p>
          <h1>Preview3 could not start</h1>
          <p>{errorMessage}</p>
        </section>
      </main>
    )
  }

  if (isLoading || !graphState || !camera) {
    return (
      <main className="preview3-root preview3-loading" style={rootStyle}>
        <section className="preview3-loading-card">
          <p className="preview3-kicker">Legendarium Explorer</p>
          <h1>Preparing Preview3</h1>
          <p>Loading the dataset, validating biological relations, and building a deterministic first layout.</p>
        </section>
      </main>
    )
  }

  const cameraView = camera
  const { validation, layout } = graphState
  const houseOptions = Array.from(new Set(validation.persons.flatMap((person) => person.houses ?? []))).sort((left, right) => left.localeCompare(right))
  const speciesOptions = Array.from(new Set(validation.persons.map((person) => person.species).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right))
  const genderOptions = Array.from(new Set(validation.persons.map((person) => person.gender).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right))
  const eraOptions = Array.from(new Set(validation.persons.flatMap((person) => [person.birth?.era, person.death?.era].filter((value): value is string => Boolean(value))))).sort((left, right) => left.localeCompare(right))
  const hasActiveFilters = isFilterActive(filters)
  const viewState = buildPreview3ViewState({
    validation,
    filters,
    filterLogic,
    searchQuery,
    selectionA,
    selectionB,
    fadeMode,
  })
  const { filteredPeople, searchResults, matchingNodeIds, selectedIds, selectedSet, lcaAnalysis, highlightedEdgeIds, filteredOutNodeIds, shouldHideNode, shouldDimNode, hasBothSelections, lcaState } = viewState
  const renderedTree = buildPreview3RenderedTree({
    validation,
    layout,
    houseDefinitions: graphState.dataset.houseDefinitions,
    selectedIds,
    spouseOwnerOverrides,
    shouldHideNode,
  })
  const {
    spouseProjection,
    houseAnchors,
    overlayRelations,
    biologicalChildGroups,
  } = renderedTree
  const selectedCount = selectedIds.length
  const rightPanelShift = !rightPanel.collapsed && !rightPanel.undocked && !wideMode && !compactLayout ? rightPanel.width + 28 : 0
  const personA = selectionA ? validation.personById.get(selectionA) ?? null : null
  const personB = selectionB ? validation.personById.get(selectionB) ?? null : null
  const focusPerson = inspectedPersonId ? validation.personById.get(inspectedPersonId) ?? null : null
  const statsHidden = wideMode || contentFullscreen || compactLayout
  const pageTreeThemeLabel = `${pageTheme.mode} / ${treeTheme.mode}`

  function updateThemePreset(scope: ThemeScope, preset: ThemePreset) {
    if (scope === 'page') {
      setPageTheme((current) => ({ ...current, preset, mode: preset === 'custom' ? current.mode : 'thematic' }))
      if (preset !== 'custom' && themeEditorScope === 'page') {
        setThemeEditorScope(null)
      }
    } else {
      setTreeTheme((current) => ({ ...current, preset, mode: preset === 'custom' ? current.mode : 'thematic' }))
      if (preset !== 'custom' && themeEditorScope === 'tree') {
        setThemeEditorScope(null)
      }
    }
  }

  function updateThemeMode(scope: ThemeScope, mode: ThemeMode) {
    if (scope === 'page') {
      setPageTheme((current) => ({ ...current, mode, preset: mode === 'thematic' && current.preset === 'custom' ? 'tolkien' : current.preset }))
    } else {
      setTreeTheme((current) => ({ ...current, mode, preset: mode === 'thematic' && current.preset === 'custom' ? 'tolkien' : current.preset }))
    }
  }

  function updateCustomTheme(scope: ThemeScope, key: keyof ThemePalette, value: string) {
    if (scope === 'page') {
      setPageTheme((current) => ({ ...current, preset: 'custom', custom: { ...current.custom, [key]: value } }))
    } else {
      setTreeTheme((current) => ({ ...current, preset: 'custom', custom: { ...current.custom, [key]: value } }))
    }
  }

  function renderThemeModeToggle(scope: ThemeScope, theme: ThemeState) {
    return (
      <div className="preview3-mode-toggle" role="group" aria-label={`${scope} theme mode`}>
        <IconButton icon="sun" label="Light" active={theme.mode === 'light'} onClick={() => updateThemeMode(scope, 'light')} />
        <IconButton icon="moon" label="Dark" active={theme.mode === 'dark'} onClick={() => updateThemeMode(scope, 'dark')} />
        <IconButton icon="sparkle" label="Thematic" active={theme.mode === 'thematic'} onClick={() => updateThemeMode(scope, 'thematic')} />
      </div>
    )
  }

  function updateThemeFont(scope: ThemeScope, key: 'fontBody' | 'fontDisplay', value: string) {
    if (scope === 'page') {
      setPageTheme((current) => ({ ...current, [key]: value }))
    } else {
      setTreeTheme((current) => ({ ...current, [key]: value }))
    }
  }

  function centerPerson(personId: UUID, shouldInspect = true) {
    const node = layout.nodes.get(personId)
    if (!node) {
      return
    }

    setFocusedPersonId(personId)
    if (shouldInspect) {
      setInspectedPersonId(personId)
    }

    setCamera((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        x: node.x + node.width / 2 - current.width / 2,
        y: node.y + node.height / 2 - current.height / 2,
      }
    })
  }

  function assignSelection(slot: 'a' | 'b', personId: UUID) {
    setFocusedPersonId(personId)
    setInspectedPersonId(personId)
    startTransition(() => {
      if (slot === 'a') {
        setSelectionA(personId)
        setSelectionB((current) => current === personId ? null : current)
      } else {
        setSelectionB(personId)
        setSelectionA((current) => current === personId ? null : current)
      }
    })
  }

  function removeSelection(slot: 'a' | 'b') {
    if (slot === 'a') {
      setSelectionA(null)
    } else {
      setSelectionB(null)
    }
  }

  function toggleSelection(slot: 'a' | 'b', personId: UUID) {
    const alreadySelected = slot === 'a' ? selectionA === personId : selectionB === personId
    if (alreadySelected) {
      removeSelection(slot)
      return
    }

    assignSelection(slot, personId)
  }

  function handleNodeSelect(event: ReactMouseEvent<SVGGElement>, personId: UUID) {
    event.stopPropagation()
    startTransition(() => {
      if (event.shiftKey) {
        setSelectionB(personId)
        setSelectionA((current) => current === personId ? null : current)
      } else {
        setSelectionA(personId)
        setSelectionB((current) => current === personId ? null : current)
      }
    })

    setFocusedPersonId(personId)
    setInspectedPersonId(personId)
  }

  function clearSelection() {
    setSelectionA(null)
    setSelectionB(null)
    setFocusedPersonId(null)
    setInspectedPersonId(null)
  }

  function centerSelection(slot: 'a' | 'b') {
    const personId = slot === 'a' ? selectionA : selectionB
    if (!personId) {
      return
    }

    centerPerson(personId)
  }

  function swapSelections() {
    if (!selectionA || !selectionB || selectionA === selectionB) {
      return
    }

    setSelectionA(selectionB)
    setSelectionB(selectionA)
  }

  function centerLcaAncestor() {
    if (!lcaAnalysis) {
      return
    }

    centerPerson(lcaAnalysis.ancestorId)
  }

  function openSpouseContinuation(relationId: UUID, ownerId: UUID) {
    setSpouseOwnerOverrides((current) => ({
      ...current,
      [relationId]: ownerId,
    }))

    startTransition(() => {
      setSelectionA(ownerId)
      setSelectionB(null)
    })
  }

  function togglePanelCollapse(side: PanelSide) {
    if (side === 'left') {
      setLeftPanel((current) => ({ ...current, collapsed: !current.collapsed }))
    } else {
      setRightPanel((current) => ({ ...current, collapsed: !current.collapsed }))
    }
  }

  function togglePanelDock(side: PanelSide) {
    if (side === 'left') {
      setLeftPanel((current) => ({ ...current, undocked: !current.undocked }))
    } else {
      setRightPanel((current) => ({ ...current, undocked: !current.undocked }))
    }
  }

  function startPanelResize(side: PanelSide, undocked: boolean, event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    const panel = side === 'left' ? leftPanel : rightPanel
    setResizeState({
      side,
      undocked,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: panel.width,
      originHeight: panel.height,
    })
  }

  function startCanvasPan(event: ReactPointerEvent<SVGRectElement>) {
    if (event.pointerType === 'touch') {
      return
    }

    setPanState({ startX: event.clientX, startY: event.clientY, origin: cameraView })
  }

  function zoomCanvas(delta: number, clientX: number, clientY: number) {
    const factor = delta > 0 ? 1.08 : 0.92
    zoomCanvasWithFactor(factor, clientX, clientY)
  }

  function zoomCanvasWithFactor(factor: number, clientX: number, clientY: number) {
    const rect = canvasViewportRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const ratioX = (clientX - rect.left) / rect.width
    const ratioY = (clientY - rect.top) / rect.height

    setCamera((current) => {
      if (!current) {
        return current
      }

      const nextWidth = clamp(current.width * factor, 420, 5000)
      const nextHeight = clamp(current.height * factor, 320, 4200)
      const focusX = current.x + current.width * ratioX
      const focusY = current.y + current.height * ratioY

      return {
        width: nextWidth,
        height: nextHeight,
        x: focusX - nextWidth * ratioX,
        y: focusY - nextHeight * ratioY,
      }
    })
  }

  async function toggleBrowserFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  async function handlePngExport(scope: ExportScope = 'current') {
    if (!svgRef.current) {
      return
    }

    try {
      setExportState('working')
      setExportMessage('')
      if (scope === 'current') {
        await exportSvgAsPng(svgRef.current, `legendarium-preview3-${datasetName}-current.png`)
      } else {
        const visibleNodes = new Map(
          validation.persons
            .filter((person) => !shouldHideNode(person.id))
            .flatMap((person) => {
              const node = layout.nodes.get(person.id)
              return node ? [[person.id, node] as const] : []
            }),
        )
        const bounds = getGraphBounds(visibleNodes)
        await exportSvgWithViewBoxAsPng(
          svgRef.current,
          `legendarium-preview3-${datasetName}-all.png`,
          `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
        )
      }
      setExportState('idle')
    } catch (error) {
      setExportState('error')
      setExportMessage(error instanceof Error ? error.message : String(error))
    }
  }

  function handleJsonExport() {
    downloadText(
      `legendarium-preview3-${datasetName}.json`,
      JSON.stringify({ datasetName, selected: { a: selectionA, b: selectionB }, filters, filterLogic, warnings: validation.warnings, ignoredRelations: validation.ignoredRelations }, null, 2),
      'application/json',
    )
  }

  function toggleFilterValue(key: keyof FilterState, value: string) {
    setFilters((current) => {
      const values = current[key]
      return {
        ...current,
        [key]: values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value].sort((left, right) => left.localeCompare(right)),
      }
    })
  }

  function clearFilters() {
    setFilters(emptyFilters)
  }

  function resetPreview3Settings() {
    const confirmed = window.confirm('Reset all Preview3 settings? This only clears local Preview3 preferences.')
    if (!confirmed) {
      return
    }

    window.localStorage.removeItem(STORAGE_KEY)
    setActivePage('family-tree')
    setDatasetName('demo')
    setPageTheme(defaultPageTheme)
    setTreeTheme(defaultTreeTheme)
    setLeftPanel(defaultLeftPanel)
    setRightPanel(defaultRightPanel)
    setLegendMinimized(false)
    setWideMode(false)
    setContentFullscreen(false)
    setFilterLogic('and')
    setShowInTree(true)
    setFadeMode('dim')
    setFilters(emptyFilters)
    setSearchQuery('')
    setSelectionA(null)
    setSelectionB(null)
    setFocusedPersonId(null)
    setInspectedPersonId(null)
    setThemeEditorScope(null)
    setExportState('idle')
    setExportMessage('')
    setCamera(getGraphBounds(layout.nodes))
  }

  function renderFilterGroup(label: string, options: string[], active: string[], key: keyof FilterState) {
    return (
      <div className="preview3-filter-group">
        <div className="preview3-filter-label-row">
          <span>{label}</span>
          <strong>{active.length}</strong>
        </div>
        <div className="preview3-chip-grid">
          {options.map((option) => (
            <button key={option} type="button" className={`preview3-chip ${active.includes(option) ? 'active' : ''}`} onClick={() => toggleFilterValue(key, option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderLeftPanel() {
    return (
      <div className="preview3-panel-body">
        <section className="preview3-card-block preview3-lca-card">
          <div className="preview3-section-heading">
            <h3>Filter</h3>
            <button type="button" className="preview3-text-button" onClick={clearFilters}>Clear</button>
          </div>
          <div className="preview3-inline-controls">
            <button type="button" className={`preview3-chip ${filterLogic === 'and' ? 'active' : ''}`} onClick={() => setFilterLogic('and')}>AND</button>
            <button type="button" className={`preview3-chip ${filterLogic === 'or' ? 'active' : ''}`} onClick={() => setFilterLogic('or')}>OR</button>
            <label className="preview3-checkbox-row">
              <input type="checkbox" checked={showInTree} onChange={(event) => setShowInTree(event.target.checked)} />
              Auto-fit matched nodes
            </label>
          </div>
          {renderFilterGroup('House', houseOptions, filters.houses, 'houses')}
          {renderFilterGroup('Species', speciesOptions, filters.species, 'species')}
          {renderFilterGroup('Gender', genderOptions, filters.genders, 'genders')}
          {renderFilterGroup('Era', eraOptions, filters.eras, 'eras')}
          <p className="preview3-helper-text">{filteredPeople.length} matches in the current filter scope.</p>
        </section>

        <section className="preview3-card-block">
          <div className="preview3-section-heading">
            <h3>Search</h3>
            <span>{searchResults.length}</span>
          </div>
          <input ref={searchInputRef} className="preview3-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by name, house, species, era..." />
          <div className="preview3-search-results">
            {searchResults.map((person) => (
              <article key={person.id} className="preview3-result-card">
                <button type="button" className="preview3-result-main" onClick={() => centerPerson(person.id)}>
                  <strong>{person.name}</strong>
                  <span>{[person.species, person.gender, (person.houses ?? []).join(', ')].filter(Boolean).join(' • ') || 'No metadata'}</span>
                </button>
                <div className="preview3-result-actions preview3-result-actions-stack">
                  <IconButton
                    icon={selectionA === person.id ? 'remove-a' : 'add-a'}
                    label={selectionA === person.id ? 'Remove A' : 'Add A'}
                    className="preview3-search-action-button"
                    active={selectionA === person.id}
                    onClick={() => toggleSelection('a', person.id)}
                  />
                  <IconButton
                    icon={selectionB === person.id ? 'remove-b' : 'add-b'}
                    label={selectionB === person.id ? 'Remove B' : 'Add B'}
                    className="preview3-search-action-button"
                    active={selectionB === person.id}
                    onClick={() => toggleSelection('b', person.id)}
                  />
                </div>
              </article>
            ))}
            {searchResults.length === 0 ? <p className="preview3-empty">No results in the current filter scope.</p> : null}
          </div>
        </section>

        <section className="preview3-card-block">
          <div className="preview3-section-heading">
            <h3>Selection</h3>
            <span className="preview3-selection-summary">{selectedCount}/2 selected</span>
          </div>
          <div className="preview3-selection-actions">
            <button type="button" className="preview3-chip" onClick={swapSelections} disabled={!hasBothSelections}>Swap A/B</button>
            <button type="button" className="preview3-chip" onClick={clearSelection} disabled={selectedCount === 0}>Clear</button>
          </div>
          <p className="preview3-selection-row">
            <strong>A</strong>
            <span>{personA?.name ?? 'None selected'}</span>
            <span className="preview3-selection-row-actions">
              <button type="button" className="preview3-text-button" onClick={() => centerSelection('a')} disabled={!personA}>Focus</button>
              <button type="button" className="preview3-text-button" onClick={() => removeSelection('a')} disabled={!personA}>Remove</button>
            </span>
          </p>
          <p className="preview3-selection-row">
            <strong>B</strong>
            <span>{personB?.name ?? 'Use Shift+Click or Add B'}</span>
            <span className="preview3-selection-row-actions">
              <button type="button" className="preview3-text-button" onClick={() => centerSelection('b')} disabled={!personB}>Focus</button>
              <button type="button" className="preview3-text-button" onClick={() => removeSelection('b')} disabled={!personB}>Remove</button>
            </span>
          </p>
          <label className="preview3-field">
            <span>Fade unrelated</span>
            <AppSelect
              value={fadeMode}
              onValueChange={(value) => setFadeMode(value as FadeMode)}
              options={[
                { value: 'dim', label: 'Dim' },
                { value: 'hide', label: 'Hide' },
              ]}
              className="preview3-toolbar-select"
            />
          </label>
          <p className="preview3-helper-text">Click selects A. Shift+Click assigns B. ESC clears selection or closes overlays.</p>
        </section>
      </div>
    )
  }

  function renderPersonSummary(person: Person | null, slotLabel: string) {
    if (!person) {
      return (
        <div className="preview3-empty-card">
          <h3>{slotLabel}</h3>
          <p>No person selected.</p>
        </div>
      )
    }

    return (
      <div className="preview3-person-card">
        <div className="preview3-section-heading compact">
          <h3>{slotLabel}</h3>
          <div className="preview3-result-actions">
            <IconButton
              icon={selectionA === person.id ? 'remove-a' : 'add-a'}
              label={selectionA === person.id ? 'Remove from A' : 'Add as A'}
              className="preview3-search-action-button"
              onClick={() => toggleSelection('a', person.id)}
            />
            <IconButton
              icon={selectionB === person.id ? 'remove-b' : 'add-b'}
              label={selectionB === person.id ? 'Remove from B' : 'Add as B'}
              className="preview3-search-action-button"
              onClick={() => toggleSelection('b', person.id)}
            />
          </div>
        </div>
        <strong className="preview3-person-name">{person.name}</strong>
        <dl className="preview3-meta-grid">
          <div><dt>Gender</dt><dd>{person.gender ?? 'Unknown'}</dd></div>
          <div><dt>Species</dt><dd>{person.species ?? 'Unknown'}</dd></div>
          <div><dt>Birth</dt><dd>{formatTimeLabel(person.birth)}</dd></div>
          <div><dt>Death</dt><dd>{formatTimeLabel(person.death)}</dd></div>
          <div><dt>Houses</dt><dd>{(person.houses ?? []).join(', ') || 'None'}</dd></div>
          <div><dt>Sources</dt><dd>{person.sourceLinks?.length ?? 0}</dd></div>
        </dl>
      </div>
    )
  }

  function renderRightPanel() {
    const showSingleInspect = selectedCount <= 1
    const singlePerson = personA ?? focusPerson

    return (
      <div className="preview3-panel-body">
        {showSingleInspect ? renderPersonSummary(singlePerson, 'Inspector') : (
          <div className="preview3-split-column">
            {renderPersonSummary(personA, 'Person A')}
            {renderPersonSummary(personB, 'Person B')}
          </div>
        )}
        <section className="preview3-card-block">
          <div className="preview3-section-heading">
            <h3>LCA</h3>
            <div className="preview3-lca-heading-actions">
              <span className={`preview3-lca-state ${lcaState}`}>{lcaState === 'connected' ? 'Connected' : lcaState === 'disconnected' ? 'No path' : 'Idle'}</span>
              <button type="button" className="preview3-text-button" onClick={centerLcaAncestor} disabled={!lcaAnalysis}>Center ancestor</button>
            </div>
          </div>
          {lcaAnalysis ? (
            <div className="preview3-lca-block">
              <p><strong>Ancestor</strong><span>{validation.personById.get(lcaAnalysis.ancestorId)?.name ?? lcaAnalysis.ancestorId}</span></p>
              <p><strong>Generations</strong><span>{lcaAnalysis.edgeIds.size}</span></p>
              <p><strong>Path</strong><span>{lcaAnalysis.nodeIds.size} highlighted nodes</span></p>
            </div>
          ) : selectionA && selectionB ? (
            <p className="preview3-empty preview3-no-lca">No biological connection between the current A/B selection.</p>
          ) : (
            <p className="preview3-empty">Select two people to compute the biological lowest common ancestor.</p>
          )}
        </section>
      </div>
    )
  }

  function renderPrimaryPanel(side: PanelSide) {
    const state = side === 'left' ? leftPanel : rightPanel
    const title = side === 'left' ? 'Filter, Search & Selection' : 'Inspector & LCA'
    const panelStyle = state.undocked
      ? ({ left: state.x, top: state.y, width: state.width, height: state.height } as CSSProperties)
      : ({ width: state.width } as CSSProperties)

    if (state.collapsed) {
      return null
    }

    if (state.undocked) {
      return (
        <Rnd
          key={`undocked-${side}`}
          bounds=".preview3-canvas-shell"
          size={{ width: state.width, height: state.height }}
          position={{ x: state.x, y: state.y }}
          minWidth={280}
          maxWidth={640}
          minHeight={320}
          maxHeight={900}
          dragHandleClassName="preview3-panel-header"
          enableResizing
          onDragStop={(_, data) => {
            if (side === 'left') {
              setLeftPanel((current) => ({ ...current, x: data.x, y: data.y }))
            } else {
              setRightPanel((current) => ({ ...current, x: data.x, y: data.y }))
            }
          }}
          onResizeStop={(_, __, ref, ___, position) => {
            const width = clamp(ref.offsetWidth, 280, 640)
            const height = clamp(ref.offsetHeight, 320, 900)
            if (side === 'left') {
              setLeftPanel((current) => ({ ...current, width, height, x: position.x, y: position.y }))
            } else {
              setRightPanel((current) => ({ ...current, width, height, x: position.x, y: position.y }))
            }
          }}
        >
          <section className={`preview3-primary-panel preview3-primary-panel-${side} is-undocked`} style={{ width: state.width, height: state.height } as CSSProperties}>
            <div className="preview3-panel-header">
              <div className="preview3-panel-title">
                <p className="preview3-panel-kicker">Primary Panel</p>
                <h2>{title}</h2>
              </div>
              <div className="preview3-panel-actions">
                <IconButton icon="dock" label="Dock" subtle onClick={() => togglePanelDock(side)} />
                <IconButton icon="minimize" label="Minimize" subtle onClick={() => togglePanelCollapse(side)} />
              </div>
            </div>
            {side === 'left' ? renderLeftPanel() : renderRightPanel()}
          </section>
        </Rnd>
      )
    }

    return (
      <section className={`preview3-primary-panel preview3-primary-panel-${side}`} style={panelStyle}>
        <div className="preview3-panel-header">
          <div className="preview3-panel-title">
            <p className="preview3-panel-kicker">Primary Panel</p>
            <h2>{title}</h2>
          </div>
          <div className="preview3-panel-actions">
            <IconButton icon="float" label="Float" subtle onClick={() => togglePanelDock(side)} />
            <IconButton icon="minimize" label="Minimize" subtle onClick={() => togglePanelCollapse(side)} />
          </div>
        </div>
        <div className={`preview3-panel-resize-handle ${side}`} onPointerDown={(event) => startPanelResize(side, false, event)} role="presentation" />
        {side === 'left' ? renderLeftPanel() : renderRightPanel()}
      </section>
    )
  }

  function renderThemeEditor(scope: ThemeScope) {
    const theme = scope === 'page' ? pageTheme : treeTheme
    const palette = scope === 'page' ? pageTheme.custom : treeTheme.custom
    type ThemeField = {
      key: keyof ThemePalette
      label: string
    }
    type ThemeFieldGroup = {
      title: string
      description: string
      fields: ThemeField[]
    }
    const fieldGroups: ThemeFieldGroup[] = scope === 'page'
      ? [
          {
            title: 'Page chrome',
            description: 'Top shell, cards, and the navigation frame.',
            fields: [
              { key: 'background', label: 'Background' },
              { key: 'surface', label: 'Surface' },
              { key: 'surfaceStrong', label: 'Surface strong' },
              { key: 'border', label: 'Border' },
            ],
          },
          {
            title: 'Text & accent',
            description: 'Readable contrast and the interactive accent tone.',
            fields: [
              { key: 'text', label: 'Text' },
              { key: 'muted', label: 'Muted' },
              { key: 'accent', label: 'Accent' },
              { key: 'accentSoft', label: 'Accent soft' },
            ],
          },
        ]
      : [
          {
            title: 'Canvas',
            description: 'Main drawing surface and panel chrome.',
            fields: [
              { key: 'background', label: 'Canvas' },
              { key: 'surface', label: 'Surface' },
              { key: 'surfaceStrong', label: 'Surface strong' },
              { key: 'border', label: 'Border' },
            ],
          },
          {
            title: 'Tree marks',
            description: 'Node fill, biological edges, and social overlays.',
            fields: [
              { key: 'nodeFill', label: 'Node fill' },
              { key: 'edge', label: 'Biological edge' },
              { key: 'overlay', label: 'Overlay edge' },
              { key: 'accent', label: 'Accent' },
            ],
          },
        ]

    return (
      <aside className="preview3-theme-editor" aria-label={`${scope} theme editor`}>
        <div className="preview3-theme-editor-header preview3-section-heading">
          <div>
            <p className="preview3-panel-kicker">{scope === 'page' ? 'Page Theme Editor' : 'Tree Theme Editor'}</p>
            <h2>{scope === 'page' ? 'Global page chrome' : 'Family tree workspace'}</h2>
          </div>
          <IconButton icon="close" label="Close" subtle onClick={() => setThemeEditorScope(null)} iconOnly />
        </div>
        <div className="preview3-theme-editor-grid">
          {fieldGroups.map((group) => (
            <section key={group.title} className="preview3-theme-group">
              <div className="preview3-section-heading compact">
                <div>
                  <h3>{group.title}</h3>
                  <p className="preview3-helper-text">{group.description}</p>
                </div>
              </div>
              <div className="preview3-theme-fields">
                {group.fields.map((field) => {
                  const value = (palette[field.key] as string | undefined) ?? '#ffffff'

                  return (
                    <label key={field.key} className="preview3-theme-field">
                      <span>{field.label}</span>
                      <div className="preview3-theme-field-row">
                        <input
                          type="color"
                          value={value}
                          aria-label={field.label}
                          onChange={(event) => updateCustomTheme(scope, field.key, event.target.value)}
                        />
                        <code>{value.toUpperCase()}</code>
                      </div>
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
        <section className="preview3-theme-group footer">
          <div className="preview3-section-heading compact">
            <div>
              <h3>Typography</h3>
              <p className="preview3-helper-text">Font pairs for chrome and content.</p>
            </div>
          </div>
          <div className="preview3-theme-fields typography">
            <label className="preview3-field">
              <span>Body font</span>
              <AppSelect
                value={theme.fontBody}
                onValueChange={(value) => updateThemeFont(scope, 'fontBody', value)}
                options={fontOptions.map((font) => ({ value: font, label: font.split(',')[0] }))}
                className="preview3-toolbar-select"
              />
            </label>
            <label className="preview3-field">
              <span>Display font</span>
              <AppSelect
                value={theme.fontDisplay}
                onValueChange={(value) => updateThemeFont(scope, 'fontDisplay', value)}
                options={fontOptions.map((font) => ({ value: font, label: font.split(',')[0] }))}
                className="preview3-toolbar-select"
              />
            </label>
          </div>
        </section>
      </aside>
    )
  }

  function renderTreeCanvas() {
    if (!cameraView || !graphState) {
      return <section className="preview3-workspace" />
    }

    return (
      <Preview3TreeCanvas
        browserFullscreen={browserFullscreen}
        contentFullscreen={contentFullscreen}
        exportMessage={exportMessage}
        exportState={exportState}
        fadeMode={fadeMode}
        focusedPersonId={focusedPersonId}
        filteredOutNodeIds={filteredOutNodeIds}
        highlightedEdgeIds={highlightedEdgeIds}
        houseAnchors={houseAnchors}
        cameraView={cameraView}
        layout={layout}
        lcaAnalysis={lcaAnalysis}
        legendMinimized={legendMinimized}
        matchingNodeIds={matchingNodeIds}
        leftPanelCollapsed={leftPanel.collapsed}
        rightPanelCollapsed={rightPanel.collapsed}
        panelId={panelId}
        rightPanelShift={rightPanelShift}
        selectionA={selectionA}
        selectionB={selectionB}
        selectedSet={selectedSet}
        shouldDimNode={shouldDimNode}
        shouldHideNode={shouldHideNode}
        startCanvasPan={startCanvasPan}
        treeTheme={treeTheme}
        validation={validation}
        wideMode={wideMode}
        canvasViewportRef={canvasViewportRef}
        svgRef={svgRef}
        biologicalChildGroups={biologicalChildGroups}
        overlayRelations={overlayRelations}
        spouseProjection={spouseProjection}
        renderPrimaryPanel={renderPrimaryPanel}
        renderThemeModeToggle={renderThemeModeToggle}
        onResetView={() => setCamera(expandCameraBounds(getGraphBounds(layout.nodes), spouseProjection.nodes, houseAnchors))}
        onBrowserFullscreenToggle={toggleBrowserFullscreen}
        onContentFullscreenToggle={() => setContentFullscreen((current) => !current)}
        onContentFullscreenClose={() => setContentFullscreen(false)}
        onExportJson={handleJsonExport}
        onExportPng={handlePngExport}
        onLegendToggle={() => setLegendMinimized((current) => !current)}
        onOpenSpouseContinuation={openSpouseContinuation}
        onPanelCollapse={togglePanelCollapse}
        onTreeThemeEditorToggle={() => setThemeEditorScope(themeEditorScope === 'tree' ? null : 'tree')}
        onTreeThemePresetChange={(preset: ThemePreset) => updateThemePreset('tree', preset)}
        onWideModeToggle={() => setWideMode((current) => !current)}
        onClearSelection={clearSelection}
        onNodeSelect={handleNodeSelect}
      />
    )
  }

  function renderFamilyPage() {
    const statsPanel = (
      <aside className="preview3-page-stats-panel">
        <div className="preview3-section-heading preview3-page-stats-heading">
          <div>
            <p className="preview3-panel-kicker">Secondary Panel</p>
            <h2>Global Statistics</h2>
          </div>
          <span className={`preview3-status-pill ${validation.status}`}>{validation.status}</span>
        </div>
        <div className="preview3-page-stats-grid">
          <article><span>Persons</span><strong>{validation.persons.length}</strong></article>
          <article><span>Connections</span><strong>{validation.validBiologicalRelations.length}</strong></article>
          <article><span>Warnings</span><strong>{validation.warnings.length}</strong></article>
          <article><span>Components</span><strong>{validation.disconnectedComponents}</strong></article>
        </div>
        <section className="preview3-page-card-block stats">
          <div className="preview3-section-heading">
            <h3>Dataset</h3>
            <span>{datasetName}</span>
          </div>
          <label className="preview3-field">
            <span>Scenario source</span>
            <AppSelect
              value={datasetName}
              onValueChange={(value) => setDatasetName(value as DatasetName)}
              options={[
                { value: 'demo', label: 'Demo' },
                { value: 'testing', label: 'Testing' },
                { value: 'prod', label: 'Prod' },
              ]}
              className="preview3-toolbar-select"
            />
          </label>
          <p className="preview3-helper-text">Persistence is global across datasets, as agreed for v1.</p>
        </section>
        <section className="preview3-page-card-block stats">
          <div className="preview3-section-heading">
            <h3>Workspace State</h3>
            <span>{pageTreeThemeLabel}</span>
          </div>
          <ul className="preview3-inline-list">
            <li>{wideMode ? 'Horizontal space active' : 'Default canvas width'}</li>
            <li>{hasActiveFilters ? 'Filters active' : 'No active filters'}</li>
            <li>{selectedCount} selected person{selectedCount === 1 ? '' : 's'}</li>
          </ul>
          <button type="button" className="preview3-toolbar-button preview3-reset-settings" onClick={resetPreview3Settings}>
            <Preview3Icon name="reset" />
            <span>Reset settings</span>
          </button>
        </section>
        <section className="preview3-page-card-block stats">
          <div className="preview3-section-heading">
            <h3>Warnings</h3>
            <span>{validation.warnings.length}</span>
          </div>
          <div className="preview3-warning-list">
            {validation.warnings.slice(0, 8).map((warning) => (
              <article key={`${warning.code}-${warning.relationId ?? warning.personId ?? warning.message}`}>
                <strong>{warning.code}</strong>
                <p>{warning.message}</p>
              </article>
            ))}
            {validation.warnings.length === 0 ? <p className="preview3-empty">No data warnings in this dataset slice.</p> : null}
          </div>
        </section>
      </aside>
    )

    return (
      <Preview3FamilyPage
        wideMode={wideMode}
        contentFullscreen={contentFullscreen}
        compactLayout={compactLayout}
        statsHidden={statsHidden}
        renderTreeCanvas={renderTreeCanvas}
        statsPanel={statsPanel}
      />
    )
  }

  function renderStaticPage(title: string, body: string, secondary: string) {
    return (
      <section className="preview3-static-page">
        <p className="preview3-kicker">Legendarium Explorer</p>
        <h1>{title}</h1>
        <p>{body}</p>
        <article className="preview3-static-card">
          <h2>Current intent</h2>
          <p>{secondary}</p>
          <p>Page theme remains active here to keep the separation between app chrome and tree workspace unambiguous.</p>
        </article>
      </section>
    )
  }

  return (
    <main className={`preview3-root ${contentFullscreen && activePage === 'family-tree' ? 'hide-header' : ''}`} style={rootStyle}>
      <Preview3Header
        activePage={activePage}
        menuOpen={menuOpen}
        pageTheme={pageTheme}
        themeEditorScope={themeEditorScope}
        onMenuOpenChange={setMenuOpen}
        onPageChange={setActivePage}
        onPageThemePresetChange={(preset) => updateThemePreset('page', preset)}
        onPageThemeEditorToggle={() => setThemeEditorScope(themeEditorScope === 'page' ? null : 'page')}
        renderThemeModeToggle={renderThemeModeToggle}
      />
      <section className="preview3-content">
        {activePage === 'family-tree' ? renderFamilyPage() : null}
        {activePage === 'impressum' ? renderStaticPage('Impressum', 'This preview rebuild is the controlled exploration surface for static genealogy datasets in Legendarium Explorer.', 'The page exists already so navigation, page theming, and long-term information architecture are exercised before future subpages arrive.') : null}
        {activePage === 'disclaimer' ? renderStaticPage('Disclaimer', 'Dataset quality may vary. Invalid biological relations are ignored deterministically and surfaced as warnings rather than crashing the explorer.', 'This page is intentionally simple in v1, but it already uses the final page shell and theme governance expected by the product contract.') : null}
      </section>
      {themeEditorScope === 'page' ? renderThemeEditor('page') : null}
    </main>
  )
}


