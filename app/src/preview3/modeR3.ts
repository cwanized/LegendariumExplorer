import type { Preview3ModeDefinition } from './modes'

export function createModeR3Definition(): Preview3ModeDefinition {
  return {
    id: 'modeR3',
    shortLabel: 'Mode R3',
    label: 'Mode R3: Structured Raster Engine',
    summary: 'New modular virtual-raster tree engine with deterministic family blocks and house-aware staging.',
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
      spouseProjection: {
        enabled: true,
        collapseChildEdges: false,
        duplicateStrategy: 'double-sided',
        parentlessStrategy: 'suppress',
        preferSameRowPlacement: true,
      },
      showOverlayRelations: true,
      marriageOverlayStyle: 'rigid',
      showHouseAnchors: true,
    },
  }
}