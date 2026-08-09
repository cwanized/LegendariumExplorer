import type { PreviewTreeMode } from './state'
import { createModeCDefinition } from './modeC'
import { createModeDDefinition } from './modeD'
import { createModeRDefinition } from './modeR'
import { createModeR2Definition } from './modeR2'

export type Preview3PipelineStage =
  | 'validate-dataset'
  | 'base-layout'
  | 'single-child-centering'
  | 'two-parent-child-axis-alignment'
  | 'marriage-pair-alignment'
  | 'curated-person-order'
  | 'curated-person-offsets'
  | 'house-subtree-offsets'
  | 'house-anchor-placement'
  | 'render-tree-preparation'

export type Preview3LayoutStrategy = 'legacy' | 'enhanced'
export type Preview3HouseAnchorStrategy = 'legacy' | 'enhanced'
export type Preview3MarriageOverlayStyle = 'dashed' | 'rigid'
export type Preview3HouseYOffsetUnitSource = 'fixed' | 'generation'
export type Preview3HouseAnchorVerticalAlignment = 'global-top-row' | 'founder-top-row'
export type Preview3ProjectionDuplicateStrategy = 'none' | 'single-sided' | 'double-sided'
export type Preview3ProjectionParentlessStrategy = 'allow' | 'suppress'

export type Preview3SpouseProjectionPolicy = {
  enabled: boolean
  collapseChildEdges: boolean
  duplicateStrategy: Preview3ProjectionDuplicateStrategy
  parentlessStrategy: Preview3ProjectionParentlessStrategy
  preferSameRowPlacement: boolean
}

export type Preview3ModeDefinition = {
  id: PreviewTreeMode
  shortLabel: string
  label: string
  summary: string
  pipeline: {
    stages: Preview3PipelineStage[]
    layoutStrategy: Preview3LayoutStrategy
    houseAnchorStrategy: Preview3HouseAnchorStrategy
    applyMarriagePairAlignment: boolean
    applyCuratedPersonOrder: boolean
    applyCuratedPersonOffsets: boolean
    layoutComponentSpacing: number
    layoutXScale: number
    layoutYScale: number
    applyHouseSubtreeOffsets: boolean
    applyHouseSubtreeVerticalOffset: boolean
    applyHouseAnchorYOffset: boolean
    houseYOffsetUnit: number
    houseYOffsetUnitSource: Preview3HouseYOffsetUnitSource
    houseAnchorVerticalAlignment: Preview3HouseAnchorVerticalAlignment
    strictAnchorCentering: boolean
    applyHouseOrderXResolution: boolean
    applyHorizontalDeoverlap: boolean
    applyDisconnectedComponentPacking: boolean
  }
  render: {
    spouseProjection: Preview3SpouseProjectionPolicy
    showOverlayRelations: boolean
    marriageOverlayStyle: Preview3MarriageOverlayStyle
    showHouseAnchors: boolean
  }
}

export type Preview3ModeOption = {
  value: PreviewTreeMode
  label: string
}

const preview3ModeDefinitions: Preview3ModeDefinition[] = [
  createModeR2Definition(),
  createModeRDefinition(),
  createModeCDefinition(),
  createModeDDefinition(),
  {
    id: 'mode0',
    shortLabel: 'Mode 0',
    label: 'Mode 0: Frozen Reference',
    summary: 'Legacy reference path for comparison only.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'single-child-centering',
        'marriage-pair-alignment',
        'house-anchor-placement',
        'render-tree-preparation',
      ],
      layoutStrategy: 'legacy',
      houseAnchorStrategy: 'legacy',
      applyMarriagePairAlignment: true,
      applyCuratedPersonOrder: false,
      applyCuratedPersonOffsets: false,
      layoutComponentSpacing: 220,
      layoutXScale: 1,
      layoutYScale: 1,
      applyHouseSubtreeOffsets: true,
      applyHouseSubtreeVerticalOffset: true,
      applyHouseAnchorYOffset: false,
      houseYOffsetUnit: 72,
      houseYOffsetUnitSource: 'fixed',
      houseAnchorVerticalAlignment: 'global-top-row',
      strictAnchorCentering: false,
      applyHouseOrderXResolution: false,
      applyHorizontalDeoverlap: false,
      applyDisconnectedComponentPacking: false,
    },
    render: {
      spouseProjection: {
        enabled: true,
        collapseChildEdges: true,
        duplicateStrategy: 'single-sided',
        parentlessStrategy: 'allow',
        preferSameRowPlacement: false,
      },
      showOverlayRelations: true,
      marriageOverlayStyle: 'dashed',
      showHouseAnchors: true,
    },
  },
  {
    id: 'modeA',
    shortLabel: 'Mode A',
    label: 'Mode A: Family Line',
    summary: 'Family-centered layout with stable partner cards and no house reflow.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'single-child-centering',
        'marriage-pair-alignment',
        'house-anchor-placement',
        'render-tree-preparation',
      ],
      layoutStrategy: 'legacy',
      houseAnchorStrategy: 'legacy',
      applyMarriagePairAlignment: true,
      applyCuratedPersonOrder: true,
      applyCuratedPersonOffsets: false,
      layoutComponentSpacing: 220,
      layoutXScale: 1,
      layoutYScale: 1,
      applyHouseSubtreeOffsets: false,
      applyHouseSubtreeVerticalOffset: false,
      applyHouseAnchorYOffset: false,
      houseYOffsetUnit: 18,
      houseYOffsetUnitSource: 'fixed',
      houseAnchorVerticalAlignment: 'founder-top-row',
      strictAnchorCentering: true,
      applyHouseOrderXResolution: false,
      applyHorizontalDeoverlap: false,
      applyDisconnectedComponentPacking: false,
    },
    render: {
      spouseProjection: {
        enabled: false,
        collapseChildEdges: true,
        duplicateStrategy: 'none',
        parentlessStrategy: 'allow',
        preferSameRowPlacement: false,
      },
      showOverlayRelations: true,
      marriageOverlayStyle: 'rigid',
      showHouseAnchors: true,
    },
  },
  {
    id: 'mode1',
    shortLabel: 'Mode 1',
    label: 'Mode 1: Partner Projection',
    summary: 'Legacy baseline geometry with house start-anchor and subtree Y semantics.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'single-child-centering',
        'marriage-pair-alignment',
        'house-anchor-placement',
        'render-tree-preparation',
      ],
      layoutStrategy: 'legacy',
      houseAnchorStrategy: 'legacy',
      applyMarriagePairAlignment: true,
      applyCuratedPersonOrder: false,
      applyCuratedPersonOffsets: false,
      layoutComponentSpacing: 220,
      layoutXScale: 1,
      layoutYScale: 1,
      applyHouseSubtreeOffsets: false,
      applyHouseSubtreeVerticalOffset: false,
      applyHouseAnchorYOffset: false,
      houseYOffsetUnit: 72,
      houseYOffsetUnitSource: 'generation',
      houseAnchorVerticalAlignment: 'global-top-row',
      strictAnchorCentering: true,
      applyHouseOrderXResolution: false,
      applyHorizontalDeoverlap: false,
      applyDisconnectedComponentPacking: false,
    },
    render: {
      spouseProjection: {
        enabled: true,
        collapseChildEdges: true,
        duplicateStrategy: 'single-sided',
        parentlessStrategy: 'allow',
        preferSameRowPlacement: false,
      },
      showOverlayRelations: true,
      marriageOverlayStyle: 'dashed',
      showHouseAnchors: true,
    },
  },
  {
    id: 'mode2',
    shortLabel: 'Mode 2',
    label: 'Mode 2: Bloodline Rigid',
    summary: 'Marriage shown as direct overlay without reflow.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'single-child-centering',
        'marriage-pair-alignment',
        'curated-person-order',
        'curated-person-offsets',
        'house-subtree-offsets',
        'house-anchor-placement',
        'render-tree-preparation',
      ],
      layoutStrategy: 'enhanced',
      houseAnchorStrategy: 'enhanced',
      applyMarriagePairAlignment: true,
      applyCuratedPersonOrder: true,
      applyCuratedPersonOffsets: true,
      layoutComponentSpacing: 220,
      layoutXScale: 1,
      layoutYScale: 1,
      applyHouseSubtreeOffsets: true,
      applyHouseSubtreeVerticalOffset: true,
      applyHouseAnchorYOffset: false,
      houseYOffsetUnit: 170,
      houseYOffsetUnitSource: 'fixed',
      houseAnchorVerticalAlignment: 'global-top-row',
      strictAnchorCentering: false,
      applyHouseOrderXResolution: false,
      applyHorizontalDeoverlap: true,
      applyDisconnectedComponentPacking: false,
    },
    render: {
      spouseProjection: {
        enabled: false,
        collapseChildEdges: true,
        duplicateStrategy: 'none',
        parentlessStrategy: 'allow',
        preferSameRowPlacement: false,
      },
      showOverlayRelations: true,
      marriageOverlayStyle: 'rigid',
      showHouseAnchors: true,
    },
  },
]

const preview3ModeDefinitionById = new Map(preview3ModeDefinitions.map((definition) => [definition.id, definition]))

export const preview3ModeOptions: Preview3ModeOption[] = preview3ModeDefinitions.map((definition) => ({
  value: definition.id,
  label: definition.shortLabel,
}))

export function getPreview3ModeDefinition(mode: PreviewTreeMode): Preview3ModeDefinition {
  return preview3ModeDefinitionById.get(mode) ?? preview3ModeDefinitions[0]
}