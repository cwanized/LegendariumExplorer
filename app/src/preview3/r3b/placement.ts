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
import { buildR3BMarriagePartnerIdsByPerson, buildR3BProjectionGeometry } from './projections'
import type { R3BLayoutArtifacts, R3BVisibleParentSlot } from './types'

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
const TWO_CHILD_SPAN_COMPRESSION = 0.28
const SINGLE_PARENT_TWO_CHILD_SPAN_COMPRESSION = 0.24
const TWO_CHILD_HEAVY_BRANCH_RATIO_THRESHOLD = 2.6
const TWO_CHILD_LIGHT_BRANCH_MAX_SPAN = 1.35
const MULTI_SIBLING_SPAN_COMPRESSION = 0.42
const SINGLE_PARENT_MULTI_SIBLING_SPAN_COMPRESSION = 0.34
const ROW_DEOVERLAP_MIN_GAP = 20
const TWO_CHILD_CONTINUATION_MIN_CENTER_DISTANCE = 640
const PROJECTED_PAIR_MIN_SPAN_COLUMNS = 2.45
const COUSIN_GROUP_MIN_GAP = 120
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
    const clusterWidth = getClusterWidth(cluster.rootIds, placementPlan, subtreeSpanCache, validation)
    let rootCursor = clusterCursor

    for (const rootId of cluster.rootIds) {
      const rootWidth = getPersonSubtreeSpan(rootId, placementPlan, subtreeSpanCache, validation)
      const rootCenter = rootCursor + rootWidth / 2
      placePersonBranch({
        personId: rootId,
        centerColumn: rootCenter,
        followRulerLine,
        validation,
        placementPlan,
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
    marriagePartnerIdsByPerson,
  )
  applySingleChildrenToTwoParentMidpoint(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
    marriagePartnerIdsByPerson,
  )
  applyVisibleTwoParentChildBandRecentering(
    placementPlan.families,
    validation,
    positionedNodes,
    spouseAttachedByOwnerId,
    marriagePartnerIdsByPerson,
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

  for (const [anchorKey, placement] of houseAnchorPlacements.entries()) {
    houseAnchorPlacements.set(anchorKey, {
      ...placement,
      connectorNodeIds: placement.connectorNodeIds.filter((nodeId) => !spouseAttachedToOwnerLineageIds.has(nodeId)),
    })
  }

  finalizeFamilyPlacementAxes(familyPlacements, visibleParentSlotsByFamily, positionedNodes, marriagePartnerIdsByPerson, validation)

  const normalization = normalizeLayout(positionedNodes)
  r3bArtifactsByNodes.set(normalization.layout.nodes, {
    familyPlacements: [...familyPlacements.values()].sort((left, right) => left.parentRow - right.parentRow || left.key.localeCompare(right.key)),
    houseAnchorPlacements: [...houseAnchorPlacements.values()].sort((left, right) => left.key.localeCompare(right.key)),
    rowByPersonId: placementPlan.rowByPersonId,
    clusterByPersonId: placementPlan.clusterByPersonId,
    visibleParentSlotsByFamily,
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

function placePersonBranch({
  personId,
  centerColumn,
  followRulerLine,
  validation,
  placementPlan,
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
      ? shouldAttachSpouseToOwnerLineage(spouseId, validation)
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

    const familyCenter = resolveFamilyAxisColumn({
      family,
      fallbackCenterColumn: ownerFamilyCenter,
      followRulerLine,
      positionedNodes,
      marriagePartnerIdsByPerson,
      validation,
    })

    const childColumns = buildChildColumns(familyCenter, family, family.childIds, placementPlan, subtreeSpanCache, validation)
    family.childIds.forEach((childId, childIndex) => {
      placePersonBranch({
        personId: childId,
        centerColumn: childColumns[childIndex],
        followRulerLine,
        validation,
        placementPlan,
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
    visibleParentSlotsByFamily.set(
      family.key,
      buildVisibleParentSlots(family, positionedNodes, marriagePartnerIdsByPerson, validation),
    )

    if (spouseId && spouseFollowsOwnerLineage && positionedNodes.has(spouseId)) {
      positionCoupleAroundFamilyAxis({ ownerId: personId, spouseId, familyCenter, row, spouseSide, positionedNodes })
    }
  })

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

function getClusterWidth(rootIds: UUID[], placementPlan: R3PlacementPlan, subtreeSpanCache: Map<UUID, number>, validation: ValidationResult): number {
  return rootIds.reduce((sum, rootId, index) => {
    const rootWidth = getPersonSubtreeSpan(rootId, placementPlan, subtreeSpanCache, validation)
    return sum + rootWidth + (index === rootIds.length - 1 ? 0 : ROOT_GAP_COLUMNS)
  }, 0)
}

function getPersonSubtreeSpan(
  personId: UUID,
  placementPlan: R3PlacementPlan,
  subtreeSpanCache: Map<UUID, number>,
  validation?: ValidationResult,
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
  if (relevantFamilies.length === 0) {
    subtreeSpanCache.set(personId, 1)
    return 1
  }

  const span = Math.max(...relevantFamilies.map((family) => getFamilySpan(family, placementPlan, subtreeSpanCache, validation)))
  subtreeSpanCache.set(personId, span)
  return span
}

function getFamilySpan(
  family: R3FamilyGroup,
  placementPlan: R3PlacementPlan,
  subtreeSpanCache: Map<UUID, number>,
  validation?: ValidationResult,
): number {
  const childSpan = family.childIds.reduce((sum, childId, index) => {
    const subtreeSpan = getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache, validation)
    const next = sum + resolveChildPlacementSpan(subtreeSpan, family)
    return next + (index === family.childIds.length - 1 ? 0 : CHILD_GAP_COLUMNS)
  }, 0)
  const pairSpan = family.parentIds.length === 2
    ? Math.max(
        shouldReserveProjectedPairSpan(family, placementPlan.families)
          ? PROJECTED_PAIR_MIN_SPAN_COLUMNS
          : 2,
        SPOUSE_STEP_COLUMNS + 1,
      )
    : 1
  return Math.max(pairSpan, childSpan || 1)
}

function shouldReserveProjectedPairSpan(family: R3FamilyGroup, families: R3FamilyGroup[]): boolean {
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
): number[] {
  if (family.parentIds.length === 2 && childIds.length === 2) {
    const rawSpans = childIds.map((childId) => getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache, validation))
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

  const profiles = childIds.map((childId) => resolveChildPlacementProfile(childId, family, placementPlan, subtreeSpanCache, validation))
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
): { childId: UUID; leftExtent: number; rightExtent: number; trailingGap: number } {
  const subtreeSpan = getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache, validation)
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
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
): void {
  for (const family of families) {
    if (family.parentIds.length !== 2 || family.childIds.length !== 1) {
      continue
    }

    const [firstParentId, secondParentId] = family.parentIds
    const childId = family.childIds[0]
    const firstParent = positionedNodes.get(firstParentId)
    const secondParent = positionedNodes.get(secondParentId)
    const childNode = positionedNodes.get(childId)

    if (!firstParent || !secondParent || !childNode) {
      continue
    }

    const parentMidX = resolveVisibleFamilyMidX(family, positionedNodes, marriagePartnerIdsByPerson, validation)

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
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
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

    const targetMidX = resolveVisibleFamilyMidX(family, positionedNodes, marriagePartnerIdsByPerson, validation)
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

        if (right.minCenterX >= left.maxCenterX - 1) {
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
    })
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


function finalizeFamilyPlacementAxes(
  familyPlacements: Map<string, R3FamilyPlacement>,
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>,
  positionedNodes: Map<UUID, PositionedNode>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
  validation: ValidationResult,
): void {
  for (const [key, placement] of familyPlacements.entries()) {
    const visibleParentSlots = buildVisibleParentSlots(
      {
        key: placement.key,
        parentIds: placement.parentIds,
        childIds: placement.childIds,
        ownerId: resolvePlacementOwnerId(placement.parentIds, validation),
        marriage: null,
      },
      positionedNodes,
      marriagePartnerIdsByPerson,
      validation,
    )
    visibleParentSlotsByFamily.set(key, visibleParentSlots)
    const parentCenters = visibleParentSlots.map((slot) => slot.x + slot.width / 2)

    if (parentCenters.length === 0) {
      continue
    }

    const axisX = parentCenters.length === 1
      ? parentCenters[0]
      : (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2

    familyPlacements.set(key, {
      ...placement,
      axisColumn: axisX / COLUMN_WIDTH,
    })
  }
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
  positionedNodes,
  marriagePartnerIdsByPerson,
  validation,
}: {
  family: R3FamilyGroup
  fallbackCenterColumn: number
  followRulerLine: boolean
  positionedNodes: Map<UUID, PositionedNode>
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>
  validation: ValidationResult
}): number {
  if (followRulerLine || family.parentIds.length !== 2) {
    return fallbackCenterColumn
  }

  const [leftParentId, rightParentId] = family.parentIds
  const leftParent = positionedNodes.get(leftParentId)
  const rightParent = positionedNodes.get(rightParentId)

  if (!leftParent || !rightParent) {
    return fallbackCenterColumn
  }

  return resolveVisibleFamilyMidX(family, positionedNodes, marriagePartnerIdsByPerson, validation) / COLUMN_WIDTH
}

function resolveVisibleFamilyMidX(
  family: R3FamilyGroup,
  positionedNodes: Map<UUID, PositionedNode>,
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>,
  validation: ValidationResult,
): number {
  const visibleParentSlots = buildVisibleParentSlots(family, positionedNodes, marriagePartnerIdsByPerson, validation)
  if (visibleParentSlots.length === 0) {
    return 0
  }
  const centers = visibleParentSlots.map((slot) => slot.x + slot.width / 2)
  return centers.length === 1
    ? centers[0]
    : (Math.min(...centers) + Math.max(...centers)) / 2
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

function shouldAttachSpouseToOwnerLineage(spouseId: UUID, validation: ValidationResult): boolean {
  const parentCount = (validation.parentsByChild.get(spouseId) ?? []).length
  return parentCount === 0
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
    return family.parentIds
      .map((parentId) => positionedNodes.get(parentId))
      .filter((node): node is PositionedNode => node !== undefined)
      .map((node) => ({
        key: `${family.key}:real:${node.id}`,
        familyKey: family.key,
        personId: node.id,
        role: node.id === family.ownerId ? 'owner' : 'companion',
        kind: 'real' as const,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      }))
  }

  if (!shouldUseProjectedChildAxis(family as R3FamilyGroup, validation)) {
    return [ownerNode, companionNode]
      .filter((node): node is PositionedNode => node !== null)
      .map((node) => ({
        key: `${family.key}:real:${node.id}`,
        familyKey: family.key,
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