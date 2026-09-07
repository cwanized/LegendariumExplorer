import {
  getGraphBounds,
  layoutGraph,
  validateDataset,
} from '../graph'
import type {
  CameraView,
  GraphMvpState,
  HouseDefinition,
  HouseDefinitions,
  LayoutResult,
  LoadedDataset,
  PositionedNode,
  Relation,
  UUID,
  ValidationResult,
} from '../graph'
import type { Preview3ModeDefinition, Preview3PipelineStage } from './modes'
import { resolveContinuationOwner } from './continuation'
import { buildModeR2Layout } from './rasterModeR2'
import { buildModeR3ConnectorModel, type R3ConnectorAnchor, type R3ConnectorGroupModel } from './r3/connectorModel'
import { buildModeR3Layout, getModeR3LayoutArtifacts } from './r3/layout'
import { buildModeR3BiologicalChildGroups, buildModeR3HouseAnchors } from './r3/render'
import { buildModeR3BLayout, getModeR3BLayoutArtifacts } from './r3b/placement'
import {
  buildModeR3BBiologicalChildGroups,
  buildModeR3BConnectorModel,
  buildModeR3BHouseAnchors,
  buildModeR3BParentAnchorsByKey,
  buildModeR3BSpouseProjectionState,
} from './r3b/renderModel'
import {
  R2_RASTER_COLUMN_SIZE,
  R2_RASTER_OUTER_PADDING,
  R2_RASTER_ROW_HEIGHT,
} from './rasterModeR2'

import {
  applyHouseSubtreeOffsets,
  applyCuratedPersonOffsets,
  applyCuratedPersonOrder,
  alignMarriagePairs,
  alignMarriagePairsToFamilyAxis,
  alignTwoParentPairsToChildAxis,
  normalizeMarriagePairGeometry,
  placeMarriagePairsLocally,
  recenterMultiChildGroups,
  symmetrizeChildGroups,
  alignSingleParentChildGroups,
  alignSingleParentSingleChildNodes,
  enforceBiologicalFamilyAxes,
  alignSingleChildNodes,
  buildBiologicalChildGroups,
  buildHouseAnchorDebugEntries,
  buildHouseAnchors,
  buildSpouseProjectionState,
  expandCameraBounds,
  getSingleChildCenterTargets,
  resolveHouseOrderXConflicts,
  resolveHorizontalNodeOverlaps,
  resolveNodeCollisions2D,
  packDisconnectedComponents,
  scaleLayoutX,
  scaleLayoutY,
  type BiologicalChildGroup,
  type HouseAnchor,
  type HouseAnchorDebugEntry,
  type SpouseProjectionState,
} from './treeCore'

export type Preview3GroupParentAnchor = R3ConnectorAnchor

export type Preview3TreeDebugData = {
  modeId: Preview3ModeDefinition['id']
  modeLabel: string
  modeSummary: string
  strategySummary: string[]
  activeStages: Preview3PipelineStage[]
  houseAnchors: HouseAnchorDebugEntry[]
  appliedHouseOffsets: Array<{ houseId: string; displayName: string; yOffset: number }>
  appliedPersonOffsets: Array<{ personId: UUID; name: string; yOffset: number }>
}

export type Preview3TreePipelineResult = {
  graphState: GraphMvpState
  initialCamera: CameraView
  modeDefinition: Preview3ModeDefinition
  houseAnchors: HouseAnchor[]
  debugData: Preview3TreeDebugData
}

export async function buildPreview3TreePipeline(
  dataset: LoadedDataset,
  modeDefinition: Preview3ModeDefinition,
  options?: {
    followRulerLine?: boolean
  },
): Promise<Preview3TreePipelineResult> {
  const followRulerLine = options?.followRulerLine ?? false
  const validation = validateDataset(dataset)
  const useVirtualGridLayout = modeDefinition.id === 'modeR' || modeDefinition.id === 'modeR2' || modeDefinition.id === 'modeR3' || modeDefinition.id === 'modeR3B'
  const useModeRLayout = modeDefinition.id === 'modeR'
  const useModeR2Layout = modeDefinition.id === 'modeR2'
  const useModeR3Layout = modeDefinition.id === 'modeR3'
  const useModeR3BLayout = modeDefinition.id === 'modeR3B'
  const marriagePairMaxCenterYDelta = useModeR2Layout ? 220 : 28
  const useElkFirstLayoutPasses = modeDefinition.id === 'modeC'
  const useExperimentalLayoutPasses = modeDefinition.id === 'modeD'
  const rawLayout = useModeR3Layout
    ? buildModeR3Layout(validation, dataset.houseDefinitions, { followRulerLine })
    : useModeR3BLayout
    ? buildModeR3BLayout(validation, dataset.houseDefinitions, { followRulerLine })
    : useModeR2Layout
    ? buildModeR2Layout(validation, dataset.houseDefinitions)
    : useVirtualGridLayout
      ? buildVirtualGridLayout(validation, dataset.houseDefinitions)
    : await layoutGraph(
        validation.persons,
        validation.validBiologicalRelations,
        modeDefinition.pipeline.layoutStrategy,
        {
          componentSpacing: modeDefinition.pipeline.layoutComponentSpacing,
          nodeSpacing: modeDefinition.id === 'modeC' ? 54 : undefined,
          layerSpacing: modeDefinition.id === 'modeC' ? 82 : undefined,
        },
      )
  const singleChildCenterTargets = getSingleChildCenterTargets(rawLayout, validation.validBiologicalRelations)
  const childAlignedLayout = useVirtualGridLayout || useElkFirstLayoutPasses
    ? rawLayout
    : alignSingleChildNodes(rawLayout, singleChildCenterTargets)
  const singleParentAlignedLayout = useExperimentalLayoutPasses
    ? alignSingleParentChildGroups(
        childAlignedLayout,
        validation.validBiologicalRelations,
        validation.validOverlayRelations,
      )
    : childAlignedLayout
  const childAxisCoupleAlignedLayout = useModeR2Layout
    ? applyModeR2PostLayoutPasses({
        layout: singleParentAlignedLayout,
        overlayRelations: validation.validOverlayRelations,
        biologicalRelations: validation.validBiologicalRelations,
        anchoredNodeIds: new Set(singleChildCenterTargets.keys()),
        marriagePairMaxCenterYDelta,
      })
    : modeDefinition.pipeline.applyMarriagePairAlignment
      ? alignMarriagePairs(
          singleParentAlignedLayout,
          validation.validOverlayRelations,
          new Set(singleChildCenterTargets.keys()),
          validation.validBiologicalRelations,
          { maxCenterYDelta: marriagePairMaxCenterYDelta, preferSameRow: false },
        )
      : singleParentAlignedLayout
  const orderedLayout = modeDefinition.pipeline.applyCuratedPersonOrder
    ? applyCuratedPersonOrder(childAxisCoupleAlignedLayout, validation.persons)
    : childAxisCoupleAlignedLayout
  const personOffsetLayout = modeDefinition.pipeline.applyCuratedPersonOffsets
    ? applyCuratedPersonOffsets(orderedLayout, validation.persons)
    : orderedLayout
  const effectiveHouseYOffsetUnit = resolveHouseYOffsetUnit(modeDefinition, personOffsetLayout, validation.validBiologicalRelations)
  const subtreeAdjustedLayout = modeDefinition.pipeline.applyHouseSubtreeOffsets
    ? applyHouseSubtreeOffsets(validation, personOffsetLayout, dataset.houseDefinitions, {
        strategy: modeDefinition.pipeline.houseAnchorStrategy,
        applyHouseLayoutYOffset: modeDefinition.pipeline.applyHouseSubtreeVerticalOffset,
        houseYOffsetUnit: effectiveHouseYOffsetUnit,
      })
    : personOffsetLayout
  const orderResolvedLayout = modeDefinition.pipeline.applyHouseOrderXResolution
    ? resolveHouseOrderXConflicts(validation, subtreeAdjustedLayout, dataset.houseDefinitions, {
        strategy: modeDefinition.pipeline.houseAnchorStrategy,
      })
    : subtreeAdjustedLayout
  const packedLayout = modeDefinition.pipeline.applyDisconnectedComponentPacking
    ? packDisconnectedComponents(orderResolvedLayout, validation.validBiologicalRelations)
    : orderResolvedLayout
  const preAnchorLayout = useExperimentalLayoutPasses
    ? (() => {
        const deoverlappedLayout = modeDefinition.pipeline.applyHorizontalDeoverlap
          ? resolveHorizontalNodeOverlaps(packedLayout, {
              minimumGap: 22,
            })
          : packedLayout
        const singleParentRebalancedLayout = alignSingleParentChildGroups(
          deoverlappedLayout,
          validation.validBiologicalRelations,
          validation.validOverlayRelations,
        )
        const singleParentSingleChildAlignedLayout = alignSingleParentSingleChildNodes(
          singleParentRebalancedLayout,
          validation.validBiologicalRelations,
        )
        const finalMarriageAlignedLayout = modeDefinition.pipeline.applyMarriagePairAlignment
          ? alignMarriagePairs(
              singleParentSingleChildAlignedLayout,
              validation.validOverlayRelations,
              new Set(singleChildCenterTargets.keys()),
              validation.validBiologicalRelations,
            )
          : singleParentSingleChildAlignedLayout
        const finalDeoverlappedLayout = modeDefinition.pipeline.applyHorizontalDeoverlap
          ? resolveHorizontalNodeOverlaps(finalMarriageAlignedLayout, {
              minimumGap: 24,
            })
          : finalMarriageAlignedLayout
        const finalSingleParentRebalancedLayout = alignSingleParentChildGroups(
          finalDeoverlappedLayout,
          validation.validBiologicalRelations,
          validation.validOverlayRelations,
        )
        const finalizedSingleParentSingleChildLayout = alignSingleParentSingleChildNodes(
          finalSingleParentRebalancedLayout,
          validation.validBiologicalRelations,
        )
        const scaledLayout = scaleLayoutY(
          scaleLayoutX(finalizedSingleParentSingleChildLayout, modeDefinition.pipeline.layoutXScale),
          modeDefinition.pipeline.layoutYScale,
        )
        const postScaleDeoverlappedLayout = modeDefinition.pipeline.applyHorizontalDeoverlap
          ? resolveHorizontalNodeOverlaps(scaledLayout, {
              minimumGap: 24,
              rowQuantization: 6,
            })
          : scaledLayout
        const postScaleSingleParentRebalancedLayout = alignSingleParentChildGroups(
          postScaleDeoverlappedLayout,
          validation.validBiologicalRelations,
          validation.validOverlayRelations,
        )
        const postScaleRecenteredLayout = recenterMultiChildGroups(
          postScaleSingleParentRebalancedLayout,
          validation.validBiologicalRelations,
        )
        const postScaleMarriageAlignedLayout = modeDefinition.pipeline.applyMarriagePairAlignment
          ? alignMarriagePairs(
              postScaleRecenteredLayout,
              validation.validOverlayRelations,
              new Set(singleChildCenterTargets.keys()),
              validation.validBiologicalRelations,
            )
          : postScaleRecenteredLayout

        return alignSingleParentSingleChildNodes(postScaleMarriageAlignedLayout, validation.validBiologicalRelations)
      })()
    : useElkFirstLayoutPasses
      ? (() => {
          const recenteredLayout = recenterMultiChildGroups(
            packedLayout,
            validation.validBiologicalRelations,
          )
          const symmetrizedLayout = symmetrizeChildGroups(
            recenteredLayout,
            validation.validBiologicalRelations,
            validation.validOverlayRelations,
          )
          const parentPairAlignedLayout = alignTwoParentPairsToChildAxis(
            symmetrizedLayout,
            validation.validBiologicalRelations,
            validation.validOverlayRelations,
          )
          const familyAxisAlignedLayout = alignMarriagePairsToFamilyAxis(
            parentPairAlignedLayout,
            validation.validBiologicalRelations,
            validation.validOverlayRelations,
          )
          const resymmetrizedLayout = symmetrizeChildGroups(
            familyAxisAlignedLayout,
            validation.validBiologicalRelations,
            validation.validOverlayRelations,
          )
          const singleParentSingleChildAlignedLayout = alignSingleParentSingleChildNodes(
            resymmetrizedLayout,
            validation.validBiologicalRelations,
          )

          return scaleLayoutY(
            scaleLayoutX(singleParentSingleChildAlignedLayout, modeDefinition.pipeline.layoutXScale),
            modeDefinition.pipeline.layoutYScale,
          )
        })()
    : (() => {
        const deoverlappedLayout = modeDefinition.pipeline.applyHorizontalDeoverlap
          ? resolveHorizontalNodeOverlaps(packedLayout)
          : packedLayout

        return scaleLayoutY(
          scaleLayoutX(deoverlappedLayout, modeDefinition.pipeline.layoutXScale),
          modeDefinition.pipeline.layoutYScale,
        )
      })()
  let layout = preAnchorLayout
  if (useModeRLayout) {
    layout = applyModeRStartHouseSubtreeOffsets(
      validation,
      layout,
      dataset.houseDefinitions,
      effectiveHouseYOffsetUnit,
    )
  }

  let houseAnchors = modeDefinition.id === 'modeR3'
    ? buildModeR3HouseAnchors(validation, layout, dataset.houseDefinitions, { allowFallback: false })
    : modeDefinition.id === 'modeR3B'
    ? buildModeR3BHouseAnchors(validation, layout, dataset.houseDefinitions, { allowFallback: false })
    : buildHouseAnchors(validation, layout, dataset.houseDefinitions, {
        strategy: modeDefinition.pipeline.houseAnchorStrategy,
        applyHouseLayoutYOffset: modeDefinition.pipeline.applyHouseAnchorYOffset,
        houseYOffsetUnit: effectiveHouseYOffsetUnit,
        preserveIdealCenterX: modeDefinition.pipeline.strictAnchorCentering,
        verticalAlignment: modeDefinition.pipeline.houseAnchorVerticalAlignment,
      })

  if (useModeRLayout) {
    if (houseAnchors.length > 0) {
      const targetTopAnchorY = 52
      const minAnchorY = Math.min(...houseAnchors.map((anchor) => anchor.y))
      const deltaY = targetTopAnchorY - minAnchorY

      if (Math.abs(deltaY) > 0.5) {
        layout = shiftLayoutY(layout, deltaY)
        houseAnchors = buildHouseAnchors(validation, layout, dataset.houseDefinitions, {
          strategy: modeDefinition.pipeline.houseAnchorStrategy,
          applyHouseLayoutYOffset: modeDefinition.pipeline.applyHouseAnchorYOffset,
          houseYOffsetUnit: effectiveHouseYOffsetUnit,
          preserveIdealCenterX: modeDefinition.pipeline.strictAnchorCentering,
          verticalAlignment: modeDefinition.pipeline.houseAnchorVerticalAlignment,
        })
      }
    }
  }

  const debugData = buildPreview3TreeDebugData(
    validation,
    layout,
    dataset.houseDefinitions,
    houseAnchors,
    modeDefinition,
    effectiveHouseYOffsetUnit,
    followRulerLine,
  )
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
    modeDefinition,
    houseAnchors,
    debugData,
  }
}

export type Preview3RenderedTree = {
  spouseProjection: SpouseProjectionState
  houseAnchors: HouseAnchor[]
  biologicalRelations: Relation[]
  overlayRelations: Relation[]
  biologicalChildGroups: BiologicalChildGroup[]
  groupParentAnchorsByKey: Map<string, Preview3GroupParentAnchor[]>
  r3ConnectorModelByKey: Map<string, R3ConnectorGroupModel>
}

export function buildPreview3RenderedTree({
  validation,
  layout,
  houseDefinitions,
  selectedIds,
  spouseOwnerOverrides,
  shouldHideNode,
  modeDefinition,
  overlayEnabled,
}: {
  validation: ValidationResult
  layout: LayoutResult
  houseDefinitions: HouseDefinitions
  selectedIds: UUID[]
  spouseOwnerOverrides: Record<string, UUID>
  shouldHideNode: (personId: UUID) => boolean
  modeDefinition: Preview3ModeDefinition
  overlayEnabled: boolean
}): Preview3RenderedTree {
  const effectiveHouseYOffsetUnit = resolveHouseYOffsetUnit(modeDefinition, layout, validation.validBiologicalRelations)
  const spouseProjectionPolicy = modeDefinition.render.spouseProjection
  const spouseProjection = modeDefinition.id === 'modeR3B'
    ? buildModeR3BSpouseProjectionState(validation, layout, selectedIds, spouseOwnerOverrides, {
        collapseChildEdges: spouseProjectionPolicy.collapseChildEdges,
        duplicateBothPartners: spouseProjectionPolicy.duplicateStrategy === 'double-sided',
        preferSameRowPlacement: spouseProjectionPolicy.preferSameRowPlacement,
      })
    : spouseProjectionPolicy.enabled
    ? buildSpouseProjectionState(validation, layout, selectedIds, spouseOwnerOverrides, {
        collapseChildEdges: spouseProjectionPolicy.collapseChildEdges,
        duplicateBothPartners: spouseProjectionPolicy.duplicateStrategy === 'double-sided',
        preferSameRowPlacement: spouseProjectionPolicy.preferSameRowPlacement,
        suppressProjectionWhenEitherPartnerParentless: spouseProjectionPolicy.parentlessStrategy === 'suppress',
      })
    : {
        hiddenChildEdgeKeys: new Set<string>(),
        projectedMarriageIds: new Set<UUID>(),
        nodes: [],
      }
  const houseAnchors = modeDefinition.id === 'modeR3'
    ? buildModeR3HouseAnchors(validation, layout, houseDefinitions, { allowFallback: false })
    : modeDefinition.id === 'modeR3B'
    ? buildModeR3BHouseAnchors(validation, layout, houseDefinitions, { allowFallback: false })
    : buildHouseAnchors(validation, layout, houseDefinitions, {
        strategy: modeDefinition.pipeline.houseAnchorStrategy,
        applyHouseLayoutYOffset: modeDefinition.pipeline.applyHouseAnchorYOffset,
        houseYOffsetUnit: effectiveHouseYOffsetUnit,
        preserveIdealCenterX: modeDefinition.pipeline.strictAnchorCentering,
        verticalAlignment: modeDefinition.pipeline.houseAnchorVerticalAlignment,
      })

  const biologicalRelations = validation.validBiologicalRelations
    .filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
    .filter((relation) => !spouseProjectionPolicy.enabled || !spouseProjection.hiddenChildEdgeKeys.has(`${relation.from}|${relation.to}`))

  const overlayRelations = modeDefinition.render.showOverlayRelations
    ? validation.validOverlayRelations
      .filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
      .filter((relation) => !spouseProjectionPolicy.enabled || !spouseProjection.projectedMarriageIds.has(relation.id))
    : []

  const biologicalChildGroups = modeDefinition.id === 'modeR3'
    ? buildModeR3BiologicalChildGroups(validation, biologicalRelations, layout, { allowFallback: false })
    : modeDefinition.id === 'modeR3B'
    ? buildModeR3BBiologicalChildGroups(validation, biologicalRelations, layout, { allowFallback: false })
    : buildBiologicalChildGroups(biologicalRelations, layout)
  const groupParentAnchorsByKey = modeDefinition.id === 'modeR3B'
    ? buildModeR3BParentAnchorsByKey({
        biologicalChildGroups,
        layout,
        overlayEnabled,
        spouseProjection,
        validation,
        spouseOwnerOverrides,
      })
    : buildGroupParentAnchorsByKey({
        biologicalChildGroups,
        layout,
        overlayEnabled,
        spouseProjection,
        validation,
        spouseOwnerOverrides,
      })
  const r3ConnectorModelByKey = modeDefinition.id === 'modeR3'
    ? buildModeR3ConnectorModel(biologicalChildGroups, groupParentAnchorsByKey)
    : modeDefinition.id === 'modeR3B'
    ? buildModeR3BConnectorModel(biologicalChildGroups, groupParentAnchorsByKey)
    : new Map<string, R3ConnectorGroupModel>()

  return {
    spouseProjection,
    houseAnchors,
    biologicalRelations,
    overlayRelations,
    biologicalChildGroups,
    groupParentAnchorsByKey,
    r3ConnectorModelByKey,
  }
}

function buildGroupParentAnchorsByKey({
  biologicalChildGroups,
  layout,
  overlayEnabled,
  spouseProjection,
  validation,
  spouseOwnerOverrides,
}: {
  biologicalChildGroups: BiologicalChildGroup[]
  layout: LayoutResult
  overlayEnabled: boolean
  spouseProjection: SpouseProjectionState
  validation: ValidationResult
  spouseOwnerOverrides: Record<string, UUID>
}): Map<string, Preview3GroupParentAnchor[]> {
  const MAX_PROJECTION_MAIN_ANCHOR_DELTA_X = 360
  const projectionsByCompanionId = new Map<UUID, typeof spouseProjection.nodes>()
  for (const projection of spouseProjection.nodes) {
    const projections = projectionsByCompanionId.get(projection.companionId) ?? []
    projections.push(projection)
    projectionsByCompanionId.set(projection.companionId, projections)
  }

  const marriageByParentPairKey = new Map<string, Relation>()
  const ownerByMarriageId = new Map<string, UUID>()
  for (const relation of validation.validOverlayRelations) {
    if (relation.type !== 'marriage') {
      continue
    }

    const pairKey = [relation.from, relation.to].sort((left, right) => left.localeCompare(right)).join('|')
    marriageByParentPairKey.set(pairKey, relation)
    ownerByMarriageId.set(
      relation.id,
      resolveContinuationOwner({ relation, validation, spouseOwnerOverrides }),
    )
  }

  const distanceToChildren = (
    x: number,
    y: number,
    width: number,
    height: number,
    childCenterX: number,
    childTopY: number,
  ) => {
    const centerX = x + width / 2
    const centerY = y + height / 2
    return Math.hypot(centerX - childCenterX, centerY - childTopY)
  }

  const buildProjectionAnchor = (parentId: UUID, projection: SpouseProjectionState['nodes'][number]): Preview3GroupParentAnchor => ({
    key: `projection:${projection.relationId}:${projection.ownerId}:${projection.companionId}`,
    parentId,
    x: projection.x,
    y: projection.y,
    width: projection.width,
    height: projection.height,
    isProjection: true,
  })

  const selectNearestProjection = (
    parentId: UUID,
    projectionCandidates: SpouseProjectionState['nodes'],
    childCenterX: number,
    childTopY: number,
  ): Preview3GroupParentAnchor | null => {
    if (projectionCandidates.length === 0) {
      return null
    }

    const nearest = projectionCandidates
      .slice()
      .sort((left, right) => {
        const leftDistance = distanceToChildren(left.x, left.y, left.width, left.height, childCenterX, childTopY)
        const rightDistance = distanceToChildren(right.x, right.y, right.width, right.height, childCenterX, childTopY)
        return leftDistance - rightDistance
      })[0]

    return buildProjectionAnchor(parentId, nearest)
  }

  const anchorsByKey = new Map<string, Preview3GroupParentAnchor[]>()

  for (const group of biologicalChildGroups) {
    const childTopY = Math.min(...group.childNodes.map((node) => node.y))
    const childCenters = group.childNodes.map((node) => node.x + node.width / 2)
    const childCenterX = (Math.min(...childCenters) + Math.max(...childCenters)) / 2

    const groupOwnerId = (() => {
      if (group.parentIds.length !== 2) {
        return null
      }

      const pairKey = [...group.parentIds].sort((left, right) => left.localeCompare(right)).join('|')
      const marriage = marriageByParentPairKey.get(pairKey)
      if (!marriage) {
        return null
      }

      return ownerByMarriageId.get(marriage.id) ?? null
    })()

    const anchors = group.parentIds
      .map((parentId) => {
        const mainNode = layout.nodes.get(parentId)
        const projectionCandidates = overlayEnabled
          ? (projectionsByCompanionId.get(parentId) ?? []).filter((projection) => (
            projection.sharedChildren.some((childId) => group.childIds.includes(childId))
          ))
          : []

        const mainAnchor = mainNode
          ? {
              key: `main:${parentId}`,
              parentId,
              x: mainNode.x,
              y: mainNode.y,
              width: mainNode.width,
              height: mainNode.height,
              isProjection: false,
            } satisfies Preview3GroupParentAnchor
          : null

        if (groupOwnerId && group.parentIds.length === 2) {
          if (parentId === groupOwnerId) {
            if (mainAnchor) {
              return mainAnchor
            }

            return selectNearestProjection(parentId, projectionCandidates, childCenterX, childTopY)
          }

          const ownerDrivenProjections = projectionCandidates.filter((projection) => projection.ownerId === groupOwnerId)
          const ownerProjectionAnchor = selectNearestProjection(parentId, ownerDrivenProjections, childCenterX, childTopY)
          if (ownerProjectionAnchor && mainAnchor) {
            const projectionCenterX = ownerProjectionAnchor.x + ownerProjectionAnchor.width / 2
            const mainCenterX = mainAnchor.x + mainAnchor.width / 2
            if (Math.abs(projectionCenterX - mainCenterX) <= MAX_PROJECTION_MAIN_ANCHOR_DELTA_X) {
              return ownerProjectionAnchor
            }
          } else if (ownerProjectionAnchor) {
            return ownerProjectionAnchor
          }

          if (mainAnchor) {
            return mainAnchor
          }

          return selectNearestProjection(parentId, projectionCandidates, childCenterX, childTopY)
        }

        if (mainAnchor) {
          return mainAnchor
        }

        return selectNearestProjection(parentId, projectionCandidates, childCenterX, childTopY)
      })
      .filter((anchor): anchor is Preview3GroupParentAnchor => anchor !== null)

    anchorsByKey.set(group.key, anchors)
  }

  return anchorsByKey
}

function buildVirtualGridLayout(validation: ValidationResult, houseDefinitions: HouseDefinitions): LayoutResult {
  const nodeWidth = 176
  const nodeHeight = 64
  const partnerGap = 40
  const blockGap = 36
  const groupGap = 48
  const rowGap = 130
  const outerPadding = 40
  const personById = validation.personById
  const spouseIdsByPersonId = new Map<UUID, Set<UUID>>()

  const normalizeHouseKey = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

  const houseByKey = new Map<string, HouseDefinition>()
  for (const house of houseDefinitions.houses) {
    houseByKey.set(normalizeHouseKey(house.id), house)
    houseByKey.set(normalizeHouseKey(house.displayName), house)
    for (const alias of house.aliases ?? []) {
      houseByKey.set(normalizeHouseKey(alias), house)
    }
  }

  const getPrimaryHouse = (personId: UUID): HouseDefinition | null => {
    const person = personById.get(personId)

    if (!person) {
      return null
    }

    for (const houseName of person.houses ?? []) {
      const match = houseByKey.get(normalizeHouseKey(houseName))
      if (match) {
        return match
      }
    }

    return null
  }

  const getStartAnchorHouse = (personId: UUID): HouseDefinition | null => {
    const house = getPrimaryHouse(personId)

    if (!house || !house.anchor.enabled || house.tier !== 'start') {
      return null
    }

    return house
  }

  for (const relation of validation.validOverlayRelations.filter((candidate) => candidate.type === 'marriage')) {
    if (!personById.has(relation.from) || !personById.has(relation.to)) {
      continue
    }

    const leftSpouses = spouseIdsByPersonId.get(relation.from) ?? new Set<UUID>()
    leftSpouses.add(relation.to)
    spouseIdsByPersonId.set(relation.from, leftSpouses)

    const rightSpouses = spouseIdsByPersonId.get(relation.to) ?? new Set<UUID>()
    rightSpouses.add(relation.from)
    spouseIdsByPersonId.set(relation.to, rightSpouses)
  }

  const orderedPersons = [...validation.persons].sort((left, right) => {
    const leftOrder = left.metadata?.order ?? Number.POSITIVE_INFINITY
    const rightOrder = right.metadata?.order ?? Number.POSITIVE_INFINITY

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  })
  const orderIndexByPersonId = new Map(orderedPersons.map((person, index) => [person.id, index]))

  const generationByPersonId = new Map<UUID, number>()

  const getGeneration = (personId: UUID, stack: Set<UUID>): number => {
    const cached = generationByPersonId.get(personId)

    if (cached !== undefined) {
      return cached
    }

    if (stack.has(personId)) {
      return 0
    }

    stack.add(personId)
    const parentIds = validation.parentsByChild.get(personId) ?? []
    const generation = parentIds.length === 0
      ? 0
      : Math.max(...parentIds.map((parentId) => getGeneration(parentId, stack))) + 1
    stack.delete(personId)
    generationByPersonId.set(personId, generation)

    return generation
  }

  const rowIdsByGeneration = new Map<number, UUID[]>()

  for (const person of orderedPersons) {
    const generation = getGeneration(person.id, new Set<UUID>())
    const rowIds = rowIdsByGeneration.get(generation) ?? []
    rowIds.push(person.id)
    rowIdsByGeneration.set(generation, rowIds)
  }

  const layoutNodes = new Map<UUID, PositionedNode>()
  const xByPersonId = new Map<UUID, number>()
  const sortedGenerations = [...rowIdsByGeneration.keys()].sort((left, right) => left - right)

  const getOrderIndex = (personId: UUID) => orderIndexByPersonId.get(personId) ?? Number.MAX_SAFE_INTEGER

  const sortParentIds = (parentIds: UUID[]) => [...parentIds].sort((left, right) => left.localeCompare(right))

  const buildRowBlocks = (rowIdSet: Set<UUID>, memberIds: UUID[]) => {
    const sortedMemberIds = [...memberIds].sort((left, right) => getOrderIndex(left) - getOrderIndex(right) || left.localeCompare(right))
    const orderInGroupById = new Map(sortedMemberIds.map((personId, index) => [personId, index]))
    const usedIds = new Set<UUID>()
    const blocks: UUID[][] = []

    for (const personId of sortedMemberIds) {
      if (usedIds.has(personId)) {
        continue
      }

      const partnerIds = [...(spouseIdsByPersonId.get(personId) ?? new Set<UUID>())]
        .filter((candidateId) => rowIdSet.has(candidateId) && !usedIds.has(candidateId) && sortedMemberIds.includes(candidateId))

      if (partnerIds.length === 0) {
        usedIds.add(personId)
        blocks.push([personId])
        continue
      }

      const partnerId = partnerIds.sort((left, right) => {
        const leftDistance = Math.abs((orderInGroupById.get(left) ?? 0) - (orderInGroupById.get(personId) ?? 0))
        const rightDistance = Math.abs((orderInGroupById.get(right) ?? 0) - (orderInGroupById.get(personId) ?? 0))

        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance
        }

        return left.localeCompare(right)
      })[0]

      usedIds.add(personId)
      usedIds.add(partnerId)

      const pair = [personId, partnerId].sort((left, right) => {
        const leftOrder = orderInGroupById.get(left) ?? 0
        const rightOrder = orderInGroupById.get(right) ?? 0

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder
        }

        return left.localeCompare(right)
      })
      blocks.push(pair)
    }

    return blocks
  }

  const getBlockWidth = (block: UUID[]) => block.length === 2 ? (2 * nodeWidth + partnerGap) : nodeWidth

  const getParentAnchorX = (parentIds: UUID[]): number | null => {
    if (parentIds.length === 0) {
      return null
    }

    const parentCenters = parentIds
      .map((parentId) => xByPersonId.get(parentId))
      .filter((x): x is number => x !== undefined)

    if (parentCenters.length !== parentIds.length || parentCenters.length === 0) {
      return null
    }

    return parentCenters.reduce((sum, value) => sum + value, 0) / parentCenters.length
  }

  for (const generation of sortedGenerations) {
    const rowIds = rowIdsByGeneration.get(generation) ?? []
    const rowIdSet = new Set(rowIds)
    type GridGroup = {
      key: string
      memberIds: UUID[]
      parentIds: UUID[]
      anchorX: number
      houseOrderRank: number
      desiredLeft: number | null
      blocks: UUID[][]
      width: number
      left: number
    }

    const groupsByKey = new Map<string, { parentIds: UUID[]; memberIds: UUID[] }>()

    for (const personId of rowIds) {
      const parentIds = sortParentIds(validation.parentsByChild.get(personId) ?? [])
      const house = getStartAnchorHouse(personId)
      const key = parentIds.length > 0
        ? parentIds.join('|')
        : house
          ? `__house__${house.tier}__${house.id}`
          : `__root__${personId}`
      const existing = groupsByKey.get(key)

      if (existing) {
        existing.memberIds.push(personId)
      } else {
        groupsByKey.set(key, {
          parentIds,
          memberIds: [personId],
        })
      }
    }

    const groups: GridGroup[] = [...groupsByKey.entries()].map(([key, group]) => {
      const blocks = buildRowBlocks(rowIdSet, group.memberIds)
      const width = blocks.reduce((sum, block) => sum + getBlockWidth(block), 0) + Math.max(0, blocks.length - 1) * blockGap
      const anchorX = getParentAnchorX(group.parentIds) ?? Number.POSITIVE_INFINITY
      const samplePersonId = group.memberIds[0]
      const house = samplePersonId ? getStartAnchorHouse(samplePersonId) : null
      const houseOrderRank = house
        ? (house.tier === 'start' ? 0 : 1000) + house.anchor.order
        : Number.POSITIVE_INFINITY

      return {
        key,
        memberIds: [...group.memberIds].sort((left, right) => getOrderIndex(left) - getOrderIndex(right) || left.localeCompare(right)),
        parentIds: group.parentIds,
        anchorX,
        houseOrderRank,
        desiredLeft: Number.isFinite(anchorX) ? anchorX - width / 2 : null,
        blocks,
        width,
        left: 0,
      }
    })

    groups.sort((left, right) => {
      if (left.anchorX !== right.anchorX) {
        return left.anchorX - right.anchorX
      }

      if (left.houseOrderRank !== right.houseOrderRank) {
        return left.houseOrderRank - right.houseOrderRank
      }

      const leftOrder = getOrderIndex(left.memberIds[0] ?? '')
      const rightOrder = getOrderIndex(right.memberIds[0] ?? '')

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }

      return left.key.localeCompare(right.key)
    })

    let cursorX = 0
    let hasPlacedGroup = false

    for (const group of groups) {
      if (!hasPlacedGroup) {
        group.left = group.desiredLeft ?? 0
        cursorX = group.left + group.width
        hasPlacedGroup = true
        continue
      }

      const flowLeft = cursorX + groupGap
      const anchoredLeft = group.desiredLeft ?? flowLeft
      group.left = Math.max(flowLeft, anchoredLeft)
      cursorX = group.left + group.width
    }

    // Backward relaxation: pull blocks toward their desired anchors without violating right-neighbor spacing.
    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const group = groups[index]
      const desiredLeft = group.desiredLeft ?? group.left
      const maxAllowedLeft = index === groups.length - 1
        ? Number.POSITIVE_INFINITY
        : groups[index + 1].left - groupGap - group.width
      group.left = Math.min(group.left, desiredLeft, maxAllowedLeft)
    }

    // Forward correction: restore monotonic spacing after the relaxation pull.
    for (let index = 1; index < groups.length; index += 1) {
      const previous = groups[index - 1]
      const current = groups[index]
      const minimumLeft = previous.left + previous.width + groupGap

      if (current.left < minimumLeft) {
        current.left = minimumLeft
      }
    }

    const minLeft = groups.length > 0 ? Math.min(...groups.map((group) => group.left)) : 0
    if (Number.isFinite(minLeft) && minLeft < 0) {
      for (const group of groups) {
        group.left -= minLeft
      }
    }

    const rowY = generation * (nodeHeight + rowGap)

    for (const group of groups) {
      let blockX = group.left

      for (const block of group.blocks) {
        if (block.length === 1) {
          const personId = block[0]
          layoutNodes.set(personId, {
            id: personId,
            x: blockX,
            y: rowY,
            width: nodeWidth,
            height: nodeHeight,
          })
          xByPersonId.set(personId, blockX + nodeWidth / 2)
          blockX += nodeWidth + blockGap
          continue
        }

        const leftId = block[0]
        const rightId = block[1]
        const leftX = blockX
        const rightX = blockX + nodeWidth + partnerGap

        layoutNodes.set(leftId, {
          id: leftId,
          x: leftX,
          y: rowY,
          width: nodeWidth,
          height: nodeHeight,
        })
        layoutNodes.set(rightId, {
          id: rightId,
          x: rightX,
          y: rowY,
          width: nodeWidth,
          height: nodeHeight,
        })
        xByPersonId.set(leftId, leftX + nodeWidth / 2)
        xByPersonId.set(rightId, rightX + nodeWidth / 2)
        blockX += (2 * nodeWidth + partnerGap) + blockGap
      }
    }
  }

  // Phase 2 of grid placement: shift each generation as a whole toward structural anchors.
  for (const generation of sortedGenerations) {
    const rowIds = rowIdsByGeneration.get(generation) ?? []
    const rowNodes = rowIds
      .map((personId) => layoutNodes.get(personId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (rowNodes.length === 0) {
      continue
    }

    const rowCenterX = rowNodes.reduce((sum, node) => sum + node.x + node.width / 2, 0) / rowNodes.length
    const anchorCandidates: number[] = []

    for (const personId of rowIds) {
      const parentIds = validation.parentsByChild.get(personId) ?? []
      const parentCenters = parentIds
        .map((parentId) => xByPersonId.get(parentId))
        .filter((x): x is number => x !== undefined)

      if (parentCenters.length > 0) {
        anchorCandidates.push(parentCenters.reduce((sum, value) => sum + value, 0) / parentCenters.length)
        continue
      }

      const childIds = validation.childrenByParent.get(personId) ?? []
      const childCenters = childIds
        .map((childId) => xByPersonId.get(childId))
        .filter((x): x is number => x !== undefined)

      if (childCenters.length > 0) {
        anchorCandidates.push(childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length)
      }
    }

    if (anchorCandidates.length === 0) {
      continue
    }

    const targetCenterX = anchorCandidates.reduce((sum, value) => sum + value, 0) / anchorCandidates.length
    const deltaX = targetCenterX - rowCenterX

    if (Math.abs(deltaX) < 0.5) {
      continue
    }

    for (const personId of rowIds) {
      const node = layoutNodes.get(personId)

      if (!node) {
        continue
      }

      const shiftedNode = {
        ...node,
        x: node.x + deltaX,
      }
      layoutNodes.set(personId, shiftedNode)
      xByPersonId.set(personId, shiftedNode.x + shiftedNode.width / 2)
    }
  }

  if (layoutNodes.size === 0) {
    return { nodes: layoutNodes }
  }

  const minX = Math.min(...[...layoutNodes.values()].map((node) => node.x))
  const minY = Math.min(...[...layoutNodes.values()].map((node) => node.y))
  const normalizedNodes = new Map<UUID, PositionedNode>()

  for (const node of layoutNodes.values()) {
    normalizedNodes.set(node.id, {
      ...node,
      x: node.x - minX + outerPadding,
      y: node.y - minY + outerPadding,
    })
  }

  return { nodes: normalizedNodes }
}

function applyModeR2PostLayoutPasses({
  layout,
  overlayRelations,
  biologicalRelations,
  anchoredNodeIds,
  marriagePairMaxCenterYDelta,
}: {
  layout: LayoutResult
  overlayRelations: Relation[]
  biologicalRelations: Relation[]
  anchoredNodeIds: Set<UUID>
  marriagePairMaxCenterYDelta: number
}): LayoutResult {
  const marriageAlignedLayout = placeMarriagePairsLocally(
    layout,
    overlayRelations,
    anchoredNodeIds,
    biologicalRelations,
    {
      maxCenterYDelta: marriagePairMaxCenterYDelta,
      preferSameRow: true,
      allowPairMidpointFallback: false,
      allowAnchoredFallbackPlacement: false,
      rasterColumnStep: R2_RASTER_COLUMN_SIZE,
      rasterColumnOrigin: R2_RASTER_OUTER_PADDING,
      rasterRowStep: R2_RASTER_ROW_HEIGHT,
      rasterRowOrigin: R2_RASTER_OUTER_PADDING,
    },
  )

  const childAxisAlignedLayout = alignTwoParentPairsToChildAxis(
    marriageAlignedLayout,
    biologicalRelations,
    overlayRelations,
    { requireMarriage: false, maxShiftX: 180 },
  )

  const normalizedMarriageLayout = normalizeMarriagePairGeometry(
    childAxisAlignedLayout,
    overlayRelations,
    { maxCenterYDelta: marriagePairMaxCenterYDelta },
  )

  const deoverlappedLayout = resolveHorizontalNodeOverlaps(normalizedMarriageLayout, {
    minimumGap: 24,
    rowQuantization: 6,
  })

  const singleChildTargets = getSingleChildCenterTargets(deoverlappedLayout, biologicalRelations)
  const singleChildCenteredLayout = alignSingleChildNodes(deoverlappedLayout, singleChildTargets)

  const realignedLayout = alignTwoParentPairsToChildAxis(
    singleChildCenteredLayout,
    biologicalRelations,
    overlayRelations,
    { requireMarriage: false, maxShiftX: 180 },
  )

  const finalRowDeoverlappedLayout = resolveHorizontalNodeOverlaps(realignedLayout, {
    minimumGap: 24,
    rowQuantization: 6,
  })

  const collisionResolvedLayout = resolveNodeCollisions2D(finalRowDeoverlappedLayout, {
    minimumGap: 20,
    maxIterations: 8,
    rasterColumnStep: R2_RASTER_COLUMN_SIZE,
    rasterColumnOrigin: R2_RASTER_OUTER_PADDING,
  })

  // Final R2 stabilization: enforce hard biological axes (1..2 parents, n children)
  // and alternate with collision resolution so neither constraint class is ignored.
  let solvedLayout = collisionResolvedLayout
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const axisLockedLayout = enforceBiologicalFamilyAxes(solvedLayout, biologicalRelations, {
      maxParentCount: 2,
      maxIterations: 6,
      epsilon: 0.001,
      targetCoupleGap: 32,
    })

    solvedLayout = resolveNodeCollisions2D(axisLockedLayout, {
      minimumGap: 20,
      maxIterations: 4,
      rasterColumnStep: R2_RASTER_COLUMN_SIZE,
      rasterColumnOrigin: R2_RASTER_OUTER_PADDING,
    })
  }

  return snapLayoutToRaster(solvedLayout, {
    columnStep: R2_RASTER_COLUMN_SIZE,
    rowStep: R2_RASTER_ROW_HEIGHT,
    originX: R2_RASTER_OUTER_PADDING,
    originY: R2_RASTER_OUTER_PADDING,
    biologicalRelations,
  })
}

function snapLayoutToRaster(
  layout: LayoutResult,
  options: {
    columnStep: number
    rowStep: number
    originX: number
    originY: number
    biologicalRelations: Relation[]
  },
): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const secondaryOriginX = options.originX + options.columnStep / 2
  const cellColumnStep = options.columnStep / 2
  const nodePhaseById = new Map<UUID, 0 | 1>()

  const snap = (value: number, origin: number, step: number): number => {
    if (!Number.isFinite(value) || step <= 0) {
      return value
    }

    return origin + Math.round((value - origin) / step) * step
  }

  const getNearestPhase = (value: number): 0 | 1 => {
    const snappedPrimary = snap(value, options.originX, options.columnStep)
    const snappedSecondary = snap(value, secondaryOriginX, options.columnStep)
    const primaryDistance = Math.abs(value - snappedPrimary)
    const secondaryDistance = Math.abs(value - snappedSecondary)

    if (secondaryDistance < primaryDistance) {
      return 1
    }

    return 0
  }

  const biologicalGroups = buildBiologicalChildGroups(options.biologicalRelations, layout)
    .sort((left, right) => left.key.localeCompare(right.key))

  for (const group of biologicalGroups) {
    const parentCenters = group.parentIds
      .map((parentId) => adjustedNodes.get(parentId))
      .filter((node): node is PositionedNode => node !== undefined)
      .map((node) => node.x + node.width / 2)

    const fallbackCenters = group.childIds
      .map((childId) => adjustedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)
      .map((node) => node.x + node.width / 2)

    if (parentCenters.length === 0 && fallbackCenters.length === 0) {
      continue
    }

    const referenceCenters = parentCenters.length > 0 ? parentCenters : fallbackCenters
    const familyCenter = referenceCenters.reduce((sum, centerX) => sum + centerX, 0) / referenceCenters.length
    const basePhase = getNearestPhase(familyCenter)
    const childPhase: 0 | 1 = group.childIds.length % 2 === 0 ? basePhase : (basePhase === 0 ? 1 : 0)

    for (const childId of group.childIds) {
      if (!nodePhaseById.has(childId)) {
        nodePhaseById.set(childId, childPhase)
      }
    }

    for (const parentId of group.parentIds) {
      if (!nodePhaseById.has(parentId)) {
        nodePhaseById.set(parentId, basePhase)
      }
    }
  }

  for (const node of adjustedNodes.values()) {
    const phase = nodePhaseById.get(node.id) ?? getNearestPhase(node.x)
    const phaseOriginX = phase === 0 ? options.originX : secondaryOriginX

    adjustedNodes.set(node.id, {
      ...node,
      x: snap(node.x, phaseOriginX, options.columnStep),
      y: snap(node.y, options.originY, options.rowStep),
    })
  }

  // Final hard-cell pass (Excel model): one row/column slot can hold only one person.
  const occupiedCells = new Set<string>()
  const sortedNodes = [...adjustedNodes.values()].sort((left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id))

  const toRowIndex = (value: number) => Math.round((value - options.originY) / options.rowStep)
  const toColumnIndex = (value: number) => Math.round((value - options.originX) / cellColumnStep)
  const toX = (columnIndex: number) => options.originX + columnIndex * cellColumnStep
  const toY = (rowIndex: number) => options.originY + rowIndex * options.rowStep
  const cellKey = (rowIndex: number, columnIndex: number) => `${rowIndex}:${columnIndex}`

  const findFreeColumn = (rowIndex: number, preferredColumnIndex: number): number => {
    const directKey = cellKey(rowIndex, preferredColumnIndex)
    if (!occupiedCells.has(directKey)) {
      return preferredColumnIndex
    }

    for (let offset = 1; offset < 2048; offset += 1) {
      const right = preferredColumnIndex + offset
      const rightKey = cellKey(rowIndex, right)
      if (!occupiedCells.has(rightKey)) {
        return right
      }

      const left = preferredColumnIndex - offset
      const leftKey = cellKey(rowIndex, left)
      if (!occupiedCells.has(leftKey)) {
        return left
      }
    }

    return preferredColumnIndex
  }

  for (const node of sortedNodes) {
    const rowIndex = toRowIndex(node.y)
    const preferredColumnIndex = toColumnIndex(node.x)
    const assignedColumnIndex = findFreeColumn(rowIndex, preferredColumnIndex)
    occupiedCells.add(cellKey(rowIndex, assignedColumnIndex))

    adjustedNodes.set(node.id, {
      ...node,
      x: toX(assignedColumnIndex),
      y: toY(rowIndex),
    })
  }

  return { nodes: adjustedNodes }
}

function applyModeRStartHouseSubtreeOffsets(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  generationUnit: number,
): LayoutResult {
  const normalizeHouseKey = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

  const houseByKey = new Map<string, HouseDefinition>()
  for (const house of houseDefinitions.houses) {
    houseByKey.set(normalizeHouseKey(house.id), house)
    houseByKey.set(normalizeHouseKey(house.displayName), house)
    for (const alias of house.aliases ?? []) {
      houseByKey.set(normalizeHouseKey(alias), house)
    }
  }

  const getPrimaryHouse = (personId: UUID): HouseDefinition | null => {
    const person = validation.personById.get(personId)

    if (!person) {
      return null
    }

    for (const houseName of person.houses ?? []) {
      const match = houseByKey.get(normalizeHouseKey(houseName))

      if (match) {
        return match
      }
    }

    return null
  }

  const startHouses = houseDefinitions.houses
    .filter((house) => house.anchor.enabled && house.tier === 'start')
    .sort((left, right) => left.anchor.order - right.anchor.order || left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id))

  if (startHouses.length === 0) {
    return layout
  }

  type StartHouseContext = {
    house: HouseDefinition
    rootIds: UUID[]
    subtreeIds: UUID[]
    topY: number
  }

  const contexts: StartHouseContext[] = []

  for (const house of startHouses) {
    const memberIds = validation.persons
      .filter((person) => getPrimaryHouse(person.id)?.id === house.id)
      .map((person) => person.id)
    const memberNodes = memberIds
      .map((memberId) => layout.nodes.get(memberId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (memberNodes.length === 0) {
      continue
    }

    const minMemberY = Math.min(...memberNodes.map((node) => node.y))
    const rootIds = memberNodes
      .filter((node) => Math.abs(node.y - minMemberY) < 1)
      .map((node) => node.id)
      .sort((left, right) => left.localeCompare(right))

    if (rootIds.length === 0) {
      continue
    }

    const subtreeIdSet = new Set<UUID>()
    const queue = [...rootIds]
    while (queue.length > 0) {
      const currentId = queue.shift()

      if (!currentId || subtreeIdSet.has(currentId)) {
        continue
      }

      subtreeIdSet.add(currentId)
      for (const childId of validation.childrenByParent.get(currentId) ?? []) {
        queue.push(childId)
      }
    }

    contexts.push({
      house,
      rootIds,
      subtreeIds: [...subtreeIdSet].sort((left, right) => left.localeCompare(right)),
      topY: minMemberY,
    })
  }

  if (contexts.length === 0) {
    return layout
  }

  const baselineTopY = Math.min(...contexts.map((context) => context.topY))
  const adjustedNodes = new Map(layout.nodes)
  const shiftedNodeIds = new Set<UUID>()

  for (const context of contexts) {
    const offsetGenerations = context.house.layout?.yOffset ?? 0
    const targetTopY = baselineTopY + offsetGenerations * generationUnit
    const deltaY = targetTopY - context.topY

    if (Math.abs(deltaY) < 0.5) {
      continue
    }

    for (const nodeId of context.subtreeIds) {
      if (shiftedNodeIds.has(nodeId)) {
        continue
      }

      const currentNode = adjustedNodes.get(nodeId)

      if (!currentNode) {
        continue
      }

      shiftedNodeIds.add(nodeId)
      adjustedNodes.set(nodeId, {
        ...currentNode,
        y: currentNode.y + deltaY,
      })
    }
  }

  return {
    nodes: adjustedNodes,
  }
}

function shiftLayoutY(layout: LayoutResult, deltaY: number): LayoutResult {
  if (Math.abs(deltaY) < 0.5) {
    return layout
  }

  const adjustedNodes = new Map<UUID, PositionedNode>()

  for (const node of layout.nodes.values()) {
    adjustedNodes.set(node.id, {
      ...node,
      y: node.y + deltaY,
    })
  }

  return {
    nodes: adjustedNodes,
  }
}

function buildPreview3TreeDebugData(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  houseAnchors: HouseAnchor[],
  modeDefinition: Preview3ModeDefinition,
  effectiveHouseYOffsetUnit: number,
  followRulerLine: boolean,
): Preview3TreeDebugData {
  const r3Artifacts = modeDefinition.id === 'modeR3'
    ? getModeR3LayoutArtifacts(layout)
    : modeDefinition.id === 'modeR3B'
    ? getModeR3BLayoutArtifacts(layout)
    : null

  const strategySummary = [
    `Layout: ${modeDefinition.pipeline.layoutStrategy}`,
    `House anchors: ${modeDefinition.pipeline.houseAnchorStrategy}`,
    `Spouse projection: ${modeDefinition.render.spouseProjection.enabled ? 'on' : 'off'}`,
    `Marriage overlay: ${modeDefinition.render.marriageOverlayStyle}`,
    `Curated person order: ${modeDefinition.pipeline.applyCuratedPersonOrder ? 'on' : 'off'}`,
    `Curated person offsets: ${modeDefinition.pipeline.applyCuratedPersonOffsets ? 'on' : 'off'}`,
    `Layout component spacing: ${Math.round(modeDefinition.pipeline.layoutComponentSpacing)}px`,
    `Layout X scale: ${modeDefinition.pipeline.layoutXScale.toFixed(2)}x`,
    `Layout Y scale: ${modeDefinition.pipeline.layoutYScale.toFixed(2)}x`,
    `House subtree offsets: ${modeDefinition.pipeline.applyHouseSubtreeOffsets ? 'on' : 'off'}`,
    `House subtree vertical yOffset: ${modeDefinition.pipeline.applyHouseSubtreeVerticalOffset ? 'on' : 'off'}`,
    `House anchor yOffset: ${modeDefinition.pipeline.applyHouseAnchorYOffset ? 'on' : 'off'} (${Math.round(effectiveHouseYOffsetUnit)}px per unit, ${modeDefinition.pipeline.houseYOffsetUnitSource})`,
    `House anchor vertical alignment: ${modeDefinition.pipeline.houseAnchorVerticalAlignment}`,
    `Anchor centering: ${modeDefinition.pipeline.strictAnchorCentering ? 'strict founder-centered' : 'collision-safe'}`,
    `House order X resolution: ${modeDefinition.pipeline.applyHouseOrderXResolution ? 'on' : 'off'}`,
    `Horizontal de-overlap: ${modeDefinition.pipeline.applyHorizontalDeoverlap ? 'on' : 'off'}`,
    `Disconnected component packing: ${modeDefinition.pipeline.applyDisconnectedComponentPacking ? 'on' : 'off'}`,
  ]

  if (modeDefinition.id === 'modeR3' || modeDefinition.id === 'modeR3B') {
    strategySummary.push(`FollowRulerLine: ${followRulerLine ? 'on' : 'off'}`)
    strategySummary.push(`R3 artifacts present: ${r3Artifacts ? 'yes' : 'no'}`)
    strategySummary.push(`R3 family placements: ${r3Artifacts?.familyPlacements.length ?? 0}`)
    strategySummary.push(`R3 house anchor placements: ${r3Artifacts?.houseAnchorPlacements.length ?? 0}`)
  }

  return {
    modeId: modeDefinition.id,
    modeLabel: modeDefinition.label,
    modeSummary: modeDefinition.summary,
    strategySummary,
    activeStages: modeDefinition.pipeline.stages,
    houseAnchors: buildHouseAnchorDebugEntries(validation, layout, houseDefinitions, houseAnchors, {
      strategy: modeDefinition.pipeline.houseAnchorStrategy,
      applyHouseLayoutYOffset: modeDefinition.pipeline.applyHouseAnchorYOffset,
      houseYOffsetUnit: effectiveHouseYOffsetUnit,
    }),
    appliedHouseOffsets: houseDefinitions.houses
      .filter((house) => (house.layout?.yOffset ?? 0) !== 0)
      .map((house) => ({
        houseId: house.id,
        displayName: house.displayName,
        yOffset: house.layout?.yOffset ?? 0,
      })),
    appliedPersonOffsets: validation.persons
      .filter((person) => (person.metadata?.layout?.yOffset ?? 0) !== 0)
      .map((person) => ({
        personId: person.id,
        name: person.name,
        yOffset: person.metadata?.layout?.yOffset ?? 0,
      })),
  }
}

function resolveHouseYOffsetUnit(
  modeDefinition: Preview3ModeDefinition,
  layout: LayoutResult,
  biologicalRelations: Relation[],
): number {
  if (modeDefinition.pipeline.houseYOffsetUnitSource !== 'generation') {
    return modeDefinition.pipeline.houseYOffsetUnit
  }

  const generationDeltas: number[] = []

  for (const relation of biologicalRelations) {
    const parentNode = layout.nodes.get(relation.from)
    const childNode = layout.nodes.get(relation.to)

    if (!parentNode || !childNode) {
      continue
    }

    const delta = childNode.y - parentNode.y

    if (delta > 0) {
      generationDeltas.push(delta)
    }
  }

  if (generationDeltas.length === 0) {
    return modeDefinition.pipeline.houseYOffsetUnit
  }

  generationDeltas.sort((left, right) => left - right)
  const middle = Math.floor(generationDeltas.length / 2)

  if (generationDeltas.length % 2 === 0) {
    return (generationDeltas[middle - 1] + generationDeltas[middle]) / 2
  }

  return generationDeltas[middle]
}
