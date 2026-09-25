import type {
  HouseDefinitions,
  LayoutResult,
  PositionedNode,
  UUID,
  ValidationResult,
} from '../../graph'
import { createHouseLookup, type HouseLookup } from '../r3/houses'
import { sortPersonIdsForR3 } from '../r3/sorting'
import { buildBiologicalFamilies, compareFamilyGroups } from '../r3/families'
import { buildGenerationRows } from '../r3/generation'
import { buildClusterAssignments, buildClusters } from '../r3/clusters'
import type { R3FamilyGroup, R3FamilyPlacement, R3HouseAnchorPlacement, R3PlacementPlan } from '../r3/types'
import { SPOUSE_PROJECTION_HORIZONTAL_GAP, SPOUSE_PROJECTION_NODE_WIDTH } from '../ruleConstants'
import { buildR3BMarriagePartnerIdsByPerson, buildR3BProjectionGeometry } from './projections'
import { buildR3BProjectionContextKey, buildR3BProjectionPlan } from './projectionPlan'
import type { R3BLayoutArtifacts, R3BProjectionPlan, R3BVisibleParentSlot } from './types'

const NODE_WIDTH = 176
const NODE_HEIGHT = 64
const OUTER_PADDING = 40
const ROW_HEIGHT = 192
const COLUMN_WIDTH = 220
const PARTNER_GAP = 44
const ROOT_GAP_COLUMNS = 1.25
const CLUSTER_GAP_COLUMNS = 1.75
const CHILD_GAP_COLUMNS = 0.7
const SPOUSE_STEP_COLUMNS = (NODE_WIDTH + PARTNER_GAP) / COLUMN_WIDTH
const PROJECTED_VISIBLE_PAIR_SPAN_COLUMNS = (NODE_WIDTH + SPOUSE_PROJECTION_HORIZONTAL_GAP + SPOUSE_PROJECTION_NODE_WIDTH) / COLUMN_WIDTH
const TWO_CHILD_SPAN_COMPRESSION = 0.28
const SINGLE_PARENT_TWO_CHILD_SPAN_COMPRESSION = 0.24
const TWO_CHILD_HEAVY_BRANCH_RATIO_THRESHOLD = 2.6
const TWO_CHILD_LIGHT_BRANCH_MAX_SPAN = 1.35
const MULTI_SIBLING_SPAN_COMPRESSION = 0.42
const SINGLE_PARENT_MULTI_SIBLING_SPAN_COMPRESSION = 0.34
const ROW_DEOVERLAP_MIN_GAP = 20
const TWO_CHILD_CONTINUATION_MIN_CENTER_DISTANCE = 640
const SIBLING_GROUP_TARGET_GAP = 44
const COUSIN_GROUP_MIN_GAP = 160
const r3bArtifactsByNodes = new WeakMap<Map<UUID, PositionedNode>, R3BLayoutArtifacts>()

export function buildModeR3BLayout(
  validation: ValidationResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    followRulerLine?: boolean
  },
): LayoutResult {
  const followRulerLine = options?.followRulerLine ?? false
  const personById = validation.personById
  const houseLookup = createHouseLookup(houseDefinitions, personById)
  const orderedPersonIds = sortPersonIdsForR3(validation.persons.map((person) => person.id), personById)
  const biologicalFamilies = buildBiologicalFamilies(validation)
  const placementPlan = buildPlacementPlan({
    validation,
    houseDefinitions,
    orderedPersonIds,
    biologicalFamilies,
    houseLookup,
  })
  const projectionPlan = buildR3BProjectionPlan({ validation, families: placementPlan.families })
  const marriagePartnerIdsByPerson = buildR3BMarriagePartnerIdsByPerson(
    validation.validOverlayRelations.filter((relation) => relation.type === 'marriage'),
  )
  const positionedNodes = new Map<UUID, PositionedNode>()
  const subtreeSpanCache = new Map<UUID, number>()
  const placedPersons = new Set<UUID>()
  const spouseAttachedToOwnerLineageIds = new Set<UUID>()
  const spouseAttachedByOwnerId = new Map<UUID, Set<UUID>>()
  const familyPlacements = new Map<string, R3FamilyPlacement>()
  const visibleParentSlotsByFamily = new Map<string, R3BVisibleParentSlot[]>()

  const finalProjectionSlotsByContext = new Map<string, R3BVisibleParentSlot>()
  const houseAnchorPlacements = new Map<string, R3HouseAnchorPlacement>()
  const sortedClusters = buildClusters({
    validation,
    houseDefinitions,
    orderedPersonIds,
    placementPlan,
    houseLookup,
  })
  let clusterCursor = 0

  for (const cluster of sortedClusters) {
    const clusterWidth = getClusterWidth(cluster.rootIds, placementPlan, subtreeSpanCache, validation, projectionPlan)
    let rootCursor = clusterCursor

    for (const rootId of cluster.rootIds) {
      const rootWidth = getPersonSubtreeSpan(rootId, placementPlan, subtreeSpanCache, validation, projectionPlan)
      const rootCenter = rootCursor + rootWidth / 2
      placePersonBranch({
        personId: rootId,
        centerColumn: rootCenter,
        followRulerLine,
        validation,
        placementPlan,
        projectionPlan,
        positionedNodes,
        placedPersons,
        spouseAttachedToOwnerLineageIds,
        spouseAttachedByOwnerId,
        visibleParentSlotsByFamily,
        marriagePartnerIdsByPerson,
        subtreeSpanCache,
        familyPlacements,
      })
      rootCursor += rootWidth + ROOT_GAP_COLUMNS
    }

    if (cluster.house && cluster.rootIds.length > 0) {
      const anchorRootIds = resolveHouseAnchorRootIds({
        rootIds: cluster.rootIds,
        houseTier: cluster.house.tier,
        placementPlan,
        validation,
      })
      const rootNodes = anchorRootIds
        .map((rootId) => positionedNodes.get(rootId))
        .filter((node): node is PositionedNode => node !== undefined)

      if (rootNodes.length > 0) {
        const minRootCenterX = Math.min(...rootNodes.map((node) => node.x + node.width / 2))
        const maxRootCenterX = Math.max(...rootNodes.map((node) => node.x + node.width / 2))
        const centerX = (minRootCenterX + maxRootCenterX) / 2
        const centerColumn = centerX / COLUMN_WIDTH
        const rootRow = Math.min(...anchorRootIds.map((rootId) => placementPlan.rowByPersonId.get(rootId) ?? 1))
        const width = Math.max(176, cluster.house.displayName.length * 8 + 42)
        const key = `house:${cluster.house.id}`

        houseAnchorPlacements.set(key, {
          key,
          houseId: cluster.house.id,
          displayName: cluster.house.displayName,
          memberIds: [...cluster.rootIds],
          connectorNodeIds: anchorRootIds.filter((rootId) => !spouseAttachedToOwnerLineageIds.has(rootId)),
          centerColumn,
          rootRow,
          width,
          height: 64,
        })
      }
    }

    clusterCursor += clusterWidth + CLUSTER_GAP_COLUMNS
  }

  for (const personId of orderedPersonIds) {
    if (positionedNodes.has(personId)) {
      continue
    }

    const row = placementPlan.rowByPersonId.get(personId) ?? 1
    positionedNodes.set(personId, createNode(personId, clusterCursor, row))
    clusterCursor += ROOT_GAP_COLUMNS
  }

  reserveFinalProjectionSlots(
    positionedNodes,
    marriagePartnerIdsByPerson,
    projectionPlan,
    finalProjectionSlotsByContext,
  )
  applySinglePassRowDeoverlap(positionedNodes)
  applyProjectedContinuationCorridorSpacing(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
    marriagePartnerIdsByPerson,
  )
  applySingleChildrenToTwoParentMidpoint(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
    visibleParentSlotsByFamily,
    marriagePartnerIdsByPerson,
    projectionPlan,
  )
  applySingleChildrenToTwoParentMidpoint(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
    visibleParentSlotsByFamily,
    marriagePartnerIdsByPerson,
    projectionPlan,
  )
  applyVisibleTwoParentChildBandRecentering(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
    visibleParentSlotsByFamily,
    marriagePartnerIdsByPerson,
    projectionPlan,
  )
  applyTwoChildContinuationSpacing(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
  )
  applySingleParentSingleChildVerticalAlignment(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
  )
  applySameRowSiblingSubtreeCompaction(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
  )
  applyVisibleTwoParentChildBandRecentering(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
    visibleParentSlotsByFamily,
    marriagePartnerIdsByPerson,
    projectionPlan,
  )
  applySameRowCousinBlockSpacing(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
  )
  applyProjectedContinuationCorridorSpacing(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
    marriagePartnerIdsByPerson,
  )
  applyProjectedPartnerRowClearance(
    placementPlan.families,
    validation,
    positionedNodes,
    marriagePartnerIdsByPerson,
  )
  applySingleParentSingleChildVerticalAlignment(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
  )
  applySinglePassRowDeoverlap(positionedNodes)
  alignCanonicalMainPartners(positionedNodes, projectionPlan)
  reserveCanonicalMainPartnerRows(positionedNodes, projectionPlan)
  alignCanonicalMainPartners(positionedNodes, projectionPlan)
  reserveFinalProjectionSlots(
    positionedNodes,
    marriagePartnerIdsByPerson,
    projectionPlan,
    finalProjectionSlotsByContext,
  )

  for (const [anchorKey, placement] of houseAnchorPlacements.entries()) {
    houseAnchorPlacements.set(anchorKey, {
      ...placement,
      connectorNodeIds: placement.connectorNodeIds.filter((nodeId) => !spouseAttachedToOwnerLineageIds.has(nodeId)),
    })
  }

  finalizeFamilyPlacementAxes(familyPlacements, visibleParentSlotsByFamily, positionedNodes, marriagePartnerIdsByPerson, validation, projectionPlan)

  const normalization = normalizeLayout(positionedNodes)
  normalizeVisibleParentSlots(visibleParentSlotsByFamily, normalization.offsetX, normalization.offsetY)
  normalizeFinalProjectionSlots(finalProjectionSlotsByContext, normalization.offsetX, normalization.offsetY)
  r3bArtifactsByNodes.set(normalization.layout.nodes, {
    familyPlacements: [...familyPlacements.values()].sort((left, right) => left.parentRow - right.parentRow || left.key.localeCompare(right.key)),
    houseAnchorPlacements: [...houseAnchorPlacements.values()].sort((left, right) => left.key.localeCompare(right.key)),
    rowByPersonId: placementPlan.rowByPersonId,
    clusterByPersonId: placementPlan.clusterByPersonId,
    visibleParentSlotsByFamily,
    finalProjectionSlotsByContext,
    projectionPlan,
    normalizationOffsetX: normalization.offsetX,
    normalizationOffsetY: normalization.offsetY,
  })

  return normalization.layout
}

export function getModeR3BLayoutArtifacts(layout: LayoutResult): R3BLayoutArtifacts | null {
  return r3bArtifactsByNodes.get(layout.nodes) ?? null
}

export function transferModeR3BLayoutArtifacts(sourceLayout: LayoutResult, targetLayout: LayoutResult): void {
  if (sourceLayout.nodes === targetLayout.nodes) {
    return
  }

  const artifacts = getModeR3BLayoutArtifacts(sourceLayout)
  if (!artifacts) {
    return
  }

  r3bArtifactsByNodes.set(targetLayout.nodes, artifacts)
}

export function completeModeR3BLayoutAfterHouseSubtreeOffsets(
  validation: ValidationResult,
  houseDefinitions: HouseDefinitions,
  layout: LayoutResult,
): LayoutResult {
  const artifacts = getModeR3BLayoutArtifacts(layout)
  if (!artifacts) {
    return layout
  }

  const positionedNodes = new Map<UUID, PositionedNode>()
  for (const node of layout.nodes.values()) {
    positionedNodes.set(node.id, { ...node })
  }

  alignCanonicalMainPartners(positionedNodes, artifacts.projectionPlan)
  applyCanonicalMainPartnerUnitRowDeoverlap(positionedNodes, artifacts.projectionPlan)
  alignSharedStartHouseRootChildAxes(
    validation,
    houseDefinitions,
    positionedNodes,
    artifacts.familyPlacements,
  )

  const marriagePartnerIdsByPerson = buildR3BMarriagePartnerIdsByPerson(
    validation.validOverlayRelations.filter((relation) => relation.type === 'marriage'),
  )
  const familyPlacements = new Map(artifacts.familyPlacements.map((placement) => [placement.key, placement]))
  const visibleParentSlotsByFamily = new Map<string, R3BVisibleParentSlot[]>()

  const finalProjectionSlotsByContext = new Map<string, R3BVisibleParentSlot>()
  reserveFinalProjectionSlots(
    positionedNodes,
    marriagePartnerIdsByPerson,
    artifacts.projectionPlan,
    finalProjectionSlotsByContext,
  )
  finalizeFamilyPlacementAxes(
    familyPlacements,
    visibleParentSlotsByFamily,
    positionedNodes,
    marriagePartnerIdsByPerson,
    validation,
    artifacts.projectionPlan,
  )
  buildFinalProjectionSlots(
    positionedNodes,
    marriagePartnerIdsByPerson,
    artifacts.projectionPlan,
    finalProjectionSlotsByContext,
  )

  const completedLayout = { nodes: positionedNodes }
  r3bArtifactsByNodes.set(positionedNodes, {
    ...artifacts,
    familyPlacements: [...familyPlacements.values()].sort((left, right) => left.parentRow - right.parentRow || left.key.localeCompare(right.key)),
    visibleParentSlotsByFamily,
    finalProjectionSlotsByContext,
  })

  return completedLayout
}

function placePersonBranch({
  personId,
  centerColumn,
  followRulerLine,
  validation,
  placementPlan,
  projectionPlan,
  positionedNodes,
  placedPersons,
  subtreeSpanCache,
  familyPlacements,
  spouseAttachedToOwnerLineageIds,
  spouseAttachedByOwnerId,
  visibleParentSlotsByFamily,
  marriagePartnerIdsByPerson,
}: {
  personId: UUID
  centerColumn: number
  followRulerLine: boolean
  validation: ValidationResult
  placementPlan: R3PlacementPlan
  projectionPlan: R3BProjectionPlan
  positionedNodes: Map<UUID, PositionedNode>
  placedPersons: Set<UUID>
  spouseAttachedToOwnerLineageIds: Set<UUID>
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>
  subtreeSpanCache: Map<UUID, number>
  familyPlacements: Map<string, R3FamilyPlacement>
}): void {
  if (!positionedNodes.has(personId)) {
    const row = placementPlan.rowByPersonId.get(personId) ?? 1
    positionedNodes.set(personId, createNode(personId, centerColumn, row))
  }

  if (placedPersons.has(personId)) {
    return
  }

  placedPersons.add(personId)
  const ownedFamilies = placementPlan.ownedFamiliesByPersonId.get(personId) ?? []
  const familyOffsets = buildR3BFamilyOffsets(ownedFamilies.length)

  ownedFamilies.forEach((family, index) => {
    const ownerFamilyCenter = centerColumn + familyOffsets[index]
    const spouseId = family.parentIds.find((candidateId) => candidateId !== personId) ?? null
    const row = placementPlan.rowByPersonId.get(personId) ?? 1
    const spouseSide = familyOffsets[index] < 0 ? 'left' : 'right'
    const spouseFollowsOwnerLineage = spouseId
      ? shouldAttachSpouseToOwnerLineage(family, spouseId, projectionPlan)
      : false

    if (spouseId && spouseFollowsOwnerLineage) {
      spouseAttachedToOwnerLineageIds.add(spouseId)
      const spouseIds = spouseAttachedByOwnerId.get(personId) ?? new Set<UUID>()
      spouseIds.add(spouseId)
      spouseAttachedByOwnerId.set(personId, spouseIds)
    }

    if (spouseId && spouseFollowsOwnerLineage && !positionedNodes.has(spouseId)) {
      positionedNodes.set(
        spouseId,
        createNode(
          spouseId,
          resolveSpouseColumn(centerColumn, familyOffsets[index]),
          placementPlan.rowByPersonId.get(spouseId) ?? row,
        ),
      )
    }

    const visibleParentSlots = refreshVisibleParentSlots({
      family,
      visibleParentSlotsByFamily,
      positionedNodes,
      marriagePartnerIdsByPerson,
      validation,
      projectionPlan,
    })
    const familyCenter = resolveFamilyAxisColumn({
      family,
      fallbackCenterColumn: ownerFamilyCenter,
      followRulerLine,
      visibleParentSlots,
    })

    const childColumns = buildChildColumns(familyCenter, family, family.childIds, placementPlan, subtreeSpanCache, validation, projectionPlan)
    family.childIds.forEach((childId, childIndex) => {
      placePersonBranch({
        personId: childId,
        centerColumn: childColumns[childIndex],
        followRulerLine,
        validation,
        placementPlan,
        projectionPlan,
        positionedNodes,
        placedPersons,
        spouseAttachedToOwnerLineageIds,
        spouseAttachedByOwnerId,
        visibleParentSlotsByFamily,
        marriagePartnerIdsByPerson,
        subtreeSpanCache,
        familyPlacements,
      })
    })

    const childRows = family.childIds.map((childId) => placementPlan.rowByPersonId.get(childId) ?? (row + 1))
    familyPlacements.set(family.key, {
      key: family.key,
      parentIds: family.parentIds,
      childIds: family.childIds,
      axisColumn: familyCenter,
      parentRow: row,
      childRow: childRows.length > 0 ? Math.min(...childRows) : row + 1,
    })
    refreshVisibleParentSlots({
      family,
      visibleParentSlotsByFamily,
      positionedNodes,
      marriagePartnerIdsByPerson,
      validation,
      projectionPlan,
    })

    if (spouseId && spouseFollowsOwnerLineage && positionedNodes.has(spouseId)) {
      positionCoupleAroundFamilyAxis({ ownerId: personId, spouseId, familyCenter, row, spouseSide, positionedNodes })
    }
  })

  for (const partnerId of projectionPlan.canonicalMainPartnerIdsByOwnerId.get(personId) ?? []) {
    const attachedSpouseIds = spouseAttachedByOwnerId.get(personId) ?? new Set<UUID>()
    if (attachedSpouseIds.has(partnerId)) {
      continue
    }

    spouseAttachedToOwnerLineageIds.add(partnerId)
    attachedSpouseIds.add(partnerId)
    spouseAttachedByOwnerId.set(personId, attachedSpouseIds)
    const row = placementPlan.rowByPersonId.get(personId) ?? 1
    const side = projectionPlan.canonicalMainPartnerSidesByOwnerId.get(personId)?.get(partnerId) ?? 'right'
    positionedNodes.set(partnerId, createNode(
      partnerId,
      resolveSpouseColumn(centerColumn, side === 'left' ? -1 : 0),
      placementPlan.rowByPersonId.get(partnerId) ?? row,
    ))
  }

  for (const childId of validation.childrenByParent.get(personId) ?? []) {
    if (isChildAssignedToDifferentFamilyOwner(personId, childId, placementPlan.families)) {
      continue
    }

    if (positionedNodes.has(childId)) {
      continue
    }

    placePersonBranch({
      personId: childId,
      centerColumn,
      followRulerLine,
      validation,
      placementPlan,
      projectionPlan,
      positionedNodes,
      placedPersons,
      spouseAttachedToOwnerLineageIds,
      spouseAttachedByOwnerId,
      visibleParentSlotsByFamily,
      marriagePartnerIdsByPerson,
      subtreeSpanCache,
      familyPlacements,
    })
  }
}

function isChildAssignedToDifferentFamilyOwner(parentId: UUID, childId: UUID, families: R3FamilyGroup[]): boolean {
  return families.some((family) => (
    family.ownerId !== parentId
    && family.parentIds.includes(parentId)
    && family.childIds.includes(childId)
  ))
}

function buildPlacementPlan({
  validation,
  houseDefinitions,
  orderedPersonIds,
  biologicalFamilies,
  houseLookup,
}: {
  validation: ValidationResult
  houseDefinitions: HouseDefinitions
  orderedPersonIds: UUID[]
  biologicalFamilies: R3FamilyGroup[]
  houseLookup: HouseLookup
}): R3PlacementPlan {
  const rowByPersonId = buildGenerationRows({ validation, orderedPersonIds, houseDefinitions, houseLookup })
  const clusterByPersonId = buildClusterAssignments({ validation, orderedPersonIds, houseLookup })
  const ownedFamiliesByPersonId = new Map<UUID, R3FamilyGroup[]>()
  const normalizedFamilies = biologicalFamilies.map((family) => {
    const normalizedOwnerId = resolveAnchoredFamilyOwnerId({ family, validation })
    return normalizedOwnerId === family.ownerId ? family : { ...family, ownerId: normalizedOwnerId }
  })

  for (const family of normalizedFamilies) {
    const ownerFamilies = ownedFamiliesByPersonId.get(family.ownerId) ?? []
    ownerFamilies.push(family)
    ownerFamilies.sort((left, right) => compareFamilyGroups(left, right, validation.personById))
    ownedFamiliesByPersonId.set(family.ownerId, ownerFamilies)
  }

  return {
    rowByPersonId,
    clusterByPersonId,
    ownedFamiliesByPersonId,
    families: normalizedFamilies,
  }
}

function resolveAnchoredFamilyOwnerId({
  family,
  validation,
}: {
  family: R3FamilyGroup
  validation: ValidationResult
}): UUID {
  if (family.parentIds.length !== 2) {
    return family.ownerId
  }

  const [leftParentId, rightParentId] = family.parentIds
  const leftHasBiologicalParents = (validation.parentsByChild.get(leftParentId) ?? []).length > 0
  const rightHasBiologicalParents = (validation.parentsByChild.get(rightParentId) ?? []).length > 0

  if (leftHasBiologicalParents !== rightHasBiologicalParents) {
    return leftHasBiologicalParents ? leftParentId : rightParentId
  }

  return family.ownerId
}

function getClusterWidth(
  rootIds: UUID[],
  placementPlan: R3PlacementPlan,
  subtreeSpanCache: Map<UUID, number>,
  validation: ValidationResult,
  projectionPlan: R3BProjectionPlan,
): number {
  return rootIds.reduce((sum, rootId, index) => {
    const rootWidth = getPersonSubtreeSpan(rootId, placementPlan, subtreeSpanCache, validation, projectionPlan)
    return sum + rootWidth + (index === rootIds.length - 1 ? 0 : ROOT_GAP_COLUMNS)
  }, 0)
}

function getPersonSubtreeSpan(
  personId: UUID,
  placementPlan: R3PlacementPlan,
  subtreeSpanCache: Map<UUID, number>,
  validation?: ValidationResult,
  projectionPlan?: R3BProjectionPlan,
): number {
  const cached = subtreeSpanCache.get(personId)
  if (cached !== undefined) {
    return cached
  }

  const ownedFamilies = placementPlan.ownedFamiliesByPersonId.get(personId) ?? []
  const companionFamilies = validation
    ? placementPlan.families.filter((family) => (
        family.parentIds.length === 2
        && family.ownerId !== personId
        && family.parentIds.includes(personId)
        && family.childIds.length > 0
        && shouldUseProjectedChildAxis(family, validation)
      ))
    : []

  const relevantFamilies = [...ownedFamilies, ...companionFamilies]
    const familySpan = relevantFamilies.length > 0
      ? Math.max(...relevantFamilies.map((family) => getFamilySpan(family, placementPlan, subtreeSpanCache, validation, projectionPlan)))
      : 1
    const canonicalPartnerCount = projectionPlan?.canonicalMainPartnerIdsByOwnerId.get(personId)?.length ?? 0
    const span = Math.max(familySpan, canonicalPartnerCount + 1)
  subtreeSpanCache.set(personId, span)
  return span
}

function getFamilySpan(
  family: R3FamilyGroup,
  placementPlan: R3PlacementPlan,
  subtreeSpanCache: Map<UUID, number>,
  validation?: ValidationResult,
  projectionPlan?: R3BProjectionPlan,
): number {
  const childSpan = family.childIds.reduce((sum, childId, index) => {
    const subtreeSpan = getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache, validation, projectionPlan)
    const next = sum + resolveChildPlacementSpan(subtreeSpan, family)
    return next + (index === family.childIds.length - 1 ? 0 : CHILD_GAP_COLUMNS)
  }, 0)
  const pairSpan = family.parentIds.length === 2
    ? shouldReserveProjectedPairSpan(family, placementPlan.families, projectionPlan)
      ? PROJECTED_VISIBLE_PAIR_SPAN_COLUMNS
      : Math.max(2, SPOUSE_STEP_COLUMNS + 1)
    : 1
  return Math.max(pairSpan, childSpan || 1)
}

function shouldReserveProjectedPairSpan(
  family: R3FamilyGroup,
  families: R3FamilyGroup[],
  projectionPlan: R3BProjectionPlan | undefined,
): boolean {
  const plannedSlot = projectionPlan?.visiblePartnerSlotsByFamily.get(family.key)
  if (plannedSlot) {
    return plannedSlot.companionKind === 'projection'
  }

  if (family.parentIds.length !== 2) {
    return false
  }

  const companionId = family.parentIds.find((parentId) => parentId !== family.ownerId) ?? null
  if (!companionId) {
    return false
  }

  return hasBiologicalChildren(family.ownerId, families) && hasBiologicalChildren(companionId, families)
}

function buildChildColumns(
  familyCenter: number,
  family: R3FamilyGroup,
  childIds: UUID[],
  placementPlan: R3PlacementPlan,
  subtreeSpanCache: Map<UUID, number>,
  validation: ValidationResult,
  projectionPlan: R3BProjectionPlan,
): number[] {
  if (family.parentIds.length === 2 && childIds.length === 2) {
    const rawSpans = childIds.map((childId) => getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache, validation, projectionPlan))
    const effectiveSpans = rawSpans.map((rawSpan) => resolveChildPlacementSpan(rawSpan, family))
    const continuationCompanionFlags = childIds.map((childId) => isNonOwnerMarriageParentWithChildren(childId, placementPlan.families))
    const continuationCompanionCount = continuationCompanionFlags.filter(Boolean).length
    if (continuationCompanionCount === 1) {
      const centeredIndex = continuationCompanionFlags[0] ? 1 : 0
      const offsetIndex = centeredIndex === 0 ? 1 : 0
      const centeredSpan = effectiveSpans[centeredIndex]
      const offsetSpan = effectiveSpans[offsetIndex]
      const columns: number[] = [familyCenter, familyCenter]
      const centerDistance = (centeredSpan + offsetSpan) / 2 + CHILD_GAP_COLUMNS
      const offsetToRight = offsetIndex > centeredIndex
      columns[offsetIndex] = familyCenter + (offsetToRight ? centerDistance : -centerDistance)
      return columns
    }

    const lightIndex = effectiveSpans[0] <= effectiveSpans[1] ? 0 : 1
    const heavyIndex = lightIndex === 0 ? 1 : 0
    const lightSpan = effectiveSpans[lightIndex]
    const heavySpan = effectiveSpans[heavyIndex]
    const lightChildId = childIds[lightIndex]
    const lightChildHasContinuation = hasBiologicalChildren(lightChildId, placementPlan.families)

    if (
      !lightChildHasContinuation
      &&
      lightSpan <= TWO_CHILD_LIGHT_BRANCH_MAX_SPAN
      && heavySpan >= lightSpan * TWO_CHILD_HEAVY_BRANCH_RATIO_THRESHOLD
    ) {
      const columns: number[] = [familyCenter, familyCenter]
      const centerDistance = (lightSpan + heavySpan) / 2 + CHILD_GAP_COLUMNS
      const lightIsLeft = lightIndex < heavyIndex
      columns[heavyIndex] = familyCenter + (lightIsLeft ? centerDistance : -centerDistance)
      return columns
    }
  }

  const profiles = childIds.map((childId) => resolveChildPlacementProfile(childId, family, placementPlan, subtreeSpanCache, validation, projectionPlan))
  const totalWidth = profiles.reduce((sum, profile, index) => {
    const next = sum + profile.leftExtent + profile.rightExtent
    return next + (index === profiles.length - 1 ? 0 : CHILD_GAP_COLUMNS + profile.trailingGap)
  }, 0)
  const columns: number[] = []
  let cursor = familyCenter - totalWidth / 2

  for (const profile of profiles) {
    columns.push(cursor + profile.leftExtent)
    cursor += profile.leftExtent + profile.rightExtent + CHILD_GAP_COLUMNS + profile.trailingGap
  }

  return columns
}

function resolveChildPlacementProfile(
  childId: UUID,
  family: R3FamilyGroup,
  placementPlan: R3PlacementPlan,
  subtreeSpanCache: Map<UUID, number>,
  validation: ValidationResult,
  projectionPlan: R3BProjectionPlan,
): { childId: UUID; leftExtent: number; rightExtent: number; trailingGap: number } {
  const subtreeSpan = getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache, validation, projectionPlan)
  const width = resolveChildPlacementSpan(subtreeSpan, family)

  if (hasProjectedCompanionFamilyInSubtree(childId, placementPlan.families, validation) && width > 1) {
    return {
      childId,
      leftExtent: 0.5,
      rightExtent: Math.max(width - 0.5, 0.5),
      trailingGap: 1,
    }
  }

  return {
    childId,
    leftExtent: width / 2,
    rightExtent: width / 2,
    trailingGap: 0,
  }
}

function hasProjectedCompanionFamily(personId: UUID, families: R3FamilyGroup[], validation: ValidationResult): boolean {
  return families.some((family) => (
    family.parentIds.length === 2
    && family.ownerId !== personId
    && family.parentIds.includes(personId)
    && family.childIds.length > 0
    && shouldUseProjectedChildAxis(family, validation)
  ))
}

function hasProjectedCompanionFamilyInSubtree(personId: UUID, families: R3FamilyGroup[], validation: ValidationResult): boolean {
  if (hasProjectedCompanionFamily(personId, families, validation)) {
    return true
  }

  const queue: UUID[] = [...(validation.childrenByParent.get(personId) ?? [])]
  const visited = new Set<UUID>()

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId || visited.has(currentId)) {
      continue
    }

    visited.add(currentId)
    if (hasProjectedCompanionFamily(currentId, families, validation)) {
      return true
    }

    for (const childId of validation.childrenByParent.get(currentId) ?? []) {
      queue.push(childId)
    }
  }

  return false
}

function isNonOwnerMarriageParentWithChildren(personId: UUID, families: R3FamilyGroup[]): boolean {
  return families.some((family) => (
    family.parentIds.length === 2
    && family.ownerId !== personId
    && family.parentIds.includes(personId)
    && family.childIds.length > 0
  ))
}

function hasBiologicalChildren(personId: UUID, families: R3FamilyGroup[]): boolean {
  return families.some((family) => family.parentIds.includes(personId) && family.childIds.length > 0)
}

function resolveChildPlacementSpan(subtreeSpan: number, family: R3FamilyGroup): number {
  if (family.childIds.length <= 1) {
    return subtreeSpan
  }

  if (family.childIds.length === 2) {
    const compression = family.parentIds.length === 1
      ? SINGLE_PARENT_TWO_CHILD_SPAN_COMPRESSION
      : TWO_CHILD_SPAN_COMPRESSION
    return 1 + (subtreeSpan - 1) * compression
  }

  const compression = family.parentIds.length === 1
    ? SINGLE_PARENT_MULTI_SIBLING_SPAN_COMPRESSION
    : MULTI_SIBLING_SPAN_COMPRESSION

  return 1 + (subtreeSpan - 1) * compression
}

function resolveHouseAnchorRootIds({
  rootIds,
  houseTier,
  placementPlan,
  validation,
}: {
  rootIds: UUID[]
  houseTier: 'start' | 'later'
  placementPlan: R3PlacementPlan
  validation: ValidationResult
}): UUID[] {
  if (rootIds.length <= 1 || houseTier !== 'start') {
    return [...rootIds]
  }

  const topRow = Math.min(...rootIds.map((rootId) => placementPlan.rowByPersonId.get(rootId) ?? 1))
  const founderIds = rootIds
    .filter((rootId) => (placementPlan.rowByPersonId.get(rootId) ?? 1) === topRow)
    .sort((left, right) => left.localeCompare(right))

  if (founderIds.length <= 1) {
    return founderIds.length === 1 ? founderIds : [...rootIds]
  }

  const marriages = validation.validOverlayRelations.filter((relation) => relation.type === 'marriage')
  for (const relation of marriages) {
    if (founderIds.includes(relation.from) && founderIds.includes(relation.to)) {
      return [relation.from, relation.to].sort((left, right) => left.localeCompare(right))
    }
  }

  return founderIds
}

function collectShiftNodeIds(
  rootId: UUID,
  childrenByParent: Map<UUID, UUID[]>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
  families?: R3FamilyGroup[],
): Set<UUID> {
  const visited = new Set<UUID>()
  const queue: UUID[] = [rootId]

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId || visited.has(currentId)) {
      continue
    }

    visited.add(currentId)
    for (const spouseId of spouseAttachedByOwnerId.get(currentId) ?? []) {
      if (!visited.has(spouseId)) {
        queue.push(spouseId)
      }
    }

    for (const childId of childrenByParent.get(currentId) ?? []) {
      if (families && isChildAssignedToDifferentFamilyOwner(currentId, childId, families)) {
        continue
      }

      if (!visited.has(childId)) {
        queue.push(childId)
      }
    }
  }

  return visited
}

function applySingleChildrenToTwoParentMidpoint(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
  projectionPlan: R3BProjectionPlan,
): void {
  for (const family of families) {
    if (family.parentIds.length !== 2 || family.childIds.length !== 1) {
      continue
    }

    const childId = family.childIds[0]
    const childNode = positionedNodes.get(childId)

    if (!childNode) {
      continue
    }

    const parentMidX = resolveVisibleFamilyMidX(refreshVisibleParentSlots({
      family,
      visibleParentSlotsByFamily,
      positionedNodes,
      marriagePartnerIdsByPerson,
      validation,
      projectionPlan,
    }))

    const childCenterX = childNode.x + childNode.width / 2
    const shiftX = parentMidX - childCenterX
    if (Math.abs(shiftX) < 1) {
      continue
    }

    const shiftNodeIds = collectShiftNodeIds(childId, validation.childrenByParent, spouseAttachedByOwnerId, families)
    for (const shiftNodeId of shiftNodeIds) {
      const node = positionedNodes.get(shiftNodeId)
      if (!node) {
        continue
      }

      positionedNodes.set(shiftNodeId, {
        ...node,
        x: node.x + shiftX,
      })
    }
  }
}

function applySingleParentSingleChildVerticalAlignment(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
): void {
  for (const family of families) {
    if (family.parentIds.length !== 1 || family.childIds.length !== 1) {
      continue
    }

    if (isProjectedCompanionInVisibleFamily(family.childIds[0], families, validation)) {
      continue
    }

    const parentNode = positionedNodes.get(family.parentIds[0])
    const childNode = positionedNodes.get(family.childIds[0])
    if (!parentNode || !childNode) {
      continue
    }

    const shiftX = parentNode.x + parentNode.width / 2 - (childNode.x + childNode.width / 2)
    if (Math.abs(shiftX) < 1) {
      continue
    }

    const shiftNodeIds = collectShiftNodeIds(family.childIds[0], validation.childrenByParent, spouseAttachedByOwnerId, families)
    for (const shiftNodeId of shiftNodeIds) {
      const node = positionedNodes.get(shiftNodeId)
      if (!node) {
        continue
      }

      positionedNodes.set(shiftNodeId, {
        ...node,
        x: node.x + shiftX,
      })
    }
  }
}

function isProjectedCompanionInVisibleFamily(
  personId: UUID,
  families: R3FamilyGroup[],
  validation: ValidationResult,
): boolean {
  return families.some((family) => (
    family.parentIds.length === 2
    && family.ownerId !== personId
    && family.parentIds.includes(personId)
    && shouldUseProjectedChildAxis(family, validation)
  ))
}

function applyVisibleTwoParentChildBandRecentering(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
  projectionPlan: R3BProjectionPlan,
): void {
  for (const family of families) {
    if (family.parentIds.length !== 2 || family.childIds.length < 2) {
      continue
    }

    const childNodes = family.childIds
      .map((childId) => positionedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)
    if (childNodes.length === 0) {
      continue
    }

    const targetMidX = resolveVisibleFamilyMidX(refreshVisibleParentSlots({
      family,
      visibleParentSlotsByFamily,
      positionedNodes,
      marriagePartnerIdsByPerson,
      validation,
      projectionPlan,
    }))
    const childCenters = childNodes.map((node) => node.x + node.width / 2)
    const currentMidX = childCenters.length === 1
      ? childCenters[0]
      : (Math.min(...childCenters) + Math.max(...childCenters)) / 2
    const shiftX = targetMidX - currentMidX
    if (Math.abs(shiftX) < 1) {
      continue
    }

    const shiftNodeIds = new Set<UUID>()
    for (const childId of family.childIds) {
      for (const shiftNodeId of collectShiftNodeIds(childId, validation.childrenByParent, spouseAttachedByOwnerId, families)) {
        shiftNodeIds.add(shiftNodeId)
      }
    }

    for (const shiftNodeId of shiftNodeIds) {
      const node = positionedNodes.get(shiftNodeId)
      if (!node) {
        continue
      }

      positionedNodes.set(shiftNodeId, {
        ...node,
        x: node.x + shiftX,
      })
    }
  }
}

function applyTwoChildContinuationSpacing(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
): void {
  for (const family of families) {
    if (family.parentIds.length !== 2 || family.childIds.length !== 2) {
      continue
    }

    const childNodes = family.childIds
      .map((childId) => positionedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)
      .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
    if (childNodes.length !== 2) {
      continue
    }

    const continuationCount = family.childIds.filter((childId) => hasBiologicalChildren(childId, families)).length
    if (continuationCount === 0) {
      continue
    }

    const currentDistance = (childNodes[1].x + childNodes[1].width / 2) - (childNodes[0].x + childNodes[0].width / 2)
    if (currentDistance >= TWO_CHILD_CONTINUATION_MIN_CENTER_DISTANCE) {
      continue
    }

    const halfShift = (TWO_CHILD_CONTINUATION_MIN_CENTER_DISTANCE - currentDistance) / 2
    const leftShiftIds = collectShiftNodeIds(childNodes[0].id, validation.childrenByParent, spouseAttachedByOwnerId, families)
    const rightShiftIds = collectShiftNodeIds(childNodes[1].id, validation.childrenByParent, spouseAttachedByOwnerId, families)

    for (const shiftNodeId of leftShiftIds) {
      const node = positionedNodes.get(shiftNodeId)
      if (!node) {
        continue
      }

      positionedNodes.set(shiftNodeId, {
        ...node,
        x: node.x - halfShift,
      })
    }

    for (const shiftNodeId of rightShiftIds) {
      const node = positionedNodes.get(shiftNodeId)
      if (!node) {
        continue
      }

      positionedNodes.set(shiftNodeId, {
        ...node,
        x: node.x + halfShift,
      })
    }
  }
}

function applySameRowCousinBlockSpacing(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
): void {
  for (let iteration = 0; iteration < 4; iteration += 1) {
    let changed = false
    const blocksByRow = buildSameRowCousinBlocks(families, validation, positionedNodes)

    for (const blocks of blocksByRow.values()) {
      blocks.sort((left, right) => left.centerX - right.centerX || left.family.key.localeCompare(right.family.key))

      for (let index = 1; index < blocks.length; index += 1) {
        const left = blocks[index - 1]
        const right = blocks[index]

        if (!shouldSeparateSameRowCousinBlocks(left.family, right.family, validation)) {
          continue
        }

        const shiftX = left.maxRight + COUSIN_GROUP_MIN_GAP - right.minX
        if (shiftX <= 0) {
          continue
        }

        const shiftNodeIds = collectShiftNodeIds(right.family.ownerId, validation.childrenByParent, spouseAttachedByOwnerId, families)
        for (const shiftNodeId of shiftNodeIds) {
          const node = positionedNodes.get(shiftNodeId)
          if (!node) {
            continue
          }

          positionedNodes.set(shiftNodeId, {
            ...node,
            x: node.x + shiftX,
          })
        }

        right.minX += shiftX
        right.maxRight += shiftX
        right.minCenterX += shiftX
        right.maxCenterX += shiftX
        right.centerX += shiftX
        changed = true
      }
    }

    if (!changed) {
      return
    }
  }
}

function applySameRowSiblingSubtreeCompaction(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
): void {
  for (const family of families) {
    if (family.childIds.length < 2) {
      continue
    }

    const childNodes = family.childIds
      .map((childId) => positionedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)
      .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
    if (childNodes.length !== family.childIds.length) {
      continue
    }

    const minY = Math.min(...childNodes.map((node) => node.y))
    const maxY = Math.max(...childNodes.map((node) => node.y))
    if (maxY - minY > 1) {
      continue
    }

    let previousBounds = collectSubtreeBounds(
      collectShiftNodeIds(childNodes[0].id, validation.childrenByParent, spouseAttachedByOwnerId, families),
      positionedNodes,
    )

    for (let index = 1; index < childNodes.length; index += 1) {
      const currentChildId = childNodes[index].id
      const shiftNodeIds = collectShiftNodeIds(currentChildId, validation.childrenByParent, spouseAttachedByOwnerId, families)
      const currentBounds = collectSubtreeBounds(shiftNodeIds, positionedNodes)
      const shiftX = previousBounds.maxRight + SIBLING_GROUP_TARGET_GAP - currentBounds.minX

      if (shiftX < -1) {
        for (const shiftNodeId of shiftNodeIds) {
          const node = positionedNodes.get(shiftNodeId)
          if (!node) {
            continue
          }

          positionedNodes.set(shiftNodeId, {
            ...node,
            x: node.x + shiftX,
          })
        }

        currentBounds.minX += shiftX
        currentBounds.maxRight += shiftX
      }

      previousBounds = currentBounds
    }
  }
}

function buildSameRowCousinBlocks(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
): Map<number, Array<{
  family: R3FamilyGroup
  minX: number
  maxRight: number
  minCenterX: number
  maxCenterX: number
  centerX: number
}>> {
  const blocksByRow = new Map<number, Array<{
    family: R3FamilyGroup
    minX: number
    maxRight: number
    minCenterX: number
    maxCenterX: number
    centerX: number
  }>>()

  for (const family of families) {
    if (family.childIds.length < 2) {
      continue
    }

    const ownerParents = validation.parentsByChild.get(family.ownerId) ?? []
    if (ownerParents.length === 0) {
      continue
    }

    const childNodes = family.childIds
      .map((childId) => positionedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (childNodes.length !== family.childIds.length) {
      continue
    }

    const minY = Math.min(...childNodes.map((node) => node.y))
    const maxY = Math.max(...childNodes.map((node) => node.y))
    if (maxY - minY > 1) {
      continue
    }

    const centers = childNodes
      .map((node) => node.x + node.width / 2)
      .sort((left, right) => left - right)
    const block = {
      family,
      minX: Math.min(...childNodes.map((node) => node.x)),
      maxRight: Math.max(...childNodes.map((node) => node.x + node.width)),
      minCenterX: centers[0],
      maxCenterX: centers[centers.length - 1],
      centerX: (centers[0] + centers[centers.length - 1]) / 2,
    }
    const rowBlocks = blocksByRow.get(minY) ?? []
    rowBlocks.push(block)
    blocksByRow.set(minY, rowBlocks)
  }

  return blocksByRow
}

function collectSubtreeBounds(
  nodeIds: Set<UUID>,
  positionedNodes: Map<UUID, PositionedNode>,
): { minX: number; maxRight: number } {
  const nodes = [...nodeIds]
    .map((nodeId) => positionedNodes.get(nodeId))
    .filter((node): node is PositionedNode => node !== undefined)

  return {
    minX: Math.min(...nodes.map((node) => node.x)),
    maxRight: Math.max(...nodes.map((node) => node.x + node.width)),
  }
}

function shouldSeparateSameRowCousinBlocks(
  left: R3FamilyGroup,
  right: R3FamilyGroup,
  validation: ValidationResult,
): boolean {
  if (left.ownerId === right.ownerId) {
    return false
  }

  const leftOwnerParents = validation.parentsByChild.get(left.ownerId) ?? []
  const rightOwnerParents = validation.parentsByChild.get(right.ownerId) ?? []
  if (leftOwnerParents.length === 0 || rightOwnerParents.length === 0) {
    return false
  }

  return leftOwnerParents.some((parentId) => rightOwnerParents.includes(parentId))
}

function applyProjectedContinuationCorridorSpacing(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
): void {
  for (let iteration = 0; iteration < 4; iteration += 1) {
    let changed = false
    const reservations = families
      .filter((family) => family.parentIds.length === 2)
      .filter((family) => shouldUseProjectedChildAxis(family, validation))
      .flatMap((family) => {
        const partnerId = family.parentIds.find((parentId) => parentId !== family.ownerId) ?? null
        if (!partnerId) {
          return []
        }

        const ownerNode = positionedNodes.get(family.ownerId)
        const partnerNode = positionedNodes.get(partnerId)
        if (!ownerNode || !partnerNode) {
          return []
        }

        const continuationGeometry = buildR3BProjectionGeometry({
          ownerId: partnerId,
          companionId: family.ownerId,
          ownerNode: partnerNode,
          companionNode: ownerNode,
          partnerIdsByPerson: marriagePartnerIdsByPerson,
          nodesById: positionedNodes,
        })

        return [{
          family,
          anchorId: partnerId,
          geometry: continuationGeometry,
        }]
      })
      .filter((entry) => entry.geometry.side === 'right')
      .sort((left, right) => left.geometry.x - right.geometry.x || left.anchorId.localeCompare(right.anchorId))

    for (const reservation of reservations) {
      const { family, anchorId, geometry } = reservation
      const anchorNode = positionedNodes.get(anchorId)
      if (!anchorNode) {
        continue
      }

      const projectionRight = geometry.x + geometry.width + ROW_DEOVERLAP_MIN_GAP
      const rowNodes = [...positionedNodes.values()]
        .filter((node) => Math.abs(node.y - anchorNode.y) < 1)
        .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))

      for (const node of rowNodes) {
        if (family.parentIds.includes(node.id) || node.id === anchorId) {
          continue
        }

        if (node.x >= projectionRight || node.x <= anchorNode.x) {
          continue
        }

        const shiftX = projectionRight - node.x
        if (shiftX <= 0) {
          continue
        }

        const shiftNodeIds = collectShiftNodeIds(node.id, validation.childrenByParent, spouseAttachedByOwnerId, families)
        for (const shiftNodeId of shiftNodeIds) {
          const shiftedNode = positionedNodes.get(shiftNodeId)
          if (!shiftedNode) {
            continue
          }

          positionedNodes.set(shiftNodeId, {
            ...shiftedNode,
            x: shiftedNode.x + shiftX,
          })
        }

        changed = true
      }
    }

    if (!changed) {
      return
    }
  }
}

function applyProjectedPartnerRowClearance(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
): void {
  const familyReservations = families
    .filter((family) => family.parentIds.length === 2)
    .flatMap((family) => {
      const partnerId = family.parentIds.find((parentId) => parentId !== family.ownerId) ?? null
      if (!partnerId) {
        return []
      }

      const ownerNode = positionedNodes.get(family.ownerId)
      const partnerNode = positionedNodes.get(partnerId)
      if (!ownerNode || !partnerNode) {
        return []
      }

      if (shouldUseProjectedChildAxis(family, validation)) {
        const geometry = buildR3BProjectionGeometry({
          ownerId: partnerId,
          companionId: family.ownerId,
          ownerNode: partnerNode,
          companionNode: ownerNode,
          partnerIdsByPerson: marriagePartnerIdsByPerson,
          nodesById: positionedNodes,
        })

        return geometry.side === 'right'
          ? [{ family, anchorNode: partnerNode, projectionRight: geometry.x + geometry.width + ROW_DEOVERLAP_MIN_GAP }]
          : []
      }

      return []
    })
  const singleAnchoredMarriageReservations = validation.validOverlayRelations
    .filter((relation) => relation.type === 'marriage')
    .flatMap((relation) => {
      const fromParentCount = (validation.parentsByChild.get(relation.from) ?? []).length
      const toParentCount = (validation.parentsByChild.get(relation.to) ?? []).length
      if ((fromParentCount === 0) === (toParentCount === 0)) {
        return []
      }

      const anchorId = fromParentCount > 0 ? relation.from : relation.to
      const companionId = anchorId === relation.from ? relation.to : relation.from
      const anchorNode = positionedNodes.get(anchorId)
      const companionNode = positionedNodes.get(companionId) ?? null
      if (!anchorNode) {
        return []
      }

      const geometry = buildR3BProjectionGeometry({
        ownerId: anchorId,
        companionId,
        ownerNode: anchorNode,
        companionNode,
        partnerIdsByPerson: marriagePartnerIdsByPerson,
        nodesById: positionedNodes,
      })

      return geometry.side === 'right'
        ? [{
            family: {
              key: `marriage:${relation.id}`,
              parentIds: [relation.from, relation.to],
              childIds: [],
              ownerId: anchorId,
              marriage: relation,
            },
            anchorNode,
            projectionRight: geometry.x + geometry.width + ROW_DEOVERLAP_MIN_GAP,
          }]
        : []
    })
  const reservations = [...familyReservations, ...singleAnchoredMarriageReservations]
    .sort((left, right) => left.anchorNode.x - right.anchorNode.x || left.family.key.localeCompare(right.family.key))

  for (const reservation of reservations) {
    const rowNodes = [...positionedNodes.values()]
      .filter((node) => Math.abs(node.y - reservation.anchorNode.y) < 1)
      .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))

    for (const node of rowNodes) {
      if (reservation.family.parentIds.includes(node.id)) {
        continue
      }

      if (node.x <= reservation.anchorNode.x || node.x >= reservation.projectionRight) {
        continue
      }

      const shiftX = reservation.projectionRight - node.x
      if (shiftX <= 0) {
        continue
      }

      const shiftRootId = resolveProjectedRowClearanceShiftRoot(node.id, validation)
      const shiftNodeIds = collectShiftNodeIds(shiftRootId, validation.childrenByParent, new Map<UUID, Set<UUID>>(), families)

      for (const shiftNodeId of shiftNodeIds) {
        const shiftedNode = positionedNodes.get(shiftNodeId)
        if (!shiftedNode) {
          continue
        }

        positionedNodes.set(shiftNodeId, {
          ...shiftedNode,
          x: shiftedNode.x + shiftX,
        })
      }
    }
  }
}

function resolveProjectedRowClearanceShiftRoot(personId: UUID, validation: ValidationResult): UUID {
  const parentIds = validation.parentsByChild.get(personId) ?? []
  if (parentIds.length !== 1) {
    return personId
  }

  const hasMarriage = validation.validOverlayRelations.some((relation) => (
    relation.type === 'marriage'
    && (relation.from === personId || relation.to === personId)
  ))
  if (hasMarriage) {
    return personId
  }

  const parentId = parentIds[0]
  return parentId
}

function applySinglePassRowDeoverlap(positionedNodes: Map<UUID, PositionedNode>): void {
  const rowBuckets = new Map<number, PositionedNode[]>()

  for (const node of positionedNodes.values()) {
    const bucket = rowBuckets.get(node.y) ?? []
    bucket.push(node)
    rowBuckets.set(node.y, bucket)
  }

  for (const nodes of rowBuckets.values()) {
    nodes.sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))

    for (let index = 1; index < nodes.length; index += 1) {
      const previous = nodes[index - 1]
      const current = nodes[index]
      const minX = previous.x + previous.width + ROW_DEOVERLAP_MIN_GAP

      if (current.x >= minX) {
        continue
      }

      current.x = minX
      positionedNodes.set(current.id, current)
    }
  }
}

function applyCanonicalMainPartnerUnitRowDeoverlap(
  positionedNodes: Map<UUID, PositionedNode>,
  projectionPlan: R3BProjectionPlan,
): void {
  const canonicalOwnerIdByMemberId = new Map<UUID, UUID>()
  for (const [ownerId, partnerIds] of projectionPlan.canonicalMainPartnerIdsByOwnerId) {
    canonicalOwnerIdByMemberId.set(ownerId, ownerId)
    for (const partnerId of partnerIds) {
      canonicalOwnerIdByMemberId.set(partnerId, ownerId)
    }
  }

  const rowBuckets = new Map<number, PositionedNode[]>()
  for (const node of positionedNodes.values()) {
    const bucket = rowBuckets.get(node.y) ?? []
    bucket.push(node)
    rowBuckets.set(node.y, bucket)
  }

  for (const rowNodes of rowBuckets.values()) {
    const unitNodesById = new Map<string, PositionedNode[]>()
    for (const node of rowNodes) {
      const canonicalOwnerId = canonicalOwnerIdByMemberId.get(node.id)
      const unitId = canonicalOwnerId && positionedNodes.get(canonicalOwnerId)?.y === node.y
        ? `partner:${canonicalOwnerId}`
        : `node:${node.id}`
      const unitNodes = unitNodesById.get(unitId) ?? []
      unitNodes.push(node)
      unitNodesById.set(unitId, unitNodes)
    }

    const units = [...unitNodesById.entries()]
      .map(([id, nodes]) => ({
        id,
        nodes,
        minX: Math.min(...nodes.map((node) => node.x)),
        maxX: Math.max(...nodes.map((node) => node.x + node.width)),
      }))
      .sort((left, right) => left.minX - right.minX || left.id.localeCompare(right.id))

    let nextMinX = Number.NEGATIVE_INFINITY
    for (const unit of units) {
      const shiftX = Number.isFinite(nextMinX) ? Math.max(0, nextMinX - unit.minX) : 0
      if (shiftX > 0) {
        for (const node of unit.nodes) {
          node.x += shiftX
          positionedNodes.set(node.id, node)
        }
      }

      nextMinX = unit.maxX + shiftX + ROW_DEOVERLAP_MIN_GAP
    }
  }
}

function alignSharedStartHouseRootChildAxes(
  validation: ValidationResult,
  houseDefinitions: HouseDefinitions,
  positionedNodes: Map<UUID, PositionedNode>,
  familyPlacements: R3FamilyPlacement[],
): void {
  const houseLookup = createHouseLookup(houseDefinitions, validation.personById)

  for (const family of familyPlacements) {
    if (family.parentIds.length !== 2 || family.childIds.length === 0) {
      continue
    }

    const [firstParentId, secondParentId] = family.parentIds
    if ((validation.parentsByChild.get(firstParentId) ?? []).length !== 0
      || (validation.parentsByChild.get(secondParentId) ?? []).length !== 0) {
      continue
    }

    const firstStartHouse = houseLookup.getPrimaryStartHouse(firstParentId)
    const secondStartHouse = houseLookup.getPrimaryStartHouse(secondParentId)
    if (!firstStartHouse || firstStartHouse.id !== secondStartHouse?.id) {
      continue
    }

    const parentNodes = family.parentIds
      .map((parentId) => positionedNodes.get(parentId))
      .filter((node): node is PositionedNode => node !== undefined)
    const childNodes = family.childIds
      .map((childId) => positionedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)
    if (parentNodes.length !== 2 || childNodes.length === 0) {
      continue
    }

    const parentAxisX = (Math.min(...parentNodes.map((node) => node.x + node.width / 2))
      + Math.max(...parentNodes.map((node) => node.x + node.width / 2))) / 2
    const childAxisX = (Math.min(...childNodes.map((node) => node.x + node.width / 2))
      + Math.max(...childNodes.map((node) => node.x + node.width / 2))) / 2
    const shiftX = parentAxisX - childAxisX
    if (Math.abs(shiftX) < 0.01) {
      continue
    }

    const descendantIds = collectDescendantIds(family.childIds, validation.childrenByParent)
    for (const descendantId of descendantIds) {
      const descendantNode = positionedNodes.get(descendantId)
      if (!descendantNode) {
        continue
      }

      positionedNodes.set(descendantId, {
        ...descendantNode,
        x: descendantNode.x + shiftX,
      })
    }
  }
}

function collectDescendantIds(
  rootIds: UUID[],
  childrenByParent: Map<UUID, UUID[]>,
): Set<UUID> {
  const descendants = new Set<UUID>()
  const pendingIds = [...rootIds]

  while (pendingIds.length > 0) {
    const personId = pendingIds.pop()
    if (!personId || descendants.has(personId)) {
      continue
    }

    descendants.add(personId)
    pendingIds.push(...(childrenByParent.get(personId) ?? []))
  }

  return descendants
}

function alignCanonicalMainPartners(
  positionedNodes: Map<UUID, PositionedNode>,
  projectionPlan: R3BProjectionPlan,
): void {
  for (const [ownerId, partnerIds] of projectionPlan.canonicalMainPartnerIdsByOwnerId) {
    const ownerNode = positionedNodes.get(ownerId)
    if (!ownerNode) {
      continue
    }

    partnerIds.forEach((partnerId, index) => {
      const partnerNode = positionedNodes.get(partnerId)
      if (!partnerNode) {
        return
      }

      const side = projectionPlan.canonicalMainPartnerSidesByOwnerId.get(ownerId)?.get(partnerId) ?? 'right'

      positionedNodes.set(partnerId, {
        ...partnerNode,
        x: side === 'left'
          ? ownerNode.x - PARTNER_GAP - partnerNode.width - index * (NODE_WIDTH + PARTNER_GAP)
          : ownerNode.x + ownerNode.width + PARTNER_GAP + index * (NODE_WIDTH + PARTNER_GAP),
        y: ownerNode.y,
      })
    })
  }
}

function reserveCanonicalMainPartnerRows(
  positionedNodes: Map<UUID, PositionedNode>,
  projectionPlan: R3BProjectionPlan,
): void {
  for (const [ownerId, partnerIds] of projectionPlan.canonicalMainPartnerIdsByOwnerId) {
    const ownerNode = positionedNodes.get(ownerId)
    const finalPartnerId = partnerIds[partnerIds.length - 1]
    const finalPartnerNode = finalPartnerId ? positionedNodes.get(finalPartnerId) : undefined
    if (!ownerNode || !finalPartnerNode) {
      continue
    }

    for (const node of positionedNodes.values()) {
      if (node.id === ownerId || partnerIds.includes(node.id) || node.y !== ownerNode.y) {
        continue
      }

      const overlapsPairReservation = node.x < finalPartnerNode.x + finalPartnerNode.width + PARTNER_GAP
        && node.x + node.width > ownerNode.x
      if (overlapsPairReservation) {
        node.x = finalPartnerNode.x + finalPartnerNode.width + PARTNER_GAP
        positionedNodes.set(node.id, node)
      }
    }
  }
}

function reserveFinalProjectionSlots(
  positionedNodes: Map<UUID, PositionedNode>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
  projectionPlan: R3BProjectionPlan,
  finalProjectionSlotsByContext: Map<string, R3BVisibleParentSlot>,
): void {
  buildFinalProjectionSlots(positionedNodes, marriagePartnerIdsByPerson, projectionPlan, finalProjectionSlotsByContext)
  const reservationKeys = [...finalProjectionSlotsByContext.keys()].sort((left, right) => {
    const leftSlot = finalProjectionSlotsByContext.get(left)
    const rightSlot = finalProjectionSlotsByContext.get(right)
    return (leftSlot?.y ?? 0) - (rightSlot?.y ?? 0)
      || (leftSlot?.x ?? 0) - (rightSlot?.x ?? 0)
      || left.localeCompare(right)
  })
  const reservedContextKeys = new Set<string>()
  const reservedPersonIds = new Set<UUID>()

  for (let pass = 0; pass < 2; pass += 1) {
    let changed = false

    for (const contextKey of reservationKeys) {
    const slot = finalProjectionSlotsByContext.get(contextKey)
    if (!slot) {
      continue
    }
    const direction = slot.x + slot.width / 2 >= (positionedNodes.get(slot.ownerId ?? '')?.x ?? slot.x) + NODE_WIDTH / 2
      ? 1
      : -1
    const blockers = [...positionedNodes.values()]
      .filter((node) => node.id !== slot.ownerId && node.id !== slot.companionId)
      .filter((node) => rectsOverlap(node, slot))
      .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))

    for (const blocker of blockers) {
      const shiftTargetId = reservedPersonIds.has(blocker.id) ? slot.ownerId ?? blocker.id : blocker.id
      const shiftNodeIds = new Set<UUID>([shiftTargetId])
      const currentBlocker = positionedNodes.get(blocker.id)
      if (!currentBlocker) {
        continue
      }

      if (blocker.id === slot.ownerId || blocker.id === slot.companionId) {
        continue
      }

      const shiftX = shiftTargetId === blocker.id
        ? direction === 1
          ? slot.x + slot.width + ROW_DEOVERLAP_MIN_GAP - currentBlocker.x
          : slot.x - ROW_DEOVERLAP_MIN_GAP - (currentBlocker.x + currentBlocker.width)
        : slot.x + slot.width / 2 >= currentBlocker.x + currentBlocker.width / 2
          ? currentBlocker.x + currentBlocker.width + ROW_DEOVERLAP_MIN_GAP - slot.x
          : currentBlocker.x - ROW_DEOVERLAP_MIN_GAP - (slot.x + slot.width)
      if (shiftTargetId === blocker.id && ((direction === 1 && shiftX <= 0) || (direction === -1 && shiftX >= 0))) {
        continue
      }

      for (const shiftNodeId of shiftNodeIds) {
        const node = positionedNodes.get(shiftNodeId)
        if (node) {
          positionedNodes.set(shiftNodeId, { ...node, x: node.x + shiftX })
          preserveLocalRowSpacing(positionedNodes, shiftNodeId, shiftX)
        }
      }

      buildFinalProjectionSlots(positionedNodes, marriagePartnerIdsByPerson, projectionPlan, finalProjectionSlotsByContext)
      changed = true
    }

    const refreshedSlot = finalProjectionSlotsByContext.get(contextKey)
    if (refreshedSlot) {
      for (const reservedContextKey of reservedContextKeys) {
        const reservedSlot = finalProjectionSlotsByContext.get(reservedContextKey)
        if (!reservedSlot || !rectsOverlap(refreshedSlot, reservedSlot)) {
          continue
        }

        const ownerRootId = refreshedSlot.ownerId ?? ''
        const shiftNodeIds = new Set<UUID>([ownerRootId])
        shiftNodeIds.delete(reservedSlot.ownerId ?? '')
        shiftNodeIds.delete(reservedSlot.companionId ?? '')
        const shiftX = refreshedSlot.x + refreshedSlot.width / 2 >= reservedSlot.x + reservedSlot.width / 2
          ? reservedSlot.x + reservedSlot.width + ROW_DEOVERLAP_MIN_GAP - refreshedSlot.x
          : reservedSlot.x - ROW_DEOVERLAP_MIN_GAP - (refreshedSlot.x + refreshedSlot.width)
        for (const shiftNodeId of shiftNodeIds) {
          const node = positionedNodes.get(shiftNodeId)
          if (node) {
            positionedNodes.set(shiftNodeId, { ...node, x: node.x + shiftX })
            preserveLocalRowSpacing(positionedNodes, shiftNodeId, shiftX)
          }
        }
        buildFinalProjectionSlots(positionedNodes, marriagePartnerIdsByPerson, projectionPlan, finalProjectionSlotsByContext)
        changed = true
      }
    }

    reservedContextKeys.add(contextKey)
    if (slot.ownerId) {
      reservedPersonIds.add(slot.ownerId)
    }
      if (slot.companionId) {
        reservedPersonIds.add(slot.companionId)
      }
    }

    if (!changed) {
      break
    }
  }

  buildFinalProjectionSlots(positionedNodes, marriagePartnerIdsByPerson, projectionPlan, finalProjectionSlotsByContext)
}

function preserveLocalRowSpacing(
  positionedNodes: Map<UUID, PositionedNode>,
  shiftedNodeId: UUID,
  shiftX: number,
): void {
  const shiftedNode = positionedNodes.get(shiftedNodeId)
  if (!shiftedNode || shiftX === 0) {
    return
  }

  const rowNodes = [...positionedNodes.values()]
    .filter((node) => node.y === shiftedNode.y)
    .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
  const shiftedNodeIndex = rowNodes.findIndex((node) => node.id === shiftedNodeId)
  if (shiftedNodeIndex < 0) {
    return
  }

  if (shiftX > 0) {
    for (let index = shiftedNodeIndex + 1; index < rowNodes.length; index += 1) {
      const previous = rowNodes[index - 1]
      const node = rowNodes[index]
      const minX = previous.x + previous.width + ROW_DEOVERLAP_MIN_GAP
      if (node.x < minX) {
        node.x = minX
        positionedNodes.set(node.id, node)
      }
    }
    return
  }

  for (let index = shiftedNodeIndex - 1; index >= 0; index -= 1) {
    const node = rowNodes[index]
    const next = rowNodes[index + 1]
    const maxRight = next.x - ROW_DEOVERLAP_MIN_GAP
    if (node.x + node.width > maxRight) {
      node.x = maxRight - node.width
      positionedNodes.set(node.id, node)
    }
  }
}


function finalizeFamilyPlacementAxes(
  familyPlacements: Map<string, R3FamilyPlacement>,
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>,
  positionedNodes: Map<UUID, PositionedNode>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
  validation: ValidationResult,
  projectionPlan: R3BProjectionPlan,
): void {
  for (const [key, placement] of familyPlacements.entries()) {
    const visibleParentSlots = refreshVisibleParentSlots({
      family: {
        key: placement.key,
        parentIds: placement.parentIds,
        childIds: placement.childIds,
        ownerId: resolvePlacementOwnerId(placement.parentIds, validation),
        marriage: resolveFamilyMarriage(placement.parentIds, validation),
      },
      visibleParentSlotsByFamily,
      positionedNodes,
      marriagePartnerIdsByPerson,
      validation,
      projectionPlan,
    })
    const axisX = resolveVisibleFamilyMidX(visibleParentSlots)
    if (!Number.isFinite(axisX)) {
      continue
    }

    familyPlacements.set(key, {
      ...placement,
      axisColumn: axisX / COLUMN_WIDTH,
    })
  }
}

function resolveFamilyMarriage(parentIds: UUID[], validation: ValidationResult) {
  if (parentIds.length !== 2) {
    return null
  }

  return validation.validOverlayRelations.find((relation) => (
    relation.type === 'marriage'
    && ((relation.from === parentIds[0] && relation.to === parentIds[1])
      || (relation.from === parentIds[1] && relation.to === parentIds[0]))
  )) ?? null
}

function buildR3BFamilyOffsets(familyCount: number): number[] {
  if (familyCount <= 0) {
    return []
  }

  if (familyCount === 1) {
    return [0]
  }

  const offsets = [-0.5 * SPOUSE_STEP_COLUMNS, 0.5 * SPOUSE_STEP_COLUMNS]
  for (let index = 2; index < familyCount; index += 1) {
    offsets.push((index - 0.5) * SPOUSE_STEP_COLUMNS)
  }
  return offsets
}

function resolveSpouseColumn(ownerColumn: number, familyOffset: number): number {
  return familyOffset < 0 ? ownerColumn - SPOUSE_STEP_COLUMNS : ownerColumn + SPOUSE_STEP_COLUMNS
}

function resolveFamilyAxisColumn({
  family,
  fallbackCenterColumn,
  followRulerLine,
  visibleParentSlots,
}: {
  family: R3FamilyGroup
  fallbackCenterColumn: number
  followRulerLine: boolean
  visibleParentSlots: R3BVisibleParentSlot[]
}): number {
  if (followRulerLine || family.parentIds.length !== 2 || visibleParentSlots.length !== 2) {
    return fallbackCenterColumn
  }

  return resolveVisibleFamilyMidX(visibleParentSlots) / COLUMN_WIDTH
}

function resolveVisibleFamilyMidX(visibleParentSlots: R3BVisibleParentSlot[]): number {
  if (visibleParentSlots.length === 0) {
    return Number.NaN
  }
  const centers = visibleParentSlots.map((slot) => slot.x + slot.width / 2)
  return centers.length === 1
    ? centers[0]
    : (Math.min(...centers) + Math.max(...centers)) / 2
}

function refreshVisibleParentSlots({
  family,
  visibleParentSlotsByFamily,
  positionedNodes,
  marriagePartnerIdsByPerson,
  validation,
  projectionPlan,
}: {
  family: Pick<R3FamilyGroup, 'key' | 'parentIds' | 'ownerId' | 'childIds' | 'marriage'>
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>
  positionedNodes: Map<UUID, PositionedNode>
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>
  validation: ValidationResult
  projectionPlan: R3BProjectionPlan
}): R3BVisibleParentSlot[] {
  const visibleParentSlots = buildVisibleParentSlots(
    family,
    positionedNodes,
    marriagePartnerIdsByPerson,
    validation,
    projectionPlan,
  )
  visibleParentSlotsByFamily.set(family.key, visibleParentSlots)
  return visibleParentSlots
}

function normalizeVisibleParentSlots(
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>,
  offsetX: number,
  offsetY: number,
): void {
  for (const [familyKey, slots] of visibleParentSlotsByFamily.entries()) {
    visibleParentSlotsByFamily.set(familyKey, slots.map((slot) => ({
      ...slot,
      x: slot.x - offsetX,
      y: slot.y - offsetY,
    })))
  }
}

function normalizeFinalProjectionSlots(
  finalProjectionSlotsByContext: Map<string, R3BVisibleParentSlot>,
  offsetX: number,
  offsetY: number,
): void {
  for (const [contextKey, slot] of finalProjectionSlotsByContext.entries()) {
    finalProjectionSlotsByContext.set(contextKey, {
      ...slot,
      x: slot.x - offsetX,
      y: slot.y - offsetY,
    })
  }
}

function shouldUseProjectedChildAxis(family: R3FamilyGroup, validation: ValidationResult): boolean {
  if (family.parentIds.length !== 2) {
    return false
  }

  const [firstParentId, secondParentId] = family.parentIds
  const firstParentCount = (validation.parentsByChild.get(firstParentId) ?? []).length
  const secondParentCount = (validation.parentsByChild.get(secondParentId) ?? []).length
  return firstParentCount > 0 && secondParentCount > 0
}

function shouldAttachSpouseToOwnerLineage(
  family: R3FamilyGroup,
  spouseId: UUID,
  projectionPlan: R3BProjectionPlan,
): boolean {
  const slotPlan = projectionPlan.visiblePartnerSlotsByFamily.get(family.key)
  return slotPlan?.ownerId === family.ownerId
    && slotPlan.companionId === spouseId
    && slotPlan.companionKind === 'real'
}

function positionCoupleAroundFamilyAxis({
  ownerId,
  spouseId,
  familyCenter,
  row,
  spouseSide,
  positionedNodes,
}: {
  ownerId: UUID
  spouseId: UUID
  familyCenter: number
  row: number
  spouseSide: 'left' | 'right'
  positionedNodes: Map<UUID, PositionedNode>
}): void {
  const centerX = familyCenter * COLUMN_WIDTH
  const y = row * ROW_HEIGHT
  const spouseDeltaX = (NODE_WIDTH + PARTNER_GAP) * (spouseSide === 'left' ? -1 : 1)
  const halfPairSpan = (NODE_WIDTH + PARTNER_GAP) / 2
  const ownerNode = positionedNodes.get(ownerId)
  const ownerCenterX = ownerNode ? ownerNode.x + ownerNode.width / 2 : centerX - (spouseSide === 'left' ? -halfPairSpan : halfPairSpan)
  const spouseCenterX = ownerNode
    ? ownerCenterX + spouseDeltaX
    : Math.abs(ownerCenterX - centerX) < 0.01
      ? ownerCenterX + spouseDeltaX
      : 2 * centerX - ownerCenterX

  if (!ownerNode) {
    positionedNodes.set(ownerId, {
      id: ownerId,
      x: ownerCenterX - NODE_WIDTH / 2,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })
  }

  positionedNodes.set(spouseId, {
    id: spouseId,
    x: spouseCenterX - NODE_WIDTH / 2,
    y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  })
}

function createNode(id: UUID, column: number, row: number): PositionedNode {
  const centerX = column * COLUMN_WIDTH
  return {
    id,
    x: centerX - NODE_WIDTH / 2,
    y: row * ROW_HEIGHT,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }
}

function normalizeLayout(positionedNodes: Map<UUID, PositionedNode>): { layout: LayoutResult; offsetX: number; offsetY: number } {
  if (positionedNodes.size === 0) {
    return {
      layout: { nodes: positionedNodes },
      offsetX: 0,
      offsetY: 0,
    }
  }

  const minX = Math.min(...[...positionedNodes.values()].map((node) => node.x))
  const minY = Math.min(...[...positionedNodes.values()].map((node) => node.y))
  const normalizedNodes = new Map<UUID, PositionedNode>()

  for (const node of positionedNodes.values()) {
    normalizedNodes.set(node.id, {
      ...node,
      x: node.x - minX + OUTER_PADDING,
      y: node.y - minY + OUTER_PADDING,
    })
  }

  return {
    layout: { nodes: normalizedNodes },
    offsetX: minX - OUTER_PADDING,
    offsetY: minY - OUTER_PADDING,
  }
}

function buildVisibleParentSlots(
  family: Pick<R3FamilyGroup, 'key' | 'parentIds' | 'ownerId' | 'childIds' | 'marriage'>,
  positionedNodes: Map<UUID, PositionedNode>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
  validation: ValidationResult,
  projectionPlan: R3BProjectionPlan,
): R3BVisibleParentSlot[] {
  if (family.parentIds.length === 0) {
    return []
  }

  if (family.parentIds.length === 1) {
    const node = positionedNodes.get(family.parentIds[0])
    if (!node) {
      return []
    }

    return [{
      key: `${family.key}:owner:${node.id}`,
      familyKey: family.key,
	  relationId: family.marriage?.id,
	  ownerId: family.ownerId,
	  companionId: family.parentIds.find((parentId) => parentId !== family.ownerId),
      personId: node.id,
      role: 'owner',
      kind: 'real',
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }]
  }

  const ownerNode = positionedNodes.get(family.ownerId)
  const companionId = family.parentIds.find((parentId) => parentId !== family.ownerId) ?? null
  const companionNode = companionId ? positionedNodes.get(companionId) ?? null : null

  if (!ownerNode || !companionId) {
    return buildRealVisibleParentSlots(family, positionedNodes)
  }

  const slotPlan = projectionPlan.visiblePartnerSlotsByFamily.get(family.key)
  const usesProjectedCompanion = slotPlan?.ownerId === family.ownerId
    && slotPlan.companionId === companionId
    ? slotPlan.companionKind === 'projection'
    : shouldUseProjectedChildAxis(family as R3FamilyGroup, validation)

  if (!usesProjectedCompanion) {
    if (!companionNode) {
      return buildRealVisibleParentSlots(family, positionedNodes)
    }

    return [ownerNode, companionNode]
      .filter((node): node is PositionedNode => node !== null)
      .map((node) => ({
        key: `${family.key}:real:${node.id}`,
        familyKey: family.key,
	    relationId: family.marriage?.id,
	    ownerId: family.ownerId,
	    companionId,
        personId: node.id,
        role: node.id === family.ownerId ? 'owner' : 'companion',
        kind: 'real' as const,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      }))
  }

  const projection = buildR3BProjectionGeometry({
    ownerId: family.ownerId,
    companionId,
    ownerNode,
    companionNode,
    partnerIdsByPerson: marriagePartnerIdsByPerson,
    nodesById: positionedNodes,
  })

  return [
    {
      key: `${family.key}:owner:${family.ownerId}`,
      familyKey: family.key,
	  relationId: family.marriage?.id,
	  ownerId: family.ownerId,
	  companionId,
      personId: family.ownerId,
      role: 'owner',
      kind: 'real',
      x: ownerNode.x,
      y: ownerNode.y,
      width: ownerNode.width,
      height: ownerNode.height,
    },
    {
      key: `${family.key}:projection:${companionId}`,
      familyKey: family.key,
	  relationId: family.marriage?.id,
	  ownerId: family.ownerId,
	  companionId,
      personId: companionId,
      role: 'companion',
      kind: 'projection',
      x: projection.x,
      y: projection.y,
      width: projection.width,
      height: projection.height,
    },
  ]
}

function buildFinalProjectionSlots(
  positionedNodes: Map<UUID, PositionedNode>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
  projectionPlan: R3BProjectionPlan,
  finalProjectionSlotsByContext: Map<string, R3BVisibleParentSlot>,
): void {
  finalProjectionSlotsByContext.clear()

  for (const context of projectionPlan.projectionContextsByKey.values()) {
    if (projectionPlan.canonicalMainMarriageIds.has(context.relationId)) {
      continue
    }

    const ownerNode = positionedNodes.get(context.ownerId)
    const companionNode = positionedNodes.get(context.companionId) ?? null
    if (!ownerNode) {
      continue
    }
    const projection = buildR3BProjectionGeometry({
      ownerId: context.ownerId,
      companionId: context.companionId,
      ownerNode,
      companionNode,
      partnerIdsByPerson: marriagePartnerIdsByPerson,
      nodesById: positionedNodes,
    })
    const key = buildR3BProjectionContextKey(context.relationId, context.ownerId, context.companionId)
    finalProjectionSlotsByContext.set(key, {
      key,
      familyKey: context.familyKey,
      relationId: context.relationId,
      ownerId: context.ownerId,
      companionId: context.companionId,
      personId: context.companionId,
      role: 'companion',
      kind: 'projection',
      x: projection.x,
      y: projection.y,
      width: projection.width,
      height: projection.height,
    })
  }
}

function rectsOverlap(
  first: Pick<PositionedNode, 'x' | 'y' | 'width' | 'height'>,
  second: Pick<R3BVisibleParentSlot, 'x' | 'y' | 'width' | 'height'>,
): boolean {
  return !(
    first.x + first.width <= second.x
    || second.x + second.width <= first.x
    || first.y + first.height <= second.y
    || second.y + second.height <= first.y
  )
}

function buildRealVisibleParentSlots(
  family: Pick<R3FamilyGroup, 'key' | 'parentIds' | 'ownerId' | 'marriage'>,
  positionedNodes: Map<UUID, PositionedNode>,
): R3BVisibleParentSlot[] {
  return family.parentIds
    .map((parentId) => positionedNodes.get(parentId))
    .filter((node): node is PositionedNode => node !== undefined)
    .map((node) => ({
      key: `${family.key}:real:${node.id}`,
      familyKey: family.key,
	  relationId: family.marriage?.id,
	  ownerId: family.ownerId,
	  companionId: family.parentIds.find((parentId) => parentId !== family.ownerId),
      personId: node.id,
      role: node.id === family.ownerId ? 'owner' : 'companion',
      kind: 'real' as const,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }))
}

function resolvePlacementOwnerId(parentIds: UUID[], validation: ValidationResult): UUID {
  if (parentIds.length <= 1) {
    return parentIds[0] ?? ''
  }

  const [firstParentId, secondParentId] = parentIds
  const firstParentCount = (validation.parentsByChild.get(firstParentId) ?? []).length
  const secondParentCount = (validation.parentsByChild.get(secondParentId) ?? []).length
  if (firstParentCount !== secondParentCount) {
    return firstParentCount > secondParentCount ? firstParentId : secondParentId
  }

  return firstParentId
}