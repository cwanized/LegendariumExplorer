import type { DatasetName } from '../graph'

export type PageKey = 'family-tree' | 'impressum' | 'disclaimer'
export type ThemeMode = 'light' | 'dark' | 'thematic'
export type ThemePreset = 'tolkien' | 'gondor' | 'rohan' | 'mirkwood' | 'imladris' | 'custom'
export type ThemeScope = 'page' | 'tree'
export type FilterLogic = 'and' | 'or'
export type FadeMode = 'dim' | 'hide'
export type PanelSide = 'left' | 'right'
export type ExportScope = 'current' | 'all'

export type ThemePalette = {
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

export type ThemeState = {
  mode: ThemeMode
  preset: ThemePreset
  custom: ThemePalette
  fontBody: string
  fontDisplay: string
}

export type PanelState = {
  collapsed: boolean
  undocked: boolean
  x: number
  y: number
  width: number
  height: number
}

export type FilterState = {
  houses: string[]
  species: string[]
  genders: string[]
  eras: string[]
}

export type PersistedState = {
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

export const defaultPageTheme: ThemeState = {
  mode: 'light',
  preset: 'custom',
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

export const defaultTreeTheme: ThemeState = {
  mode: 'light',
  preset: 'custom',
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

export const defaultLeftPanel: PanelState = {
  collapsed: false,
  undocked: false,
  x: 24,
  y: 84,
  width: 336,
  height: 640,
}

export const defaultRightPanel: PanelState = {
  collapsed: false,
  undocked: false,
  x: 820,
  y: 84,
  width: 336,
  height: 640,
}

export const emptyFilters: FilterState = {
  houses: [],
  species: [],
  genders: [],
  eras: [],
}
