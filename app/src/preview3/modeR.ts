import type { Preview3ModeDefinition } from './modes'

export function createModeRDefinition(): Preview3ModeDefinition {
  return {
    id: 'modeR',
    shortLabel: 'Mode R',
    label: 'Mode R: Virtual Grid',
    summary: 'Virtual raster layout with house-guided root anchors and deterministic partner placement.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'house-subtree-offsets',
        'house-anchor-placement',
        'render-tree-preparation',
      ],
      layoutStrategy: 'enhanced',
      houseAnchorStrategy: 'legacy',
      applyMarriagePairAlignment: false,
      applyCuratedPersonOrder: false,
      applyCuratedPersonOffsets: false,
      layoutComponentSpacing: 96,
      layoutXScale: 1,
      layoutYScale: 1,
      applyHouseSubtreeOffsets: false,
      applyHouseSubtreeVerticalOffset: false,
      applyHouseAnchorYOffset: true,
      houseYOffsetUnit: 72,
      houseYOffsetUnitSource: 'generation',
      houseAnchorVerticalAlignment: 'global-top-row',
      strictAnchorCentering: true,
      applyHouseOrderXResolution: false,
      applyHorizontalDeoverlap: false,
      applyDisconnectedComponentPacking: false,
    },
    render: {
      useSpouseProjection: false,
      collapseProjectedChildEdges: false,
      showOverlayRelations: true,
      marriageOverlayStyle: 'rigid',
      showHouseAnchors: true,
    },
  }
}
