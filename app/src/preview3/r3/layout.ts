import type {
  HouseDefinitions,
  LayoutResult,
  PositionedNode,
  UUID,
  ValidationResult,
} from '../../graph'
import { createHouseLookup, type HouseLookup } from './houses'
import { sortPersonIdsForR3 } from './sorting'
import { buildBiologicalFamilies, compareFamilyGroups } from './families'
import { buildGenerationRows } from './generation'
import { buildClusterAssignments, buildClusters } from './clusters'
import type { R3FamilyGroup, R3FamilyPlacement, R3HouseAnchorPlacement, R3LayoutArtifacts, R3PlacementPlan } from './types'

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
const PROJECTION_HORIZONTAL_GAP = 28
const PROJECTION_NODE_WIDTH = 152
const TWO_CHILD_SPAN_COMPRESSION = 0.28
const SINGLE_PARENT_TWO_CHILD_SPAN_COMPRESSION = 0.24
const MULTI_SIBLING_SPAN_COMPRESSION = 0.42
const SINGLE_PARENT_MULTI_SIBLING_SPAN_COMPRESSION = 0.34
const ROW_DEOVERLAP_MIN_GAP = 20
const SIBLING_REBALANCE_MIN_EDGE_GAP = 40
const SIBLING_REBALANCE_MAX_EDGE_GAP = 300
const SIBLING_REBALANCE_MAX_SHIFT = 220
const r3ArtifactsByNodes = new WeakMap<Map<UUID, PositionedNode>, R3LayoutArtifacts>()

export function buildModeR3Layout(
  validation: ValidationResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    followRulerLine?: boolean
  },
): LayoutResult {
  return buildModeR3LayoutWithArtifacts(validation, houseDefinitions, options)
}

export function buildModeR3LayoutWithArtifacts(
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
  const positionedNodes = new Map<UUID, PositionedNode>()
  const subtreeSpanCache = new Map<UUID, number>()
  const placedPersons = new Set<UUID>()
  const spouseAttachedToOwnerLineageIds = new Set<UUID>()
  const spouseAttachedByOwnerId = new Map<UUID, Set<UUID>>()
  const familyPlacements = new Map<string, R3FamilyPlacement>()
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
    const clusterWidth = getClusterWidth(cluster.rootIds, placementPlan, subtreeSpanCache)
    let rootCursor = clusterCursor

    for (const rootId of cluster.rootIds) {
      const rootWidth = getPersonSubtreeSpan(rootId, placementPlan, subtreeSpanCache)
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

  applyCappedSiblingFamilyRebalance(validation, positionedNodes, spouseAttachedByOwnerId)
  alignSingleChildrenToTwoParentMidpoint(placementPlan.families, validation, positionedNodes, spouseAttachedByOwnerId)

  for (const [anchorKey, placement] of houseAnchorPlacements.entries()) {
    houseAnchorPlacements.set(anchorKey, {
      ...placement,
      connectorNodeIds: placement.connectorNodeIds.filter((nodeId) => !spouseAttachedToOwnerLineageIds.has(nodeId)),
    })
  }

  applyRowDeoverlap(positionedNodes)
  finalizeFamilyPlacementAxes(familyPlacements, positionedNodes)

  const normalization = normalizeLayout(positionedNodes)
  r3ArtifactsByNodes.set(normalization.layout.nodes, {
    familyPlacements: [...familyPlacements.values()].sort((left, right) => left.parentRow - right.parentRow || left.key.localeCompare(right.key)),
    houseAnchorPlacements: [...houseAnchorPlacements.values()].sort((left, right) => left.key.localeCompare(right.key)),
    rowByPersonId: placementPlan.rowByPersonId,
    clusterByPersonId: placementPlan.clusterByPersonId,
    normalizationOffsetX: normalization.offsetX,
    normalizationOffsetY: normalization.offsetY,
  })

  return normalization.layout
}

export function getModeR3LayoutArtifacts(layout: LayoutResult): R3LayoutArtifacts | null {
  return r3ArtifactsByNodes.get(layout.nodes) ?? null
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
  const familyOffsets = buildFamilyOffsets(ownedFamilies.length)

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
      validation,
    })

    const childColumns = buildChildColumns(familyCenter, family, family.childIds, placementPlan, subtreeSpanCache)
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
    const normalizedOwnerId = resolveAnchoredFamilyOwnerId({
      family,
      rowByPersonId,
      validation,
    })

    if (normalizedOwnerId === family.ownerId) {
      return family
    }

    return {
      ...family,
      ownerId: normalizedOwnerId,
    }
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
  rowByPersonId,
  validation,
}: {
  family: R3FamilyGroup
  rowByPersonId: Map<UUID, number>
  validation: ValidationResult
}): UUID {
  if (family.parentIds.length !== 2) {
    return family.ownerId
  }

  const [leftParentId, rightParentId] = family.parentIds
  const leftHasBiologicalParents = (validation.parentsByChild.get(leftParentId) ?? []).length > 0
  const rightHasBiologicalParents = (validation.parentsByChild.get(rightParentId) ?? []).length > 0

  // Prefer the partner already anchored by known ancestry over a parentless root candidate.
  if (leftHasBiologicalParents !== rightHasBiologicalParents) {
    return leftHasBiologicalParents ? leftParentId : rightParentId
  }

  const leftRow = rowByPersonId.get(leftParentId) ?? 1
  const rightRow = rowByPersonId.get(rightParentId) ?? 1
  if (leftRow !== rightRow) {
    return leftRow > rightRow ? leftParentId : rightParentId
  }

  return family.ownerId
}

function getClusterWidth(rootIds: UUID[], placementPlan: R3PlacementPlan, subtreeSpanCache: Map<UUID, number>): number {
  return rootIds.reduce((sum, rootId, index) => {
    const rootWidth = getPersonSubtreeSpan(rootId, placementPlan, subtreeSpanCache)
    return sum + rootWidth + (index === rootIds.length - 1 ? 0 : ROOT_GAP_COLUMNS)
  }, 0)
}

function getPersonSubtreeSpan(personId: UUID, placementPlan: R3PlacementPlan, subtreeSpanCache: Map<UUID, number>): number {
  const cached = subtreeSpanCache.get(personId)
  if (cached !== undefined) {
    return cached
  }

  const ownedFamilies = placementPlan.ownedFamiliesByPersonId.get(personId) ?? []
  if (ownedFamilies.length === 0) {
    subtreeSpanCache.set(personId, 1)
    return 1
  }

  const span = Math.max(...ownedFamilies.map((family) => getFamilySpan(family, placementPlan, subtreeSpanCache)))
  subtreeSpanCache.set(personId, span)
  return span
}

function getFamilySpan(family: R3FamilyGroup, placementPlan: R3PlacementPlan, subtreeSpanCache: Map<UUID, number>): number {
  const childSpan = family.childIds.reduce((sum, childId, index) => {
    const subtreeSpan = getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache)
    const next = sum + resolveChildPlacementSpan(subtreeSpan, family)
    return next + (index === family.childIds.length - 1 ? 0 : CHILD_GAP_COLUMNS)
  }, 0)
  const pairSpan = family.parentIds.length === 2 ? Math.max(2, SPOUSE_STEP_COLUMNS + 1) : 1
  return Math.max(pairSpan, childSpan || 1)
}

function buildChildColumns(
  familyCenter: number,
  family: R3FamilyGroup,
  childIds: UUID[],
  placementPlan: R3PlacementPlan,
  subtreeSpanCache: Map<UUID, number>,
): number[] {
  const totalWidth = childIds.reduce((sum, childId, index) => {
    const subtreeSpan = getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache)
    const next = sum + resolveChildPlacementSpan(subtreeSpan, family)
    return next + (index === childIds.length - 1 ? 0 : CHILD_GAP_COLUMNS)
  }, 0)
  const columns: number[] = []
  let cursor = familyCenter - totalWidth / 2

  for (const childId of childIds) {
    const subtreeSpan = getPersonSubtreeSpan(childId, placementPlan, subtreeSpanCache)
    const width = resolveChildPlacementSpan(subtreeSpan, family)
    columns.push(cursor + width / 2)
    cursor += width + CHILD_GAP_COLUMNS
  }

  return columns
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

function applyCappedSiblingFamilyRebalance(
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
): void {
  for (const childIds of validation.childrenByParent.values()) {
    if (childIds.length < 4) {
      continue
    }

    const children = childIds
      .map((childId) => positionedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)
      .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))

    if (children.length < 4) {
      continue
    }

    const minRowY = Math.min(...children.map((node) => node.y))
    const maxRowY = Math.max(...children.map((node) => node.y))
    if (maxRowY - minRowY > 4) {
      continue
    }

    const gaps = children.slice(1).map((node, index) => node.x - (children[index].x + children[index].width))
    const minGap = Math.min(...gaps)
    const maxGap = Math.max(...gaps)
    if (minGap >= SIBLING_REBALANCE_MIN_EDGE_GAP || maxGap <= SIBLING_REBALANCE_MAX_EDGE_GAP) {
      continue
    }

    const firstX = children[0].x
    const lastX = children[children.length - 1].x

    for (let index = 1; index < children.length - 1; index += 1) {
      const childNode = children[index]
      const desiredX = firstX + ((lastX - firstX) * index) / (children.length - 1)
      const rawShift = desiredX - childNode.x
      const shift = Math.max(-SIBLING_REBALANCE_MAX_SHIFT, Math.min(SIBLING_REBALANCE_MAX_SHIFT, rawShift))
      if (Math.abs(shift) < 1) {
        continue
      }

      const subtreeIds = collectShiftNodeIds(childNode.id, validation.childrenByParent, spouseAttachedByOwnerId)
      for (const subtreeId of subtreeIds) {
        const subtreeNode = positionedNodes.get(subtreeId)
        if (!subtreeNode) {
          continue
        }

        positionedNodes.set(subtreeId, {
          ...subtreeNode,
          x: subtreeNode.x + shift,
        })
      }
    }
  }
}

function collectShiftNodeIds(
  rootId: UUID,
  childrenByParent: Map<UUID, UUID[]>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
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
      if (!visited.has(childId)) {
        queue.push(childId)
      }
    }
  }

  return visited
}

function alignSingleChildrenToTwoParentMidpoint(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  positionedNodes: Map<UUID, PositionedNode>,
  spouseAttachedByOwnerId: Map<UUID, Set<UUID>>,
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

    const parentMidX = (firstParent.x + firstParent.width / 2 + secondParent.x + secondParent.width / 2) / 2
    const childCenterX = childNode.x + childNode.width / 2
    const shiftX = parentMidX - childCenterX
    if (Math.abs(shiftX) < 1) {
      continue
    }

    const shiftNodeIds = collectShiftNodeIds(childId, validation.childrenByParent, spouseAttachedByOwnerId)
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

function applyRowDeoverlap(positionedNodes: Map<UUID, PositionedNode>): void {
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
  positionedNodes: Map<UUID, PositionedNode>,
): void {
  for (const [key, placement] of familyPlacements.entries()) {
    const parentCenters = placement.parentIds
      .map((parentId) => positionedNodes.get(parentId))
      .filter((node): node is PositionedNode => node !== undefined)
      .map((node) => node.x + node.width / 2)

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

function buildFamilyOffsets(familyCount: number): number[] {
  if (familyCount <= 0) {
    return []
  }

  if (familyCount === 1) {
    return [0]
  }

  const centerIndex = (familyCount - 1) / 2
  const offsets: number[] = []
  for (let index = 0; index < familyCount; index += 1) {
    offsets.push((index - centerIndex) * SPOUSE_STEP_COLUMNS)
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
  validation,
}: {
  family: R3FamilyGroup
  fallbackCenterColumn: number
  followRulerLine: boolean
  positionedNodes: Map<UUID, PositionedNode>
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

  if (shouldUseProjectedChildAxis(family, validation)) {
    const ownerNode = positionedNodes.get(family.ownerId)
    const partnerId = family.parentIds.find((parentId) => parentId !== family.ownerId)
    const partnerNode = partnerId ? positionedNodes.get(partnerId) : null

    if (ownerNode && partnerNode) {
      // Child axis follows the displayed local couple geometry (owner + projection)
      // to keep child links compact and symmetric in projection-driven rendering.
      const ownerCenterX = ownerNode.x + ownerNode.width / 2
      const partnerCenterX = partnerNode.x + partnerNode.width / 2
      const sideSign = partnerCenterX >= ownerCenterX ? 1 : -1
      const ownerToProjectionCenter = ownerNode.width / 2 + PROJECTION_HORIZONTAL_GAP + PROJECTION_NODE_WIDTH / 2
      const localCoupleMidpointX = ownerCenterX + sideSign * (ownerToProjectionCenter / 2)
      return localCoupleMidpointX / COLUMN_WIDTH
    }
  }

  const parentMidX = (leftParent.x + leftParent.width / 2 + rightParent.x + rightParent.width / 2) / 2
  return parentMidX / COLUMN_WIDTH
}

function shouldUseProjectedChildAxis(family: R3FamilyGroup, validation: ValidationResult): boolean {
  if (family.parentIds.length !== 2) {
    return false
  }

  const [firstParentId, secondParentId] = family.parentIds
  const firstParentCount = (validation.parentsByChild.get(firstParentId) ?? []).length
  const secondParentCount = (validation.parentsByChild.get(secondParentId) ?? []).length

  // Projection links are available only when both partners are biologically anchored.
  return firstParentCount > 0 && secondParentCount > 0
}

function shouldAttachSpouseToOwnerLineage(spouseId: UUID, validation: ValidationResult): boolean {
  const parentCount = (validation.parentsByChild.get(spouseId) ?? []).length

  // Keep biologically anchored partners on their own lineage branch.
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
