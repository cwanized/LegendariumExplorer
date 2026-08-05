import { startTransition, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import './Preview2App.css'
import {
  findLowestCommonAncestor,
  getGraphBounds,
  layoutGraph,
  loadDataset,
  validateDataset,
} from './graph'
import type {
  CameraView,
  DatasetName,
  GraphMvpState,
  Person,
  UUID,
} from './graph'

type PageKey = 'family-tree' | 'impressum' | 'disclaimer'
type ThemeMode = 'light' | 'dark' | 'thematic'
type ThemePreset = 'tolkien' | 'gondor' | 'rohan' | 'mirkwood' | 'imladris' | 'custom'
type ThemeScope = 'page' | 'tree'
type FilterLogic = 'and' | 'or'
type FadeMode = 'dim' | 'hide'
type PanelSide = 'left' | 'right'
type ExportScope = 'current' | 'all'

type ThemePalette = {
  background: string
  surface: string
  surfaceStrong: string
  border: string
  text: string
  muted: string
  accent: string
  accentSoft: string
  nodeFill?: string
  edge?: string
  overlay?: string
  shadow?: string
}

type ThemeState = {
  mode: ThemeMode
  preset: ThemePreset
  custom: ThemePalette
  fontBody: string
  fontDisplay: string
}

type PanelState = {
  collapsed: boolean
  undocked: boolean
  x: number
  y: number
  width: number
  height: number
}

type FilterState = {
  houses: string[]
  species: string[]
  genders: string[]
  eras: string[]
}

type PersistedState = {
  version: number
  datasetName: DatasetName
  activePage: PageKey
  pageTheme: ThemeState
  treeTheme: ThemeState
  leftPanel: PanelState
  rightPanel: PanelState
  legendMinimized: boolean
  wideMode: boolean
  filterLogic: FilterLogic
  showInTree: boolean
  fadeMode: FadeMode
  filters: FilterState
  searchQuery: string
}

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

type IconName =
  | 'menu'
  | 'reset'
  | 'horizontal'
  | 'content-fullscreen'
  | 'browser-fullscreen'
  | 'separator'
  | 'image'
  | 'json'
  | 'theme'
  | 'editor'
  | 'float'
  | 'dock'
  | 'minimize'
  | 'restore-left'
  | 'restore-right'
  | 'close'
  | 'add-a'
  | 'add-b'
  | 'remove-a'
  | 'remove-b'
  | 'sun'
  | 'moon'
  | 'sparkle'

const STORAGE_KEY = 'legendarium.preview2.preferences.v1'
const COMPACT_BREAKPOINT = 1024

const fontOptions = [
  'Aptos, Segoe UI Variable, Trebuchet MS, sans-serif',
  'Source Sans 3, Aptos, Segoe UI Variable, sans-serif',
  'Iowan Old Style, Palatino Linotype, Book Antiqua, serif',
  'Cormorant Garamond, Palatino Linotype, serif',
]

const defaultPageTheme: ThemeState = {
  mode: 'light',
  preset: 'tolkien',
  custom: {
    background: '#ebe5d8',
    surface: '#f8f4eb',
    surfaceStrong: '#fffdf8',
    border: '#a28f75',
    text: '#1b1917',
    muted: '#64594c',
    accent: '#315770',
    accentSoft: '#d7e3eb',
    shadow: 'rgba(33, 26, 18, 0.18)',
  },
  fontBody: 'Aptos, Segoe UI Variable, Trebuchet MS, sans-serif',
  fontDisplay: 'Iowan Old Style, Palatino Linotype, Book Antiqua, serif',
}

const defaultTreeTheme: ThemeState = {
  mode: 'light',
  preset: 'tolkien',
  custom: {
    background: '#f6f3eb',
    surface: '#fffdf7',
    surfaceStrong: '#ffffff',
    border: '#8f846f',
    text: '#201c17',
    muted: '#5d5347',
    accent: '#244e72',
    accentSoft: '#d3e5f0',
    nodeFill: '#fff9ef',
    edge: '#40627e',
    overlay: '#8e6434',
    shadow: 'rgba(33, 26, 18, 0.16)',
  },
  fontBody: 'Aptos, Segoe UI Variable, Trebuchet MS, sans-serif',
  fontDisplay: 'Iowan Old Style, Palatino Linotype, Book Antiqua, serif',
}

const defaultLeftPanel: PanelState = {
  collapsed: false,
  undocked: false,
  x: 24,
  y: 84,
  width: 336,
  height: 640,
}

const defaultRightPanel: PanelState = {
  collapsed: false,
  undocked: false,
  x: 820,
  y: 84,
  width: 336,
  height: 640,
}

const emptyFilters: FilterState = {
  houses: [],
  species: [],
  genders: [],
  eras: [],
}

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

function getActivePalette(scope: ThemeScope, theme: ThemeState) {
  if (theme.preset === 'custom') {
    return theme.custom
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

function buildSearchText(person: Person) {
  return [
    person.name,
    person.gender ?? '',
    person.species ?? '',
    ...(person.houses ?? []),
    person.birth?.era ?? '',
    person.death?.era ?? '',
    person.birth?.year?.toString() ?? '',
    person.death?.year?.toString() ?? '',
    person.metadata?.description ?? '',
  ].join(' ').toLocaleLowerCase()
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
    '--preview2-tree-text',
    '--preview2-tree-muted',
    '--preview2-tree-border',
    '--preview2-tree-node-fill',
    '--preview2-tree-edge',
    '--preview2-tree-overlay',
    '--preview2-tree-accent',
    '--preview2-tree-bg',
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

function Preview2Icon({ name }: { name: IconName }) {
  if (name === 'separator') {
    return <span className="preview2-toolbar-separator" aria-hidden="true" />
  }

  const commonProps = {
    className: 'preview2-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'menu':
      return <svg {...commonProps}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
    case 'reset':
      return <svg {...commonProps}><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /></svg>
    case 'horizontal':
      return <svg {...commonProps}><path d="M3 12h18" /><path d="M7 8l-4 4 4 4" /><path d="M17 8l4 4-4 4" /></svg>
    case 'content-fullscreen':
      return <svg {...commonProps}><path d="M8 4H4v4" /><path d="M16 4h4v4" /><path d="M8 20H4v-4" /><path d="M16 20h4v-4" /></svg>
    case 'browser-fullscreen':
      return <svg {...commonProps}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v16" /></svg>
    case 'image':
      return <svg {...commonProps}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m8 14 2.6-2.6a1 1 0 0 1 1.4 0L16 15" /><circle cx="9" cy="9" r="1.2" /></svg>
    case 'json':
      return <svg {...commonProps}><path d="M9 4c-2 1-2 3-2 8s0 7-2 8" /><path d="M15 4c2 1 2 3 2 8s0 7 2 8" /><path d="M11 8h2" /><path d="M11 12h2" /><path d="M11 16h2" /></svg>
    case 'theme':
      return <svg {...commonProps}><path d="M12 3a7.5 7.5 0 1 0 7.5 7.5A6 6 0 0 1 12 3Z" /></svg>
    case 'editor':
      return <svg {...commonProps}><path d="m4 20 4.5-1 8.8-8.8a1.8 1.8 0 0 0 0-2.5l-1-1a1.8 1.8 0 0 0-2.5 0L5 15.5 4 20Z" /><path d="M12 6l6 6" /></svg>
    case 'float':
      return <svg {...commonProps}><rect x="5" y="7" width="12" height="10" rx="2" /><path d="M9 5h10v10" /></svg>
    case 'dock':
      return <svg {...commonProps}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 5v14" /></svg>
    case 'minimize':
      return <svg {...commonProps}><path d="M5 12h14" /></svg>
    case 'restore-left':
      return <svg {...commonProps}><path d="M7 7h10v10H7z" /><path d="M11 5 7 9" /></svg>
    case 'restore-right':
      return <svg {...commonProps}><path d="M7 7h10v10H7z" /><path d="m13 5 4 4" /></svg>
    case 'close':
      return <svg {...commonProps}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
    case 'add-a':
      return <svg {...commonProps}><circle cx="9" cy="10" r="3" /><path d="M15 8h5" /><path d="M17.5 5.5v5" /><path d="M4 19c1.5-2.4 3.1-3.6 5-3.6 1.9 0 3.5 1.2 5 3.6" /></svg>
    case 'add-b':
      return <svg {...commonProps}><circle cx="9" cy="10" r="3" /><path d="M15 7.5c.8-.6 1.6-.9 2.5-.9 1.8 0 3 1.2 3 2.8S19.3 12 17.5 12c-.9 0-1.7-.3-2.5-.9" /><path d="M4 19c1.5-2.4 3.1-3.6 5-3.6 1.9 0 3.5 1.2 5 3.6" /></svg>
    case 'remove-a':
      return <svg {...commonProps}><circle cx="9" cy="10" r="3" /><path d="M15 8h5" /><path d="M4 19c1.5-2.4 3.1-3.6 5-3.6 1.9 0 3.5 1.2 5 3.6" /></svg>
    case 'remove-b':
      return <svg {...commonProps}><circle cx="9" cy="10" r="3" /><path d="M15 9.5h5" /><path d="M4 19c1.5-2.4 3.1-3.6 5-3.6 1.9 0 3.5 1.2 5 3.6" /></svg>
    case 'sun':
      return <svg {...commonProps}><circle cx="12" cy="12" r="4" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="m4.9 4.9 2.1 2.1" /><path d="m17 17 2.1 2.1" /><path d="M2 12h3" /><path d="M19 12h3" /><path d="m4.9 19.1 2.1-2.1" /><path d="m17 7 2.1-2.1" /></svg>
    case 'moon':
      return <svg {...commonProps}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" /></svg>
    case 'sparkle':
      return <svg {...commonProps}><path d="M12 3 13.7 8.3 19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z" /><path d="M19 3v3" /><path d="M20.5 4.5h-3" /></svg>
  }
}

function IconButton({ icon, label, active, onClick, title, subtle = false, className = '', iconOnly = true, disabled = false }: { icon: IconName, label: string, active?: boolean, onClick?: () => void, title?: string, subtle?: boolean, className?: string, iconOnly?: boolean, disabled?: boolean }) {
  return (
    <button type="button" className={`preview2-toolbar-button ${subtle ? 'subtle' : ''} ${active ? 'active' : ''} ${iconOnly ? 'icon-only' : ''} ${className}`.trim()} onClick={onClick} title={title ?? label} aria-label={title ?? label} disabled={disabled}>
      <Preview2Icon name={icon} />
      {iconOnly ? <span className="preview2-sr-only">{label}</span> : <span>{label}</span>}
    </button>
  )
}

export default function Preview2App() {
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
  const [focusedPersonId, setFocusedPersonId] = useState<UUID | null>(null)
  const [inspectedPersonId, setInspectedPersonId] = useState<UUID | null>(null)
  const [themeEditorScope, setThemeEditorScope] = useState<ThemeScope | null>(null)
  const [compactLayout, setCompactLayout] = useState(typeof window !== 'undefined' ? window.innerWidth < COMPACT_BREAKPOINT : false)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [panState, setPanState] = useState<PanState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [pngMenuOpen, setPngMenuOpen] = useState(false)
  const [exportState, setExportState] = useState<'idle' | 'working' | 'error'>('idle')
  const [exportMessage, setExportMessage] = useState('')
  const canvasViewportRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const panelId = useId().replace(/:/g, '-')

  useEffect(() => {
    let isMounted = true

    async function initialize() {
      setIsLoading(true)
      setErrorMessage(null)
      setSelectionA(null)
      setSelectionB(null)
      setFocusedPersonId(null)
      setInspectedPersonId(null)

      try {
        const dataset = await loadDataset(datasetName)
        const validation = validateDataset(dataset)
        const layout = await layoutGraph(validation.persons, validation.validBiologicalRelations)
        const bounds = getGraphBounds(layout.nodes)

        if (!isMounted) {
          return
        }

        setGraphState({ dataset, validation, layout, contractScenario: null, contractEvaluation: null })
        setCamera(bounds)
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
    if (!pngMenuOpen) {
      return
    }

    const handlePointerDown = () => {
      setPngMenuOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [pngMenuOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setThemeEditorScope(null)
        setPngMenuOpen(false)

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
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomCanvas(event.deltaY, event.clientX, event.clientY)
    }

    svg.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      svg.removeEventListener('wheel', handleWheel)
    }
  }, [camera])

  useEffect(() => {
    if (!graphState || !showInTree || activePage !== 'family-tree') {
      return
    }

    const searchValue = searchQuery.trim().toLocaleLowerCase()
    const personMatchesFilters = (person: Person) => {
      const matchesByCategory = [
        filters.houses.length === 0 ? null : (person.houses ?? []).some((house) => filters.houses.includes(house)),
        filters.species.length === 0 ? null : (person.species ? filters.species.includes(person.species) : false),
        filters.genders.length === 0 ? null : (person.gender ? filters.genders.includes(person.gender) : false),
        filters.eras.length === 0 ? null : filters.eras.some((era) => era === person.birth?.era || era === person.death?.era),
      ].filter((value): value is boolean => value !== null)

      if (matchesByCategory.length === 0) {
        return true
      }

      return filterLogic === 'and' ? matchesByCategory.every(Boolean) : matchesByCategory.some(Boolean)
    }

    const matchedNodes = new Map(
      graphState.validation.persons
        .filter((person) => personMatchesFilters(person) && (searchValue.length === 0 || buildSearchText(person).includes(searchValue)))
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
    '--preview2-page-bg': pagePalette.background,
    '--preview2-page-surface': pagePalette.surface,
    '--preview2-page-surface-strong': pagePalette.surfaceStrong,
    '--preview2-page-border': pagePalette.border,
    '--preview2-page-text': pagePalette.text,
    '--preview2-page-muted': pagePalette.muted,
    '--preview2-page-accent': pagePalette.accent,
    '--preview2-page-accent-soft': pagePalette.accentSoft,
    '--preview2-page-shadow': pagePalette.shadow ?? 'rgba(0, 0, 0, 0.18)',
    '--preview2-tree-bg': treePalette.background,
    '--preview2-tree-surface': treePalette.surface,
    '--preview2-tree-surface-strong': treePalette.surfaceStrong,
    '--preview2-tree-border': treePalette.border,
    '--preview2-tree-text': treePalette.text,
    '--preview2-tree-muted': treePalette.muted,
    '--preview2-tree-accent': treePalette.accent,
    '--preview2-tree-accent-soft': treePalette.accentSoft,
    '--preview2-tree-node-fill': treePalette.nodeFill ?? treePalette.surfaceStrong,
    '--preview2-tree-edge': treePalette.edge ?? treePalette.accent,
    '--preview2-tree-overlay': treePalette.overlay ?? treePalette.border,
    '--preview2-tree-shadow': treePalette.shadow ?? 'rgba(0, 0, 0, 0.16)',
    '--preview2-font-body': activePage === 'family-tree' ? treeTheme.fontBody : pageTheme.fontBody,
    '--preview2-font-display': activePage === 'family-tree' ? treeTheme.fontDisplay : pageTheme.fontDisplay,
  } as CSSProperties

  if (errorMessage) {
    return (
      <main className="preview2-root preview2-loading" style={rootStyle}>
        <section className="preview2-loading-card">
          <p className="preview2-kicker">Legendarium Explorer</p>
          <h1>Preview2 could not start</h1>
          <p>{errorMessage}</p>
        </section>
      </main>
    )
  }

  if (isLoading || !graphState || !camera) {
    return (
      <main className="preview2-root preview2-loading" style={rootStyle}>
        <section className="preview2-loading-card">
          <p className="preview2-kicker">Legendarium Explorer</p>
          <h1>Preparing Preview2</h1>
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
  const searchValue = searchQuery.trim().toLocaleLowerCase()
  const hasActiveFilters = isFilterActive(filters)

  const personMatchesFilters = (person: Person) => {
    const matchesByCategory = [
      filters.houses.length === 0 ? null : (person.houses ?? []).some((house) => filters.houses.includes(house)),
      filters.species.length === 0 ? null : (person.species ? filters.species.includes(person.species) : false),
      filters.genders.length === 0 ? null : (person.gender ? filters.genders.includes(person.gender) : false),
      filters.eras.length === 0 ? null : filters.eras.some((era) => era === person.birth?.era || era === person.death?.era),
    ].filter((value): value is boolean => value !== null)

    if (matchesByCategory.length === 0) {
      return true
    }

    return filterLogic === 'and' ? matchesByCategory.every(Boolean) : matchesByCategory.some(Boolean)
  }

  const personMatchesSearch = (person: Person) => {
    if (searchValue.length === 0) {
      return true
    }

    return buildSearchText(person).includes(searchValue)
  }

  const filteredPeople = validation.persons.filter((person) => personMatchesFilters(person))
  const searchResults = filteredPeople.filter((person) => personMatchesSearch(person)).slice(0, 40)
  const matchingPeople = filteredPeople.filter((person) => personMatchesSearch(person))
  const matchingNodeIds = new Set(matchingPeople.map((person) => person.id))
  const selectedIds = [selectionA, selectionB].filter((value): value is UUID => Boolean(value))
  const lcaAnalysis = selectionA && selectionB ? findLowestCommonAncestor(selectionA, selectionB, validation) : null
  const hiddenBySelection = new Set<UUID>()

  if (lcaAnalysis && fadeMode === 'hide') {
    validation.persons.forEach((person) => {
      if (!lcaAnalysis.nodeIds.has(person.id) && person.id !== selectionA && person.id !== selectionB) {
        hiddenBySelection.add(person.id)
      }
    })
  }

  const shouldHideNode = (personId: UUID) => {
    return hiddenBySelection.has(personId)
  }

  const shouldDimNode = (personId: UUID) => {
    return Boolean(lcaAnalysis && fadeMode === 'dim' && !lcaAnalysis.nodeIds.has(personId) && personId !== selectionA && personId !== selectionB)
  }

  const biologicalRelations = validation.validBiologicalRelations.filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
  const overlayRelations = validation.validOverlayRelations.filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
  const selectedCount = selectedIds.length
  const rightPanelShift = !rightPanel.collapsed && !rightPanel.undocked && !wideMode && !compactLayout ? rightPanel.width + 28 : 0
  const personA = selectionA ? validation.personById.get(selectionA) ?? null : null
  const personB = selectionB ? validation.personById.get(selectionB) ?? null : null
  const focusPerson = inspectedPersonId ? validation.personById.get(inspectedPersonId) ?? null : null
  const statsHidden = wideMode || contentFullscreen || compactLayout
  const treeThemeLabel = `${treeTheme.mode} / ${treeTheme.preset}`

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
      <div className="preview2-mode-toggle" role="group" aria-label={`${scope} theme mode`}>
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

  function resetView() {
    setCamera(getGraphBounds(layout.nodes))
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

  function startPanelDrag(side: PanelSide, event: ReactPointerEvent<HTMLDivElement>) {
    const panel = side === 'left' ? leftPanel : rightPanel
    if (!panel.undocked) {
      return
    }

    setDragState({ side, startX: event.clientX, startY: event.clientY, originX: panel.x, originY: panel.y })
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
    setPanState({ startX: event.clientX, startY: event.clientY, origin: cameraView })
  }

  function zoomCanvas(delta: number, clientX: number, clientY: number) {
    const rect = canvasViewportRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const factor = delta > 0 ? 1.08 : 0.92
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
        await exportSvgAsPng(svgRef.current, `legendarium-preview2-${datasetName}-current.png`)
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
          `legendarium-preview2-${datasetName}-all.png`,
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
      `legendarium-preview2-${datasetName}.json`,
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

  function resetPreview2Settings() {
    const confirmed = window.confirm('Reset all Preview2 settings? This only clears local Preview2 preferences.')
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
    setPngMenuOpen(false)
    setExportState('idle')
    setExportMessage('')
    setCamera(getGraphBounds(layout.nodes))
  }

  function renderFilterGroup(label: string, options: string[], active: string[], key: keyof FilterState) {
    return (
      <div className="preview2-filter-group">
        <div className="preview2-filter-label-row">
          <span>{label}</span>
          <strong>{active.length}</strong>
        </div>
        <div className="preview2-chip-grid">
          {options.map((option) => (
            <button key={option} type="button" className={`preview2-chip ${active.includes(option) ? 'active' : ''}`} onClick={() => toggleFilterValue(key, option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderLeftPanel() {
    return (
      <div className="preview2-panel-body">
        <section className="preview2-card-block">
          <div className="preview2-section-heading">
            <h3>Filter</h3>
            <button type="button" className="preview2-text-button" onClick={clearFilters}>Clear</button>
          </div>
          <div className="preview2-inline-controls">
            <button type="button" className={`preview2-chip ${filterLogic === 'and' ? 'active' : ''}`} onClick={() => setFilterLogic('and')}>AND</button>
            <button type="button" className={`preview2-chip ${filterLogic === 'or' ? 'active' : ''}`} onClick={() => setFilterLogic('or')}>OR</button>
            <label className="preview2-checkbox-row">
              <input type="checkbox" checked={showInTree} onChange={(event) => setShowInTree(event.target.checked)} />
              Auto-fit matched nodes
            </label>
          </div>
          {renderFilterGroup('House', houseOptions, filters.houses, 'houses')}
          {renderFilterGroup('Species', speciesOptions, filters.species, 'species')}
          {renderFilterGroup('Gender', genderOptions, filters.genders, 'genders')}
          {renderFilterGroup('Era', eraOptions, filters.eras, 'eras')}
          <p className="preview2-helper-text">{filteredPeople.length} matches in the current filter scope.</p>
        </section>

        <section className="preview2-card-block">
          <div className="preview2-section-heading">
            <h3>Search</h3>
            <span>{searchResults.length}</span>
          </div>
          <input ref={searchInputRef} className="preview2-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by name, house, species, era..." />
          <div className="preview2-search-results">
            {searchResults.map((person) => (
              <article key={person.id} className="preview2-result-card">
                <button type="button" className="preview2-result-main" onClick={() => centerPerson(person.id)}>
                  <strong>{person.name}</strong>
                  <span>{[person.species, person.gender, (person.houses ?? []).join(', ')].filter(Boolean).join(' • ') || 'No metadata'}</span>
                </button>
                <div className="preview2-result-actions preview2-result-actions-stack">
                  <IconButton
                    icon={selectionA === person.id ? 'remove-a' : 'add-a'}
                    label={selectionA === person.id ? 'Remove A' : 'Add A'}
                    className="preview2-search-action-button"
                    active={selectionA === person.id}
                    onClick={() => toggleSelection('a', person.id)}
                  />
                  <IconButton
                    icon={selectionB === person.id ? 'remove-b' : 'add-b'}
                    label={selectionB === person.id ? 'Remove B' : 'Add B'}
                    className="preview2-search-action-button"
                    active={selectionB === person.id}
                    onClick={() => toggleSelection('b', person.id)}
                  />
                </div>
              </article>
            ))}
            {searchResults.length === 0 ? <p className="preview2-empty">No results in the current filter scope.</p> : null}
          </div>
        </section>

        <section className="preview2-card-block">
          <div className="preview2-section-heading">
            <h3>Selection</h3>
            <button type="button" className="preview2-text-button" onClick={clearSelection}>Clear</button>
          </div>
          <p className="preview2-selection-row"><strong>A</strong><span>{personA?.name ?? 'None selected'}</span><button type="button" className="preview2-text-button" onClick={() => removeSelection('a')} disabled={!personA}>Remove</button></p>
          <p className="preview2-selection-row"><strong>B</strong><span>{personB?.name ?? 'Use Shift+Click or Add B'}</span><button type="button" className="preview2-text-button" onClick={() => removeSelection('b')} disabled={!personB}>Remove</button></p>
          <label className="preview2-field">
            <span>Fade unrelated</span>
            <select value={fadeMode} onChange={(event) => setFadeMode(event.target.value as FadeMode)}>
              <option value="dim">Dim</option>
              <option value="hide">Hide</option>
            </select>
          </label>
          <p className="preview2-helper-text">Click selects A. Shift+Click assigns B. ESC clears selection or closes overlays.</p>
        </section>
      </div>
    )
  }

  function renderPersonSummary(person: Person | null, slotLabel: string) {
    if (!person) {
      return (
        <div className="preview2-empty-card">
          <h3>{slotLabel}</h3>
          <p>No person selected.</p>
        </div>
      )
    }

    return (
      <div className="preview2-person-card">
        <div className="preview2-section-heading compact">
          <h3>{slotLabel}</h3>
          <div className="preview2-result-actions">
            <IconButton
              icon={selectionA === person.id ? 'remove-a' : 'add-a'}
              label={selectionA === person.id ? 'Remove from A' : 'Add as A'}
              className="preview2-search-action-button"
              onClick={() => toggleSelection('a', person.id)}
            />
            <IconButton
              icon={selectionB === person.id ? 'remove-b' : 'add-b'}
              label={selectionB === person.id ? 'Remove from B' : 'Add as B'}
              className="preview2-search-action-button"
              onClick={() => toggleSelection('b', person.id)}
            />
          </div>
        </div>
        <strong className="preview2-person-name">{person.name}</strong>
        <dl className="preview2-meta-grid">
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
      <div className="preview2-panel-body">
        {showSingleInspect ? renderPersonSummary(singlePerson, 'Inspector') : (
          <div className="preview2-split-column">
            {renderPersonSummary(personA, 'Person A')}
            {renderPersonSummary(personB, 'Person B')}
          </div>
        )}
        <section className="preview2-card-block">
          <div className="preview2-section-heading">
            <h3>LCA</h3>
            <span>{selectionA && selectionB ? 'Active' : 'Idle'}</span>
          </div>
          {lcaAnalysis ? (
            <div className="preview2-lca-block">
              <p><strong>Ancestor</strong><span>{validation.personById.get(lcaAnalysis.ancestorId)?.name ?? lcaAnalysis.ancestorId}</span></p>
              <p><strong>Generations</strong><span>{lcaAnalysis.edgeIds.size}</span></p>
              <p><strong>Path</strong><span>{lcaAnalysis.nodeIds.size} highlighted nodes</span></p>
            </div>
          ) : selectionA && selectionB ? (
            <p className="preview2-empty preview2-no-lca">No biological connection between the current A/B selection.</p>
          ) : (
            <p className="preview2-empty">Select two people to compute the biological lowest common ancestor.</p>
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

    return (
      <section className={`preview2-primary-panel preview2-primary-panel-${side} ${state.undocked ? 'is-undocked' : ''}`} style={panelStyle}>
        <div className="preview2-panel-header" onPointerDown={(event) => startPanelDrag(side, event)}>
          <div>
            <p className="preview2-panel-kicker">Primary Panel</p>
            <h2>{title}</h2>
          </div>
          <div className="preview2-panel-actions">
            <IconButton icon={state.undocked ? 'dock' : 'float'} label={state.undocked ? 'Dock' : 'Float'} subtle onClick={() => togglePanelDock(side)} />
            <IconButton icon="minimize" label="Minimize" subtle onClick={() => togglePanelCollapse(side)} />
          </div>
        </div>
        <div className={`preview2-panel-resize-handle ${side}`} onPointerDown={(event) => startPanelResize(side, false, event)} role="presentation" />
        {state.undocked ? <div className="preview2-panel-resize-corner" onPointerDown={(event) => startPanelResize(side, true, event)} role="presentation" /> : null}
        {side === 'left' ? renderLeftPanel() : renderRightPanel()}
      </section>
    )
  }

  function renderThemeEditor(scope: ThemeScope) {
    const theme = scope === 'page' ? pageTheme : treeTheme
    const palette = scope === 'page' ? pageTheme.custom : treeTheme.custom
    const fields: Array<{ key: keyof ThemePalette; label: string }> = scope === 'page'
      ? [
          { key: 'background', label: 'Background' },
          { key: 'surface', label: 'Surface' },
          { key: 'surfaceStrong', label: 'Surface Strong' },
          { key: 'border', label: 'Border' },
          { key: 'text', label: 'Text' },
          { key: 'muted', label: 'Muted' },
          { key: 'accent', label: 'Accent' },
          { key: 'accentSoft', label: 'Accent Soft' },
        ]
      : [
          { key: 'background', label: 'Canvas' },
          { key: 'surface', label: 'Panel Surface' },
          { key: 'surfaceStrong', label: 'Inner Surface' },
          { key: 'border', label: 'Border' },
          { key: 'text', label: 'Text' },
          { key: 'muted', label: 'Muted' },
          { key: 'accent', label: 'Accent' },
          { key: 'nodeFill', label: 'Node Fill' },
          { key: 'edge', label: 'Bio Edge' },
          { key: 'overlay', label: 'Overlay Edge' },
        ]

    return (
      <aside className="preview2-theme-editor" aria-label={`${scope} theme editor`}>
        <div className="preview2-section-heading">
          <div>
            <p className="preview2-panel-kicker">{scope === 'page' ? 'Page Theme Editor' : 'Tree Theme Editor'}</p>
            <h2>{scope === 'page' ? 'Global page chrome' : 'Family tree workspace'}</h2>
          </div>
          <IconButton icon="close" label="Close" subtle onClick={() => setThemeEditorScope(null)} iconOnly />
        </div>
        <div className="preview2-theme-editor-grid">
          {fields.map((field) => (
            <label key={field.key} className="preview2-color-field">
              <span>{field.label}</span>
              <input type="color" value={(palette[field.key] as string | undefined) ?? '#ffffff'} onChange={(event) => updateCustomTheme(scope, field.key, event.target.value)} />
            </label>
          ))}
        </div>
        <label className="preview2-field">
          <span>Body font</span>
          <select value={theme.fontBody} onChange={(event) => updateThemeFont(scope, 'fontBody', event.target.value)}>
            {fontOptions.map((font) => <option key={font} value={font}>{font.split(',')[0]}</option>)}
          </select>
        </label>
        <label className="preview2-field">
          <span>Display font</span>
          <select value={theme.fontDisplay} onChange={(event) => updateThemeFont(scope, 'fontDisplay', event.target.value)}>
            {fontOptions.map((font) => <option key={font} value={font}>{font.split(',')[0]}</option>)}
          </select>
        </label>
      </aside>
    )
  }

  function renderTreeCanvas() {
    return (
      <section className={`preview2-workspace ${contentFullscreen ? 'content-fullscreen' : ''}`}>
        {!contentFullscreen ? null : <button type="button" className="preview2-close-fullscreen preview2-close-fullscreen-compact" title="Close content fullscreen" aria-label="Close content fullscreen" onClick={() => setContentFullscreen(false)}><Preview2Icon name="close" /></button>}
        <div className="preview2-toolbar-row">
          <div className="preview2-toolbar-group">
            <IconButton icon="reset" label="Reset View" onClick={resetView} />
            <IconButton icon="horizontal" label="Horizontal Space" active={wideMode} onClick={() => setWideMode((current) => !current)} />
            <IconButton icon="content-fullscreen" label="Content Fullscreen" active={contentFullscreen} onClick={() => setContentFullscreen((current) => !current)} />
            <IconButton icon="browser-fullscreen" label="F11" active={browserFullscreen} title="Browser Fullscreen" onClick={() => void toggleBrowserFullscreen()} />
          </div>
          <Preview2Icon name="separator" />
          <div className="preview2-toolbar-group">
            <div className="preview2-inline-menu" onPointerDown={(event) => event.stopPropagation()}>
              <IconButton icon="image" label="Export PNG" active={pngMenuOpen} onClick={() => setPngMenuOpen((current) => !current)} />
              {pngMenuOpen ? (
                <div className="preview2-inline-menu-popover" role="menu" aria-label="PNG export scope">
                  <button type="button" role="menuitem" onClick={() => { setPngMenuOpen(false); void handlePngExport('current') }}>Current view</button>
                  <button type="button" role="menuitem" onClick={() => { setPngMenuOpen(false); void handlePngExport('all') }}>All filtered</button>
                </div>
              ) : null}
            </div>
            <IconButton icon="json" label="Export JSON" onClick={handleJsonExport} />
          </div>
          <Preview2Icon name="separator" />
          <div className="preview2-toolbar-group align-end">
            {renderThemeModeToggle('tree', treeTheme)}
            <select className="preview2-toolbar-select" value={treeTheme.preset} onChange={(event) => updateThemePreset('tree', event.target.value as ThemePreset)}>
              <option value="tolkien">Tolkien</option>
              <option value="gondor">Gondor</option>
              <option value="rohan">Rohan</option>
              <option value="mirkwood">Mirkwood</option>
              <option value="imladris">Imladris</option>
              <option value="custom">Custom</option>
            </select>
            <IconButton icon="editor" label="Editor" disabled={treeTheme.preset !== 'custom'} onClick={() => setThemeEditorScope(themeEditorScope === 'tree' ? null : 'tree')} />
          </div>
        </div>
        <div ref={canvasViewportRef} className="preview2-canvas-shell">
          {leftPanel.collapsed ? <button type="button" className="preview2-restore-button left" onClick={() => togglePanelCollapse('left')}><Preview2Icon name="restore-left" /><span>Restore Filter</span></button> : null}
          {rightPanel.collapsed ? <button type="button" className="preview2-restore-button right" onClick={() => togglePanelCollapse('right')}><Preview2Icon name="restore-right" /><span>Restore Inspect</span></button> : null}
          {renderPrimaryPanel('left')}
          {renderPrimaryPanel('right')}
          <svg
            ref={svgRef}
            className="preview2-graph"
            viewBox={`${cameraView.x} ${cameraView.y} ${cameraView.width} ${cameraView.height}`}
            role="img"
            aria-label="Family tree graph"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                clearSelection()
              }
            }}
          >
            <defs>
              <pattern id={`${panelId}-grid`} width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="var(--preview2-tree-border)" strokeOpacity="0.18" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x={cameraView.x - 800} y={cameraView.y - 800} width={cameraView.width + 1600} height={cameraView.height + 1600} fill={`url(#${panelId}-grid)`} />
            <rect x={cameraView.x - 800} y={cameraView.y - 800} width={cameraView.width + 1600} height={cameraView.height + 1600} fill="transparent" onPointerDown={startCanvasPan} />
            {biologicalRelations.map((relation) => {
              const fromNode = layout.nodes.get(relation.from)
              const toNode = layout.nodes.get(relation.to)
              if (!fromNode || !toNode) {
                return null
              }

              const startX = fromNode.x + fromNode.width / 2
              const startY = fromNode.y + fromNode.height
              const endX = toNode.x + toNode.width / 2
              const endY = toNode.y
              const midpointY = startY + (endY - startY) / 2
              const isHighlighted = lcaAnalysis?.edgeIds.has(relation.id) ?? false
              const isDimmed = Boolean(lcaAnalysis && fadeMode === 'dim' && !isHighlighted)

              return (
                <path
                  key={relation.id}
                  d={`M ${startX} ${startY} L ${startX} ${midpointY} L ${endX} ${midpointY} L ${endX} ${endY}`}
                  fill="none"
                  stroke={isHighlighted ? 'var(--preview2-tree-accent)' : 'var(--preview2-tree-edge)'}
                  strokeWidth={isHighlighted ? 4 : 2.2}
                  strokeOpacity={isDimmed ? 0.22 : 0.82}
                />
              )
            })}
            {overlayRelations.map((relation) => {
              const fromNode = layout.nodes.get(relation.from)
              const toNode = layout.nodes.get(relation.to)
              if (!fromNode || !toNode) {
                return null
              }

              return (
                <line
                  key={relation.id}
                  x1={fromNode.x + fromNode.width / 2}
                  y1={fromNode.y + fromNode.height / 2}
                  x2={toNode.x + toNode.width / 2}
                  y2={toNode.y + toNode.height / 2}
                  stroke="var(--preview2-tree-overlay)"
                  strokeWidth={1.6}
                  strokeDasharray="7 7"
                  strokeOpacity={0.58}
                />
              )
            })}
            {validation.persons.map((person) => {
              const node = layout.nodes.get(person.id)
              if (!node || shouldHideNode(person.id)) {
                return null
              }

              const isSelected = selectionA === person.id || selectionB === person.id
              const isFocused = focusedPersonId === person.id
              const isDimmed = shouldDimNode(person.id)
              const isMatched = matchingNodeIds.has(person.id)
              const warningCount = validation.warnings.filter((warning) => warning.personId === person.id).length
              const hasSources = (person.sourceLinks?.length ?? 0) > 0

              return (
                <g key={person.id} onClick={(event) => handleNodeSelect(event, person.id)} className="preview2-node-group">
                  {isMatched ? <rect x={node.x - 4} y={node.y - 4} rx={22} ry={22} width={node.width + 8} height={node.height + 8} fill="none" stroke="var(--preview2-tree-accent)" strokeOpacity={0.65} strokeWidth={2.4} /> : null}
                  <rect x={node.x} y={node.y} rx={18} ry={18} width={node.width} height={node.height} fill="var(--preview2-tree-node-fill)" stroke={isSelected ? 'var(--preview2-tree-accent)' : 'var(--preview2-tree-border)'} strokeWidth={isFocused || isSelected ? 3.5 : 1.6} opacity={isDimmed ? 0.28 : 1} />
                  <text x={node.x + 14} y={node.y + 24} className="preview2-svg-name">{person.name}</text>
                  <text x={node.x + 14} y={node.y + 44} className="preview2-svg-meta">{[person.species ?? 'unknown', (person.houses ?? [])[0] ?? 'no house'].join(' • ')}</text>
                  {warningCount > 0 ? <circle cx={node.x + node.width - 18} cy={node.y + 18} r={6} fill="#cc7a2f" opacity={isDimmed ? 0.4 : 1} /> : null}
                  {hasSources ? <circle cx={node.x + node.width - 34} cy={node.y + 18} r={5} fill="#4975a0" opacity={isDimmed ? 0.4 : 1} /> : null}
                </g>
              )
            })}
          </svg>
          <section className={`preview2-legend ${legendMinimized ? 'minimized' : ''}`} style={{ right: `${16 + rightPanelShift}px` }}>
            <div className="preview2-section-heading compact">
              <h3>Legend</h3>
              <button type="button" className="preview2-text-button" onClick={() => setLegendMinimized((current) => !current)}>{legendMinimized ? 'Open' : 'Min'}</button>
            </div>
            {legendMinimized ? null : (
              <div className="preview2-legend-grid">
                <p><span className="preview2-legend-swatch node" />Person node</p>
                <p><span className="preview2-legend-swatch bio" />Biological parent edge</p>
                <p><span className="preview2-legend-swatch overlay" />Social overlay edge</p>
                <p><span className="preview2-legend-swatch warning" />Warning marker</p>
                <p><span className="preview2-legend-swatch source" />Source available</p>
                <p><span className="preview2-legend-swatch selected" />Selected or focused</p>
              </div>
            )}
          </section>
          {themeEditorScope === 'tree' ? renderThemeEditor('tree') : null}
        </div>
        {exportState === 'error' ? <p className="preview2-export-error">{exportMessage}</p> : null}
      </section>
    )
  }

  function renderFamilyPage() {
    return (
      <div className={`preview2-family-layout ${wideMode ? 'wide-mode' : ''} ${contentFullscreen ? 'content-fullscreen' : ''}`}>
        {renderTreeCanvas()}
        {statsHidden ? null : (
          <aside className="preview2-stats-panel">
            <div className="preview2-section-heading">
              <div>
                <p className="preview2-panel-kicker">Secondary Panel</p>
                <h2>Global Statistics</h2>
              </div>
              <span className={`preview2-status-pill ${validation.status}`}>{validation.status}</span>
            </div>
            <div className="preview2-stats-grid">
              <article><span>Persons</span><strong>{validation.persons.length}</strong></article>
              <article><span>Connections</span><strong>{validation.validBiologicalRelations.length}</strong></article>
              <article><span>Warnings</span><strong>{validation.warnings.length}</strong></article>
              <article><span>Components</span><strong>{validation.disconnectedComponents}</strong></article>
            </div>
            <section className="preview2-card-block stats">
              <div className="preview2-section-heading">
                <h3>Dataset</h3>
                <span>{datasetName}</span>
              </div>
              <label className="preview2-field">
                <span>Scenario source</span>
                <select value={datasetName} onChange={(event) => setDatasetName(event.target.value as DatasetName)}>
                  <option value="demo">Demo</option>
                  <option value="testing">Testing</option>
                  <option value="prod">Prod</option>
                </select>
              </label>
              <p className="preview2-helper-text">Persistence is global across datasets, as agreed for v1.</p>
            </section>
            <section className="preview2-card-block stats">
              <div className="preview2-section-heading">
                <h3>Workspace State</h3>
                <span>{treeThemeLabel}</span>
              </div>
              <ul className="preview2-inline-list">
                <li>{wideMode ? 'Horizontal space active' : 'Default canvas width'}</li>
                <li>{hasActiveFilters ? 'Filters active' : 'No active filters'}</li>
                <li>{selectedCount} selected person{selectedCount === 1 ? '' : 's'}</li>
              </ul>
              <button type="button" className="preview2-toolbar-button preview2-reset-settings" onClick={resetPreview2Settings}>
                <Preview2Icon name="reset" />
                <span>Reset settings</span>
              </button>
            </section>
            <section className="preview2-card-block stats">
              <div className="preview2-section-heading">
                <h3>Warnings</h3>
                <span>{validation.warnings.length}</span>
              </div>
              <div className="preview2-warning-list">
                {validation.warnings.slice(0, 8).map((warning) => (
                  <article key={`${warning.code}-${warning.relationId ?? warning.personId ?? warning.message}`}>
                    <strong>{warning.code}</strong>
                    <p>{warning.message}</p>
                  </article>
                ))}
                {validation.warnings.length === 0 ? <p className="preview2-empty">No data warnings in this dataset slice.</p> : null}
              </div>
            </section>
          </aside>
        )}
      </div>
    )
  }

  function renderStaticPage(title: string, body: string, secondary: string) {
    return (
      <section className="preview2-static-page">
        <p className="preview2-kicker">Legendarium Explorer</p>
        <h1>{title}</h1>
        <p>{body}</p>
        <article className="preview2-static-card">
          <h2>Current intent</h2>
          <p>{secondary}</p>
          <p>Page theme remains active here to keep the separation between app chrome and tree workspace unambiguous.</p>
        </article>
      </section>
    )
  }

  return (
    <main className={`preview2-root ${contentFullscreen && activePage === 'family-tree' ? 'hide-header' : ''}`} style={rootStyle}>
      <header className="preview2-header">
        <div className="preview2-brand-row">
          <button type="button" className="preview2-hamburger preview2-hamburger-icon" title={menuOpen ? 'Close menu' : 'Open menu'} aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((current) => !current)}><Preview2Icon name="menu" /></button>
          <div>
            <p className="preview2-kicker">Legendarium Explorer</p>
            <strong className="preview2-brand-title">Legendarium Explorer</strong>
          </div>
        </div>
        <div className="preview2-header-controls">
          {renderThemeModeToggle('page', pageTheme)}
          <select className="preview2-toolbar-select" value={pageTheme.preset} onChange={(event) => updateThemePreset('page', event.target.value as ThemePreset)}>
            <option value="tolkien">Tolkien</option>
            <option value="gondor">Gondor</option>
            <option value="rohan">Rohan</option>
            <option value="mirkwood">Mirkwood</option>
            <option value="imladris">Imladris</option>
            <option value="custom">Custom</option>
          </select>
          <IconButton icon="editor" label="Editor" disabled={pageTheme.preset !== 'custom'} onClick={() => setThemeEditorScope(themeEditorScope === 'page' ? null : 'page')} />
        </div>
      </header>
      {menuOpen ? (
        <div className="preview2-menu-overlay" onClick={() => setMenuOpen(false)}>
          <nav className="preview2-menu-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className={`preview2-menu-item ${activePage === 'family-tree' ? 'active' : ''}`} onClick={() => { setActivePage('family-tree'); setMenuOpen(false) }}>Family Tree</button>
            <button type="button" className="preview2-menu-item disabled" disabled>Timeline</button>
            <button type="button" className="preview2-menu-item disabled" disabled>Map View</button>
            <div className="preview2-menu-divider" />
            <button type="button" className={`preview2-menu-item ${activePage === 'impressum' ? 'active' : ''}`} onClick={() => { setActivePage('impressum'); setMenuOpen(false) }}>Impressum</button>
            <button type="button" className={`preview2-menu-item ${activePage === 'disclaimer' ? 'active' : ''}`} onClick={() => { setActivePage('disclaimer'); setMenuOpen(false) }}>Disclaimer</button>
          </nav>
        </div>
      ) : null}
      <section className="preview2-content">
        {activePage === 'family-tree' ? renderFamilyPage() : null}
        {activePage === 'impressum' ? renderStaticPage('Impressum', 'This preview rebuild is the controlled exploration surface for static genealogy datasets in Legendarium Explorer.', 'The page exists already so navigation, page theming, and long-term information architecture are exercised before future subpages arrive.') : null}
        {activePage === 'disclaimer' ? renderStaticPage('Disclaimer', 'Dataset quality may vary. Invalid biological relations are ignored deterministically and surfaced as warnings rather than crashing the explorer.', 'This page is intentionally simple in v1, but it already uses the final page shell and theme governance expected by the product contract.') : null}
      </section>
      {themeEditorScope === 'page' ? renderThemeEditor('page') : null}
    </main>
  )
}