import {
  getGraphBounds,
  layoutGraph,
  validateDataset,
} from '../graph'
import type {
  CameraView,
  GraphMvpState,
  HouseDefinitions,
  LayoutResult,
  LoadedDataset,
  Relation,
  UUID,
  ValidationResult,
} from '../graph'
import type { PreviewTreeMode } from './state'

import {
  applyHouseSubtreeOffsets,
  applyCuratedPersonOffsets,
  applyCuratedPersonOrder,
  alignMarriagePairs,
  alignSingleChildNodes,
  buildBiologicalChildGroups,
  buildHouseAnchors,
  buildSpouseProjectionState,
  expandCameraBounds,
  getSingleChildCenterTargets,
  type BiologicalChildGroup,
  type HouseAnchor,
  type SpouseProjectionState,
} from './treeCore'

export type Preview3TreePipelineResult = {
  graphState: GraphMvpState
  initialCamera: CameraView
  houseAnchors: HouseAnchor[]
}

export async function buildPreview3TreePipeline(dataset: LoadedDataset, renderMode: PreviewTreeMode): Promise<Preview3TreePipelineResult> {
  const useLegacyMode = renderMode === 'mode0'
  const validation = validateDataset(dataset)
  const rawLayout = await layoutGraph(validation.persons, validation.validBiologicalRelations, useLegacyMode ? 'legacy' : 'enhanced')
  const singleChildCenterTargets = getSingleChildCenterTargets(rawLayout, validation.validBiologicalRelations)
  const childAlignedLayout = alignSingleChildNodes(rawLayout, singleChildCenterTargets)
  const marriageAlignedLayout = alignMarriagePairs(
    childAlignedLayout,
    validation.validOverlayRelations,
    new Set(singleChildCenterTargets.keys()),
  )
  const orderedLayout = useLegacyMode ? marriageAlignedLayout : applyCuratedPersonOrder(marriageAlignedLayout, validation.persons)
  const personOffsetLayout = useLegacyMode ? orderedLayout : applyCuratedPersonOffsets(orderedLayout, validation.persons)
  const layout = useLegacyMode ? personOffsetLayout : applyHouseSubtreeOffsets(validation, personOffsetLayout, dataset.houseDefinitions, {
    strategy: 'enhanced',
  })
  const houseAnchors = buildHouseAnchors(validation, layout, dataset.houseDefinitions, {
    strategy: useLegacyMode ? 'legacy' : 'enhanced',
  })
  const initialCamera = expandCameraBounds(getGraphBounds(layout.nodes), [], houseAnchors)

  return {
    graphState: {
      dataset,
      validation,
      layout,
      contractScenario: null,
      contractEvaluation: null,
    },
    initialCamera,
    houseAnchors,
  }
}

export type Preview3RenderedTree = {
  spouseProjection: SpouseProjectionState
  houseAnchors: HouseAnchor[]
  biologicalRelations: Relation[]
  overlayRelations: Relation[]
  biologicalChildGroups: BiologicalChildGroup[]
}

export function buildPreview3RenderedTree({
  validation,
  layout,
  houseDefinitions,
  selectedIds,
  spouseOwnerOverrides,
  shouldHideNode,
  renderMode,
}: {
  validation: ValidationResult
  layout: LayoutResult
  houseDefinitions: HouseDefinitions
  selectedIds: UUID[]
  spouseOwnerOverrides: Record<string, UUID>
  shouldHideNode: (personId: UUID) => boolean
  renderMode: PreviewTreeMode
}): Preview3RenderedTree {
  const useSpouseProjection = renderMode === 'mode0' || renderMode === 'mode1'
  const spouseProjection = useSpouseProjection
    ? buildSpouseProjectionState(validation, layout, selectedIds, spouseOwnerOverrides)
    : {
        hiddenChildEdgeKeys: new Set<string>(),
        projectedMarriageIds: new Set<UUID>(),
        nodes: [],
      }
  const houseAnchors = buildHouseAnchors(validation, layout, houseDefinitions, {
    strategy: renderMode === 'mode0' ? 'legacy' : 'enhanced',
  })

  const biologicalRelations = validation.validBiologicalRelations
    .filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
    .filter((relation) => !useSpouseProjection || !spouseProjection.hiddenChildEdgeKeys.has(`${relation.from}|${relation.to}`))

  const overlayRelations = validation.validOverlayRelations
    .filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
    .filter((relation) => !useSpouseProjection || !spouseProjection.projectedMarriageIds.has(relation.id))

  const biologicalChildGroups = buildBiologicalChildGroups(biologicalRelations, layout)

  return {
    spouseProjection,
    houseAnchors,
    biologicalRelations,
    overlayRelations,
    biologicalChildGroups,
  }
}
