import type { Preview3ModeDefinition } from './modes'

export function createModeCDefinition(): Preview3ModeDefinition {
  return {
    id: 'modeC',
    shortLabel: 'Mode C',
    label: 'Mode C: ELK Test',
    summary: 'ELK-first mode with minimal child-centering constraints.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'single-child-centering',
        'render-tree-preparation',
      ],
      layoutStrategy: 'enhanced',
      houseAnchorStrategy: 'enhanced',
      applyMarriagePairAlignment: false,
      applyCuratedPersonOrder: false,
      applyCuratedPersonOffsets: false,
      layoutComponentSpacing: 96,
      layoutXScale: 1,
      layoutYScale: 1,
      applyHouseSubtreeOffsets: false,
      applyHouseSubtreeVerticalOffset: false,
      applyHouseAnchorYOffset: false,
      houseYOffsetUnit: 72,
      houseYOffsetUnitSource: 'generation',
      houseAnchorVerticalAlignment: 'global-top-row',
      strictAnchorCentering: false,
      applyHouseOrderXResolution: false,
      applyHorizontalDeoverlap: false,
      applyDisconnectedComponentPacking: false,
    },
    render: {
      useSpouseProjection: false,
      collapseProjectedChildEdges: false,
      showOverlayRelations: false,
      marriageOverlayStyle: 'rigid',
      showHouseAnchors: false,
    },
  }
}