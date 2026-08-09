import type { Preview3ModeDefinition } from './modes'

export function createModeR2Definition(): Preview3ModeDefinition {
  return {
    id: 'modeR2',
    shortLabel: 'Mode R2',
    label: 'Mode R2: Virtual Raster Engine',
    summary: 'Anchor-seeded raster layout with deterministic generation rows, couple blocks, and symmetric child groups.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'house-anchor-placement',
        'render-tree-preparation',
      ],
      layoutStrategy: 'enhanced',
      houseAnchorStrategy: 'legacy',
      applyMarriagePairAlignment: true,
      applyCuratedPersonOrder: false,
      applyCuratedPersonOffsets: false,
      layoutComponentSpacing: 96,
      layoutXScale: 1,
      layoutYScale: 1,
      applyHouseSubtreeOffsets: false,
      applyHouseSubtreeVerticalOffset: false,
      applyHouseAnchorYOffset: true,
      houseYOffsetUnit: 1,
      houseYOffsetUnitSource: 'generation',
      houseAnchorVerticalAlignment: 'global-top-row',
      strictAnchorCentering: true,
      applyHouseOrderXResolution: false,
      applyHorizontalDeoverlap: false,
      applyDisconnectedComponentPacking: false,
    },
    render: {
      useSpouseProjection: true,
      collapseProjectedChildEdges: false,
      showOverlayRelations: true,
      marriageOverlayStyle: 'rigid',
      showHouseAnchors: true,
    },
  }
}