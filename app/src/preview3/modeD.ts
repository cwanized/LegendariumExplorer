import type { Preview3ModeDefinition } from './modes'

export function createModeDDefinition(): Preview3ModeDefinition {
  return {
    id: 'modeD',
    shortLabel: 'Mode D',
    label: 'Mode D: Structured Layout',
    summary: 'Genetic tree focus mode with simplified, deterministic biological structure rendering.',
    pipeline: {
      stages: [
        'validate-dataset',
        'base-layout',
        'single-child-centering',
        'render-tree-preparation',
      ],
      layoutStrategy: 'legacy',
      houseAnchorStrategy: 'enhanced',
      applyMarriagePairAlignment: true,
      applyCuratedPersonOrder: false,
      applyCuratedPersonOffsets: false,
      layoutComponentSpacing: 80,
      layoutXScale: 0.9,
      layoutYScale: 0.9,
      applyHouseSubtreeOffsets: false,
      applyHouseSubtreeVerticalOffset: false,
      applyHouseAnchorYOffset: false,
      houseYOffsetUnit: 72,
      houseYOffsetUnitSource: 'generation',
      houseAnchorVerticalAlignment: 'global-top-row',
      strictAnchorCentering: false,
      applyHouseOrderXResolution: false,
      applyHorizontalDeoverlap: true,
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
