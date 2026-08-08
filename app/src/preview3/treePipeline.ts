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
import { buildModeR2Layout } from './rasterModeR2'

import {
  applyHouseSubtreeOffsets,
  applyCuratedPersonOffsets,
  applyCuratedPersonOrder,
  alignMarriagePairs,
  alignMarriagePairsToFamilyAxis,
  alignTwoParentPairsToChildAxis,
  recenterMultiChildGroups,
  symmetrizeChildGroups,
  alignSingleParentChildGroups,
  alignSingleParentSingleChildNodes,
  alignSingleChildNodes,
  buildBiologicalChildGroups,
  buildHouseAnchorDebugEntries,
  buildHouseAnchors,
  buildSpouseProjectionState,
  expandCameraBounds,
  getSingleChildCenterTargets,
  resolveHouseOrderXConflicts,
  resolveHorizontalNodeOverlaps,
  packDisconnectedComponents,
  scaleLayoutX,
  scaleLayoutY,
  type BiologicalChildGroup,
  type HouseAnchor,
  type HouseAnchorDebugEntry,
  type SpouseProjectionState,
} from './treeCore'

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

export async function buildPreview3TreePipeline(dataset: LoadedDataset, modeDefinition: Preview3ModeDefinition): Promise<Preview3TreePipelineResult> {
  const validation = validateDataset(dataset)
  const useVirtualGridLayout = modeDefinition.id === 'modeR' || modeDefinition.id === 'modeR2'
  const useModeRLayout = modeDefinition.id === 'modeR'
  const useModeR2Layout = modeDefinition.id === 'modeR2'
  const useElkFirstLayoutPasses = modeDefinition.id === 'modeC'
  const useExperimentalLayoutPasses = modeDefinition.id === 'modeD'
  const rawLayout = useModeR2Layout
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
  const marriageAlignedLayout = modeDefinition.pipeline.applyMarriagePairAlignment
    ? alignMarriagePairs(
        singleParentAlignedLayout,
        validation.validOverlayRelations,
        new Set(singleChildCenterTargets.keys()),
        validation.validBiologicalRelations,
      )
    : singleParentAlignedLayout
  const orderedLayout = modeDefinition.pipeline.applyCuratedPersonOrder
    ? applyCuratedPersonOrder(marriageAlignedLayout, validation.persons)
    : marriageAlignedLayout
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

  let houseAnchors = buildHouseAnchors(validation, layout, dataset.houseDefinitions, {
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

  const debugData = buildPreview3TreeDebugData(validation, layout, dataset.houseDefinitions, houseAnchors, modeDefinition, effectiveHouseYOffsetUnit)
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
}

export function buildPreview3RenderedTree({
  validation,
  layout,
  houseDefinitions,
  selectedIds,
  spouseOwnerOverrides,
  shouldHideNode,
  modeDefinition,
}: {
  validation: ValidationResult
  layout: LayoutResult
  houseDefinitions: HouseDefinitions
  selectedIds: UUID[]
  spouseOwnerOverrides: Record<string, UUID>
  shouldHideNode: (personId: UUID) => boolean
  modeDefinition: Preview3ModeDefinition
}): Preview3RenderedTree {
  const effectiveHouseYOffsetUnit = resolveHouseYOffsetUnit(modeDefinition, layout, validation.validBiologicalRelations)
  const spouseProjection = modeDefinition.render.useSpouseProjection
    ? buildSpouseProjectionState(validation, layout, selectedIds, spouseOwnerOverrides, {
        collapseChildEdges: modeDefinition.render.collapseProjectedChildEdges,
      })
    : {
        hiddenChildEdgeKeys: new Set<string>(),
        projectedMarriageIds: new Set<UUID>(),
        nodes: [],
      }
  const houseAnchors = buildHouseAnchors(validation, layout, houseDefinitions, {
    strategy: modeDefinition.pipeline.houseAnchorStrategy,
    applyHouseLayoutYOffset: modeDefinition.pipeline.applyHouseAnchorYOffset,
    houseYOffsetUnit: effectiveHouseYOffsetUnit,
    preserveIdealCenterX: modeDefinition.pipeline.strictAnchorCentering,
    verticalAlignment: modeDefinition.pipeline.houseAnchorVerticalAlignment,
  })

  const biologicalRelations = validation.validBiologicalRelations
    .filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
    .filter((relation) => !modeDefinition.render.useSpouseProjection || !spouseProjection.hiddenChildEdgeKeys.has(`${relation.from}|${relation.to}`))

  const overlayRelations = modeDefinition.render.showOverlayRelations
    ? validation.validOverlayRelations
      .filter((relation) => !shouldHideNode(relation.from) && !shouldHideNode(relation.to))
      .filter((relation) => !modeDefinition.render.useSpouseProjection || !spouseProjection.projectedMarriageIds.has(relation.id))
    : []

  const biologicalChildGroups = buildBiologicalChildGroups(biologicalRelations, layout)

  return {
    spouseProjection,
    houseAnchors,
    biologicalRelations,
    overlayRelations,
    biologicalChildGroups,
  }
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
): Preview3TreeDebugData {
  return {
    modeId: modeDefinition.id,
    modeLabel: modeDefinition.label,
    modeSummary: modeDefinition.summary,
    strategySummary: [
      `Layout: ${modeDefinition.pipeline.layoutStrategy}`,
      `House anchors: ${modeDefinition.pipeline.houseAnchorStrategy}`,
      `Spouse projection: ${modeDefinition.render.useSpouseProjection ? 'on' : 'off'}`,
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
    ],
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
