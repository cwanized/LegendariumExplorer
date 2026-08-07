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

import {
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

export async function buildPreview3TreePipeline(dataset: LoadedDataset): Promise<Preview3TreePipelineResult> {
  const validation = validateDataset(dataset)
  const rawLayout = await layoutGraph(validation.persons, validation.validBiologicalRelations)
  const singleChildCenterTargets = getSingleChildCenterTargets(rawLayout, validation.validBiologicalRelations)
  const childAlignedLayout = alignSingleChildNodes(rawLayout, singleChildCenterTargets)
  const layout = alignMarriagePairs(
    childAlignedLayout,
    validation.validOverlayRelations,
    new Set(singleChildCenterTargets.keys()),
  )
  const houseAnchors = buildHouseAnchors(validation, layout, dataset.houseDefinitions)
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
}: {
  validation: ValidationResult
  layout: LayoutResult
  houseDefinitions: HouseDefinitions
  selectedIds: UUID[]
  spouseOwnerOverrides: Record<string, UUID>
  shouldHideNode: (personId: UUID) => boolean
}): Preview3RenderedTree {
  const spouseProjection = buildSpouseProjectionState(validation, layout, selectedIds, spouseOwnerOverrides)
  const houseAnchors = buildHouseAnchors(validation, layout, houseDefinitions)

  const biologicalRelations = validation.validBiologicalRelations
    .filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
    .filter((relation) => !spouseProjection.hiddenChildEdgeKeys.has(`${relation.from}|${relation.to}`))

  const overlayRelations = validation.validOverlayRelations
    .filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
    .filter((relation) => !spouseProjection.projectedMarriageIds.has(relation.id))

  const biologicalChildGroups = buildBiologicalChildGroups(biologicalRelations, layout)

  return {
    spouseProjection,
    houseAnchors,
    biologicalRelations,
    overlayRelations,
    biologicalChildGroups,
  }
}
