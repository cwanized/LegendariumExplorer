import type { Preview3ModeDefinition } from './modes'

export function createModeR3BDefinition(): Preview3ModeDefinition {
  return {
    id: 'modeR3B',
    shortLabel: 'Mode R3B',
    label: 'Mode R3B: Structured Raster Engine v2',
    summary: 'Dedicated branch for the next structured raster tree core with isolated R3B wiring.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'marriage-pair-alignment',
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
      applyHouseSubtreeOffsets: true,
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
      spouseProjection: {
        enabled: true,
        collapseChildEdges: false,
        duplicateStrategy: 'double-sided',
        parentlessStrategy: 'allow',
        preferSameRowPlacement: true,
      },
      showOverlayRelations: true,
      marriageOverlayStyle: 'rigid',
      showHouseAnchors: true,
    },
  }
}