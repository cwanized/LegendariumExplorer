import type {
  CameraView,
  HouseDefinition,
  HouseDefinitions,
  LayoutResult,
  Person,
  PositionedNode,
  Relation,
  UUID,
  ValidationResult,
} from '../graph'
import { resolveContinuationOwner } from './continuation'
import type { Preview3HouseAnchorVerticalAlignment } from './modes'
import { comparePersonsForLayout } from '../graph'
import {
  INLINE_MARRIAGE_MAX_CENTER_Y_DELTA,
  INLINE_MARRIAGE_MAX_GAP_FACTOR,
  SPOUSE_PROJECTION_FALLBACK_COLLISION_PADDING,
  SPOUSE_PROJECTION_HORIZONTAL_GAP,
  SPOUSE_PROJECTION_NODE_HEIGHT,
  SPOUSE_PROJECTION_NODE_WIDTH,
  SPOUSE_PROJECTION_SAME_ROW_COLLISION_PADDING,
  SPOUSE_PROJECTION_VERTICAL_ANCHOR_OFFSET,
  SPOUSE_PROJECTION_VERTICAL_STEP_GAP,
} from './ruleConstants'

const PERSON_Y_OFFSET_UNIT = 72
const HOUSE_Y_OFFSET_UNIT = 170
const HOUSE_CLUSTER_GAP = 28

type RootHouseContext = {
  house: HouseDefinition
  topNodes: PositionedNode[]
  contextNodes: PositionedNode[]
}

type HouseCluster = {
  houseId: string
  displayName: string
  rootMemberIds: UUID[]
  clusterNodeIds: UUID[]
  connectorNodeIds: UUID[]
  order: number
  minX: number
  maxX: number
  minY: number
  shiftX: number
  shiftY: number
}

type ClusterPlacementScope = 'exclusive-root-corridor' | 'full-descendant-space'

const HOUSE_CLUSTER_PLACEMENT_SCOPE: ClusterPlacementScope = 'exclusive-root-corridor'

export type SpouseProjectionNode = {
  relationId: UUID
  ownerId: UUID
  companionId: UUID
  sharedChildren: UUID[]
  x: number
  y: number
  width: number
  height: number
  side: 'left' | 'right'
  isPlannedSlot?: boolean
}

type ProjectionRect = {
  x: number
  y: number
  width: number
  height: number
}

export type SpouseProjectionState = {
  hiddenChildEdgeKeys: Set<string>
  projectedMarriageIds: Set<UUID>
  nodes: SpouseProjectionNode[]
}

export type HouseAnchor = {
  houseId: string
  displayName: string
  memberIds: UUID[]
  connectorNodeIds: UUID[]
  x: number
  y: number
  width: number
  height: number
}

export type HouseAnchorDebugEntry = {
  houseId: string
  displayName: string
  rootNodeIds: UUID[]
  connectorNodeIds: UUID[]
  idealCenterX: number
  placedCenterX: number
  driftX: number
  reservedSpan: number
  clusterWidth: number
  houseYOffset: number
  anchorX: number
  anchorY: number
  anchorWidth: number
  anchorHeight: number
}

export type BiologicalChildGroup = {
  key: string
  parentIds: UUID[]
  childIds: UUID[]
  relationIds: UUID[]
  junctionX: number
  junctionY: number
  siblingY: number
  parentNodes: PositionedNode[]
  childNodes: PositionedNode[]
}

export function buildHouseAnchors(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    strategy?: 'legacy' | 'enhanced'
    applyHouseLayoutYOffset?: boolean
    houseYOffsetUnit?: number
    preserveIdealCenterX?: boolean
    verticalAlignment?: Preview3HouseAnchorVerticalAlignment
    includeLaterTiers?: boolean
  },
): HouseAnchor[] {
  const strategy = options?.strategy ?? 'enhanced'
  const applyHouseLayoutYOffset = options?.applyHouseLayoutYOffset ?? false
  const houseYOffsetUnit = options?.houseYOffsetUnit ?? PERSON_Y_OFFSET_UNIT
  const preserveIdealCenterX = options?.preserveIdealCenterX ?? false
  const verticalAlignment = options?.verticalAlignment ?? 'global-top-row'
  const includeLaterTiers = options?.includeLaterTiers ?? false
  if (strategy === 'legacy') {
    return buildLegacyHouseAnchors(validation, layout, houseDefinitions, {
      applyHouseLayoutYOffset,
      houseYOffsetUnit,
      preserveIdealCenterX,
      verticalAlignment,
      includeLaterTiers,
    })
  }

  return getRootHouseContexts(validation, layout, houseDefinitions, strategy, includeLaterTiers)
    .map(({ house, topNodes, contextNodes }) => {
      const minX = Math.min(...contextNodes.map((node) => node.x))
      const maxX = Math.max(...contextNodes.map((node) => node.x + node.width))
      const width = Math.max(140, house.displayName.length * 8 + 42)
      const centerX = (minX + maxX) / 2

      return {
        houseId: house.id,
        displayName: house.displayName,
        memberIds: topNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
        connectorNodeIds: topNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
        x: centerX - width / 2,
        y: Math.min(...topNodes.map((node) => node.y)) - 86 + (applyHouseLayoutYOffset ? (house.layout?.yOffset ?? 0) * houseYOffsetUnit : 0),
        width,
        height: 34,
      }
    })
}

export function buildHouseAnchorDebugEntries(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  houseAnchors: HouseAnchor[],
  options?: {
    strategy?: 'legacy' | 'enhanced'
    applyHouseLayoutYOffset?: boolean
    houseYOffsetUnit?: number
    includeLaterTiers?: boolean
  },
): HouseAnchorDebugEntry[] {
  const strategy = options?.strategy ?? 'enhanced'
  const applyHouseLayoutYOffset = options?.applyHouseLayoutYOffset ?? false
  const houseYOffsetUnit = options?.houseYOffsetUnit ?? PERSON_Y_OFFSET_UNIT
  const includeLaterTiers = options?.includeLaterTiers ?? false
  const houseAnchorById = new Map(houseAnchors.map((anchor) => [anchor.houseId, anchor]))

  return getRootHouseContexts(validation, layout, houseDefinitions, strategy, includeLaterTiers)
    .map(({ house, topNodes, contextNodes }) => {
      const minX = Math.min(...contextNodes.map((node) => node.x))
      const maxX = Math.max(...contextNodes.map((node) => node.x + node.width))
      const width = Math.max(140, house.displayName.length * 8 + 42)
      const idealCenterX = (minX + maxX) / 2
      const clusterWidth = maxX - minX
      const reservedSpan = Math.max(width, clusterWidth)
      const placedAnchor = houseAnchorById.get(house.id)

      if (!placedAnchor) {
        return null
      }

      const placedCenterX = placedAnchor.x + placedAnchor.width / 2

      return {
        houseId: house.id,
        displayName: house.displayName,
        rootNodeIds: topNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
        connectorNodeIds: contextNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
        idealCenterX,
        placedCenterX,
        driftX: placedCenterX - idealCenterX,
        reservedSpan,
        clusterWidth,
        houseYOffset: applyHouseLayoutYOffset ? (house.layout?.yOffset ?? 0) * houseYOffsetUnit : 0,
        anchorX: placedAnchor.x,
        anchorY: placedAnchor.y,
        anchorWidth: placedAnchor.width,
        anchorHeight: placedAnchor.height,
      }
    })
    .filter((entry): entry is HouseAnchorDebugEntry => entry !== null)
}

function buildLegacyHouseAnchors(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    applyHouseLayoutYOffset?: boolean
    houseYOffsetUnit?: number
    preserveIdealCenterX?: boolean
    verticalAlignment?: Preview3HouseAnchorVerticalAlignment
    includeLaterTiers?: boolean
  },
): HouseAnchor[] {
  const applyHouseLayoutYOffset = options?.applyHouseLayoutYOffset ?? false
  const houseYOffsetUnit = options?.houseYOffsetUnit ?? PERSON_Y_OFFSET_UNIT
  const preserveIdealCenterX = options?.preserveIdealCenterX ?? false
  const verticalAlignment = options?.verticalAlignment ?? 'global-top-row'
  const includeLaterTiers = options?.includeLaterTiers ?? false
  const groupedAnchors = getRootHouseContexts(validation, layout, houseDefinitions, 'legacy', includeLaterTiers)
    .map(({ house, topNodes, contextNodes }) => {
      const minX = Math.min(...contextNodes.map((node) => node.x))
      const maxX = Math.max(...contextNodes.map((node) => node.x + node.width))
      const width = Math.max(140, house.displayName.length * 8 + 42)
      const centerX = (minX + maxX) / 2
      const contextSpan = maxX - minX

      return {
        houseId: house.id,
        displayName: house.displayName,
        memberIds: topNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
        connectorNodeIds: topNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
        centerX,
        minY: Math.min(...topNodes.map((node) => node.y)),
        houseYOffset: applyHouseLayoutYOffset ? (house.layout?.yOffset ?? 0) * houseYOffsetUnit : 0,
        width,
        contextSpan,
        order: house.anchor.order,
      }
    })

  if (groupedAnchors.length === 0) {
    return []
  }

  const topRowY = Math.min(...groupedAnchors.map((entry) => entry.minY)) - 86
  const anchorGap = 18
  const placedAnchors: Array<{ houseId: string; displayName: string; memberIds: UUID[]; connectorNodeIds: UUID[]; centerX: number; minY: number; houseYOffset: number; width: number; contextSpan: number; order: number; x: number; placedCenterX: number }> = []

  for (const entry of groupedAnchors.slice().sort((left, right) => left.order - right.order || left.houseId.localeCompare(right.houseId) || left.centerX - right.centerX)) {
    const idealCenterX = entry.centerX
    const previous = placedAnchors.at(-1)
    const previousReservedHalfSpan = previous ? Math.max(previous.width / 2, previous.contextSpan / 2) : 0
    const currentReservedHalfSpan = Math.max(entry.width / 2, entry.contextSpan / 2)
    const minCenterX = previous
      ? previous.placedCenterX + previousReservedHalfSpan + currentReservedHalfSpan + anchorGap
      : idealCenterX
    const placedCenterX = preserveIdealCenterX ? idealCenterX : Math.max(idealCenterX, minCenterX)

    placedAnchors.push({
      ...entry,
      placedCenterX,
      x: placedCenterX - entry.width / 2,
    })
  }

  return placedAnchors.map((entry) => ({
    houseId: entry.houseId,
    displayName: entry.displayName,
    memberIds: entry.memberIds,
    connectorNodeIds: entry.connectorNodeIds,
    x: entry.x,
    y: (verticalAlignment === 'founder-top-row' ? entry.minY - 86 : topRowY) + entry.houseYOffset,
    width: entry.width,
    height: 34,
  }))
}

export function applyHouseSubtreeOffsets(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    strategy?: 'legacy' | 'enhanced'
    applyHouseLayoutYOffset?: boolean
    houseYOffsetUnit?: number
  },
): LayoutResult {
  const strategy = options?.strategy ?? 'enhanced'
  const applyHouseLayoutYOffset = options?.applyHouseLayoutYOffset ?? true
  const houseYOffsetUnit = options?.houseYOffsetUnit ?? HOUSE_Y_OFFSET_UNIT

  const clusters = buildPlacedHouseClusters(validation, layout, houseDefinitions, {
    strategy,
    applyHouseLayoutYOffset,
    houseYOffsetUnit,
  })
  const adjustedNodes = new Map(layout.nodes)
  const shiftedNodeIds = new Set<UUID>()

  for (const cluster of clusters) {
    for (const nodeId of cluster.clusterNodeIds) {
      if (shiftedNodeIds.has(nodeId)) {
        continue
      }

      const node = layout.nodes.get(nodeId)

      if (!node) {
        continue
      }

      shiftedNodeIds.add(nodeId)
      adjustedNodes.set(nodeId, {
        ...node,
        x: node.x + cluster.shiftX,
        y: node.y + cluster.shiftY,
      })
    }
  }

  return {
    nodes: adjustedNodes,
  }
}

export function resolveHouseOrderXConflicts(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    strategy?: 'legacy' | 'enhanced'
    clusterGap?: number
  },
): LayoutResult {
  const strategy = options?.strategy ?? 'enhanced'
  const clusterGap = options?.clusterGap ?? HOUSE_CLUSTER_GAP
  const rootContexts = getRootHouseContexts(validation, layout, houseDefinitions, strategy)
  const definitionLookup = buildHouseDefinitionLookup(houseDefinitions)

  if (rootContexts.length < 2) {
    return layout
  }

  const orderedContexts = rootContexts
    .map(({ house, topNodes, contextNodes }) => {
      const shiftNodes = getVisibleHouseContextNodes(topNodes.map((node) => node.id), layout, validation)
      const houseScopedShiftNodes = shiftNodes.filter((node) => {
        const person = validation.personById.get(node.id)

        if (!person) {
          return false
        }

        const primaryHouse = getPrimaryHouse(person.houses, definitionLookup)
        return primaryHouse?.id === house.id
      })
      const effectiveShiftNodes = houseScopedShiftNodes.length > 0 ? houseScopedShiftNodes : shiftNodes
      const orderBandNodes = strategy === 'legacy' ? topNodes : contextNodes

      return {
        house,
        nodeIds: effectiveShiftNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
        minX: Math.min(...orderBandNodes.map((node) => node.x)),
        maxX: Math.max(...orderBandNodes.map((node) => node.x + node.width)),
      }
    })
    .sort((left, right) => left.house.anchor.order - right.house.anchor.order || left.house.id.localeCompare(right.house.id))

  const adjustedNodes = new Map(layout.nodes)
  const shiftedNodeIds = new Set<UUID>()
  let previousRightEdge = Number.NEGATIVE_INFINITY

  for (const context of orderedContexts) {
    const requiredMinX = Number.isFinite(previousRightEdge)
      ? previousRightEdge + clusterGap
      : context.minX
    const shiftX = Math.max(0, requiredMinX - context.minX)

    for (const nodeId of context.nodeIds) {
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
        x: currentNode.x + shiftX,
      })
    }

    previousRightEdge = context.maxX + shiftX
  }

  return {
    nodes: adjustedNodes,
  }
}

function buildHouseDefinitionLookup(houseDefinitions: HouseDefinitions) {
  const lookup = new Map<string, HouseDefinition>()

  for (const house of houseDefinitions.houses) {
    lookup.set(normalizeHouseKey(house.id), house)
    lookup.set(normalizeHouseKey(house.displayName), house)

    for (const alias of house.aliases ?? []) {
      lookup.set(normalizeHouseKey(alias), house)
    }
  }

  return lookup
}

function getPrimaryHouse(houses: string[] | undefined, lookup: Map<string, HouseDefinition>): HouseDefinition | null {
  for (const candidate of houses ?? []) {
    const house = lookup.get(normalizeHouseKey(candidate))

    if (house) {
      return house
    }
  }

  return null
}

function getVisibleHouseContextNodes(rootIds: UUID[], layout: LayoutResult, validation: ValidationResult) {
  const collectedNodeIds = new Set<UUID>()
  const queue = [...rootIds]

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId || collectedNodeIds.has(currentId)) {
      continue
    }

    collectedNodeIds.add(currentId)

    for (const childId of validation.childrenByParent.get(currentId) ?? []) {
      queue.push(childId)
    }
  }

  return Array.from(collectedNodeIds)
    .map((nodeId) => layout.nodes.get(nodeId))
    .filter((node): node is PositionedNode => node !== undefined)
}

function getRootHouseContexts(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  strategy: 'legacy' | 'enhanced',
  includeLaterTiers: boolean = false,
): RootHouseContext[] {
  const definitionLookup = buildHouseDefinitionLookup(houseDefinitions)
  const anchorableDefinitions = houseDefinitions.houses
    .filter((house) => house.anchor.enabled && (house.tier === 'start' || includeLaterTiers))
    .sort((left, right) => left.anchor.order - right.anchor.order || left.id.localeCompare(right.id))

  const houseMembers = new Map<string, UUID[]>()

  for (const person of validation.persons) {
    const primaryHouse = getPrimaryHouse(person.houses, definitionLookup)

    if (!primaryHouse || !primaryHouse.anchor.enabled || (primaryHouse.tier !== 'start' && !includeLaterTiers)) {
      continue
    }

    const currentMembers = houseMembers.get(primaryHouse.id) ?? []
    currentMembers.push(person.id)
    currentMembers.sort((left, right) => left.localeCompare(right))
    houseMembers.set(primaryHouse.id, currentMembers)
  }

  return anchorableDefinitions
    .map((house) => {
      const memberIds = houseMembers.get(house.id) ?? []
      const nodes = memberIds
        .map((memberId) => layout.nodes.get(memberId))
        .filter((node): node is PositionedNode => node !== undefined)

      if (nodes.length === 0) {
        return null
      }

      const minY = Math.min(...nodes.map((node) => node.y))
      const topNodes = nodes.filter((node) => Math.abs(node.y - minY) < 1)
      const contextNodes = strategy === 'legacy'
        ? topNodes
        : getVisibleHouseContextNodes(topNodes.map((node) => node.id), layout, validation)

      return {
        house,
        topNodes,
        contextNodes,
      }
    })
    .filter((entry): entry is RootHouseContext => entry !== null)
}

function buildPlacedHouseClusters(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    strategy?: 'legacy' | 'enhanced'
    applyHouseLayoutYOffset?: boolean
    houseYOffsetUnit?: number
  },
): HouseCluster[] {
  const strategy = options?.strategy ?? 'enhanced'
  const rootContexts = getRootHouseContexts(validation, layout, houseDefinitions, strategy)
  const applyHouseLayoutYOffset = options?.applyHouseLayoutYOffset ?? true
  const houseYOffsetUnit = options?.houseYOffsetUnit ?? HOUSE_Y_OFFSET_UNIT
  const sharedRootBaselineY = rootContexts.length > 0
    ? Math.min(...rootContexts.map(({ topNodes }) => Math.min(...topNodes.map((node) => node.y))))
    : 0

  const clusters = rootContexts
    .map(({ house, topNodes, contextNodes }) => {
      const placementNodes = HOUSE_CLUSTER_PLACEMENT_SCOPE === 'exclusive-root-corridor'
        ? topNodes
        : contextNodes
      const minY = Math.min(...topNodes.map((node) => node.y))

      const baselineY = strategy === 'enhanced' ? sharedRootBaselineY : minY
      const targetRootBandY = applyHouseLayoutYOffset
        ? baselineY + (house.layout?.yOffset ?? 0) * houseYOffsetUnit
        : baselineY

      return {
      houseId: house.id,
      displayName: house.displayName,
      rootMemberIds: topNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
      clusterNodeIds: contextNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
      connectorNodeIds: contextNodes.map((node) => node.id).sort((left, right) => left.localeCompare(right)),
      order: house.anchor.order,
      minX: Math.min(...placementNodes.map((node) => node.x)),
      maxX: Math.max(...placementNodes.map((node) => node.x + node.width)),
      minY,
      shiftX: 0,
        shiftY: targetRootBandY - minY,
      }
    })
    .sort((left, right) => ((left.minX + left.maxX) / 2) - ((right.minX + right.maxX) / 2) || left.order - right.order || left.displayName.localeCompare(right.displayName))

  const placed: HouseCluster[] = []

  for (const cluster of clusters) {
    const previous = placed.at(-1)
    const minimumMinX = previous ? previous.maxX + previous.shiftX + HOUSE_CLUSTER_GAP : cluster.minX
    const shiftX = Math.max(0, minimumMinX - cluster.minX)

    placed.push({
      ...cluster,
      shiftX,
    })
  }

  return placed
}

function normalizeHouseKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function buildBiologicalChildGroups(relations: Relation[], layout: LayoutResult): BiologicalChildGroup[] {
  const relationsByChild = new Map<UUID, Relation[]>()

  for (const relation of relations) {
    const childRelations = relationsByChild.get(relation.to) ?? []
    childRelations.push(relation)
    childRelations.sort((left, right) => left.id.localeCompare(right.id))
    relationsByChild.set(relation.to, childRelations)
  }

  const groupedChildren = new Map<string, { parentIds: UUID[]; childIds: UUID[]; relationIds: UUID[] }>()

  for (const [childId, childRelations] of relationsByChild) {
    const parentIds = childRelations.map((relation) => relation.from).sort((left, right) => left.localeCompare(right))
    const groupKey = parentIds.join('|')
    const existingGroup = groupedChildren.get(groupKey)

    if (existingGroup) {
      existingGroup.childIds.push(childId)
      existingGroup.childIds.sort((left, right) => left.localeCompare(right))
      existingGroup.relationIds.push(...childRelations.map((relation) => relation.id))
      existingGroup.relationIds.sort((left, right) => left.localeCompare(right))
      continue
    }

    groupedChildren.set(groupKey, {
      parentIds,
      childIds: [childId],
      relationIds: childRelations.map((relation) => relation.id).sort((left, right) => left.localeCompare(right)),
    })
  }

  return Array.from(groupedChildren.entries())
    .map(([groupKey, group]) => {
      const parentNodes = group.parentIds
        .map((parentId) => layout.nodes.get(parentId))
        .filter((node): node is PositionedNode => node !== undefined)
        .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
      const childNodes = group.childIds
        .map((childId) => layout.nodes.get(childId))
        .filter((node): node is PositionedNode => node !== undefined)
        .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))

      if (parentNodes.length === 0 || childNodes.length === 0) {
        return null
      }

      const parentCenters = parentNodes.map((node) => node.x + node.width / 2)
      const childTopY = Math.min(...childNodes.map((node) => node.y))
      const parentBottomY = Math.max(...parentNodes.map((node) => node.y + node.height))
      const gap = Math.max(childTopY - parentBottomY, 36)
      const junctionY = parentBottomY + Math.min(Math.max(gap * 0.22, 18), 34)
      const siblingY = Math.max(junctionY + 18, childTopY - 20)

      return {
        key: groupKey,
        parentIds: group.parentIds,
        childIds: group.childIds,
        relationIds: group.relationIds,
        junctionX: parentCenters.length === 1 ? parentCenters[0] : (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2,
        junctionY,
        siblingY,
        parentNodes,
        childNodes,
      }
    })
    .filter((group): group is BiologicalChildGroup => group !== null)
    .sort((left, right) => left.junctionY - right.junctionY || left.key.localeCompare(right.key))
}

export function applyCuratedPersonOrder(layout: LayoutResult, persons: Person[]): LayoutResult {
  const personById = new Map(persons.map((person) => [person.id, person]))
  const nodesByBand = new Map<number, PositionedNode[]>()

  for (const node of layout.nodes.values()) {
    const bandKey = Math.round(node.y)
    const bandNodes = nodesByBand.get(bandKey) ?? []
    bandNodes.push(node)
    nodesByBand.set(bandKey, bandNodes)
  }

  const adjustedNodes = new Map(layout.nodes)

  for (const bandNodes of nodesByBand.values()) {
    if (bandNodes.length < 2) {
      continue
    }

    const sortedByX = [...bandNodes].sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
    const orderedNodes = [...bandNodes].sort((left, right) => {
      const leftPerson = personById.get(left.id)
      const rightPerson = personById.get(right.id)

      if (!leftPerson || !rightPerson) {
        return left.id.localeCompare(right.id)
      }

      return comparePersonsForLayout(leftPerson, rightPerson)
    })

    sortedByX.forEach((slotNode, index) => {
      const orderedNode = orderedNodes[index]

      adjustedNodes.set(orderedNode.id, {
        ...orderedNode,
        x: slotNode.x,
      })
    })
  }

  return { nodes: adjustedNodes }
}

export function applyCuratedPersonOffsets(layout: LayoutResult, persons: Person[]): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)

  for (const person of persons) {
    const yOffset = person.metadata?.layout?.yOffset ?? 0

    if (yOffset === 0) {
      continue
    }

    const currentNode = adjustedNodes.get(person.id)

    if (!currentNode) {
      continue
    }

    adjustedNodes.set(person.id, {
      ...currentNode,
      y: currentNode.y + yOffset * PERSON_Y_OFFSET_UNIT,
    })
  }

  return { nodes: adjustedNodes }
}

export function resolveHorizontalNodeOverlaps(
  layout: LayoutResult,
  options?: {
    minimumGap?: number
    rowQuantization?: number
  },
): LayoutResult {
  const minimumGap = options?.minimumGap ?? 20
  const rowQuantization = options?.rowQuantization ?? 8
  const adjustedNodes = new Map(layout.nodes)
  const rows = new Map<number, PositionedNode[]>()

  for (const node of layout.nodes.values()) {
    const rowKey = Math.round(node.y / rowQuantization)
    const row = rows.get(rowKey) ?? []
    row.push(node)
    rows.set(rowKey, row)
  }

  for (const rowNodes of rows.values()) {
    const sorted = [...rowNodes].sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
    let previousRight = Number.NEGATIVE_INFINITY

    for (const node of sorted) {
      const current = adjustedNodes.get(node.id)

      if (!current) {
        continue
      }

      const requiredX = previousRight + minimumGap
      const nextX = Math.max(current.x, requiredX)

      adjustedNodes.set(node.id, {
        ...current,
        x: nextX,
      })

      previousRight = nextX + current.width
    }
  }

  return { nodes: adjustedNodes }
}

export function resolveNodeCollisions2D(
  layout: LayoutResult,
  options?: {
    minimumGap?: number
    maxIterations?: number
    rasterColumnStep?: number
    rasterColumnOrigin?: number
  },
): LayoutResult {
  const minimumGap = options?.minimumGap ?? 20
  const maxIterations = options?.maxIterations ?? 6
  const rasterColumnStep = options?.rasterColumnStep
  const rasterColumnOrigin = options?.rasterColumnOrigin ?? 0
  const adjustedNodes = new Map(layout.nodes)

  const snapToRaster = (value: number): number => {
    if (!Number.isFinite(value) || rasterColumnStep === undefined || rasterColumnStep <= 0) {
      return value
    }

    return rasterColumnOrigin + Math.round((value - rasterColumnOrigin) / rasterColumnStep) * rasterColumnStep
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let moved = false
    const nodes = [...adjustedNodes.values()].sort((left, right) => left.x - right.x || left.y - right.y || left.id.localeCompare(right.id))

    for (let index = 0; index < nodes.length; index += 1) {
      const leftNode = nodes[index]

      for (let innerIndex = index + 1; innerIndex < nodes.length; innerIndex += 1) {
        const rightNode = nodes[innerIndex]
        const leftCurrent = adjustedNodes.get(leftNode.id)
        const rightCurrent = adjustedNodes.get(rightNode.id)
        if (!leftCurrent || !rightCurrent) {
          continue
        }

        const overlapY = Math.min(leftCurrent.y + leftCurrent.height, rightCurrent.y + rightCurrent.height) - Math.max(leftCurrent.y, rightCurrent.y)
        if (overlapY <= 0) {
          continue
        }

        const requiredRightX = snapToRaster(leftCurrent.x + leftCurrent.width + minimumGap)
        if (rightCurrent.x >= requiredRightX) {
          continue
        }

        moved = true
        adjustedNodes.set(rightCurrent.id, {
          ...rightCurrent,
          x: requiredRightX,
        })
      }
    }

    if (!moved) {
      break
    }
  }

  return { nodes: adjustedNodes }
}

export function scaleLayoutX(layout: LayoutResult, factor: number): LayoutResult {
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.001) {
    return layout
  }

  const nodes = Array.from(layout.nodes.values())

  if (nodes.length === 0) {
    return layout
  }

  const minX = Math.min(...nodes.map((node) => node.x))
  const maxX = Math.max(...nodes.map((node) => node.x + node.width))
  const centerX = (minX + maxX) / 2
  const adjustedNodes = new Map(layout.nodes)

  for (const node of nodes) {
    const nodeCenterX = node.x + node.width / 2
    const scaledCenterX = centerX + (nodeCenterX - centerX) * factor
    adjustedNodes.set(node.id, {
      ...node,
      x: scaledCenterX - node.width / 2,
    })
  }

  return { nodes: adjustedNodes }
}

export function scaleLayoutY(layout: LayoutResult, factor: number): LayoutResult {
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.001) {
    return layout
  }

  const nodes = Array.from(layout.nodes.values())

  if (nodes.length === 0) {
    return layout
  }

  const minY = Math.min(...nodes.map((node) => node.y))
  const maxY = Math.max(...nodes.map((node) => node.y + node.height))
  const centerY = (minY + maxY) / 2
  const adjustedNodes = new Map(layout.nodes)

  for (const node of nodes) {
    const nodeCenterY = node.y + node.height / 2
    const scaledCenterY = centerY + (nodeCenterY - centerY) * factor
    adjustedNodes.set(node.id, {
      ...node,
      y: scaledCenterY - node.height / 2,
    })
  }

  return { nodes: adjustedNodes }
}

export function packDisconnectedComponents(
  layout: LayoutResult,
  relations: Relation[],
  options?: {
    columnGap?: number
    rowGap?: number
    targetRowWidth?: number
  },
): LayoutResult {
  const nodes = Array.from(layout.nodes.values())

  if (nodes.length < 2) {
    return layout
  }

  const columnGap = options?.columnGap ?? 120
  const rowGap = options?.rowGap ?? 140
  const adjacency = new Map<UUID, Set<UUID>>()

  for (const node of nodes) {
    adjacency.set(node.id, new Set<UUID>())
  }

  for (const relation of relations) {
    if (!adjacency.has(relation.from) || !adjacency.has(relation.to)) {
      continue
    }

    adjacency.get(relation.from)?.add(relation.to)
    adjacency.get(relation.to)?.add(relation.from)
  }

  const visited = new Set<UUID>()
  const components: Array<{ ids: UUID[]; minX: number; maxX: number; minY: number; maxY: number; width: number; height: number }> = []

  for (const node of nodes.slice().sort((left, right) => left.x - right.x || left.y - right.y || left.id.localeCompare(right.id))) {
    if (visited.has(node.id)) {
      continue
    }

    const queue: UUID[] = [node.id]
    const ids: UUID[] = []
    visited.add(node.id)

    while (queue.length > 0) {
      const currentId = queue.shift()

      if (!currentId) {
        continue
      }

      ids.push(currentId)

      for (const neighborId of adjacency.get(currentId) ?? []) {
        if (visited.has(neighborId)) {
          continue
        }

        visited.add(neighborId)
        queue.push(neighborId)
      }
    }

    const componentNodes = ids.map((id) => layout.nodes.get(id)).filter((entry): entry is PositionedNode => entry !== undefined)
    const minX = Math.min(...componentNodes.map((entry) => entry.x))
    const maxX = Math.max(...componentNodes.map((entry) => entry.x + entry.width))
    const minY = Math.min(...componentNodes.map((entry) => entry.y))
    const maxY = Math.max(...componentNodes.map((entry) => entry.y + entry.height))

    components.push({
      ids: ids.slice().sort((left, right) => left.localeCompare(right)),
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    })
  }

  if (components.length < 2) {
    return layout
  }

  const totalArea = components.reduce((sum, component) => sum + component.width * component.height, 0)
  const targetRowWidth = options?.targetRowWidth ?? Math.max(2200, Math.sqrt(totalArea) * 1.6)
  const adjustedNodes = new Map(layout.nodes)

  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0

  const orderedComponents = components
    .slice()
    .sort((left, right) => left.minY - right.minY || left.minX - right.minX || left.ids[0].localeCompare(right.ids[0]))

  for (const component of orderedComponents) {
    if (cursorX > 0 && cursorX + component.width > targetRowWidth) {
      cursorX = 0
      cursorY += rowHeight + rowGap
      rowHeight = 0
    }

    const shiftX = cursorX - component.minX
    const shiftY = cursorY - component.minY

    for (const nodeId of component.ids) {
      const node = adjustedNodes.get(nodeId)

      if (!node) {
        continue
      }

      adjustedNodes.set(nodeId, {
        ...node,
        x: node.x + shiftX,
        y: node.y + shiftY,
      })
    }

    cursorX += component.width + columnGap
    rowHeight = Math.max(rowHeight, component.height)
  }

  return { nodes: adjustedNodes }
}

export function getSingleChildCenterTargets(layout: LayoutResult, relations: Relation[]): Map<UUID, number> {
  const centerTargets = new Map<UUID, number>()
  const groupedChildren = buildBiologicalChildGroups(relations, layout)

  for (const group of groupedChildren) {
    if (group.parentIds.length < 2 || group.childIds.length !== 1) {
      continue
    }

    centerTargets.set(group.childIds[0], group.junctionX)
  }

  return centerTargets
}

export function alignSingleChildNodes(layout: LayoutResult, centerTargets: Map<UUID, number>): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)

  for (const [childId, centerX] of centerTargets) {
    const currentNode = adjustedNodes.get(childId)

    if (!currentNode) {
      continue
    }

    adjustedNodes.set(childId, {
      ...currentNode,
      x: centerX - currentNode.width / 2,
    })
  }

  return { nodes: adjustedNodes }
}

export function alignSingleParentChildGroups(layout: LayoutResult, relations: Relation[], overlayRelations: Relation[] = []): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const groups = buildBiologicalChildGroups(relations, layout)
  const spouseIdsByPerson = new Map<UUID, Set<UUID>>()

  for (const relation of overlayRelations) {
    if (relation.type !== 'marriage') {
      continue
    }

    const fromPartners = spouseIdsByPerson.get(relation.from) ?? new Set<UUID>()
    fromPartners.add(relation.to)
    spouseIdsByPerson.set(relation.from, fromPartners)

    const toPartners = spouseIdsByPerson.get(relation.to) ?? new Set<UUID>()
    toPartners.add(relation.from)
    spouseIdsByPerson.set(relation.to, toPartners)
  }

  for (const group of groups) {
    if (group.parentIds.length !== 1 || group.childNodes.length < 2) {
      continue
    }

    const parentNode = adjustedNodes.get(group.parentIds[0])

    if (!parentNode) {
      continue
    }

    const anchorCenterX = parentNode.x + parentNode.width / 2

    const childSet = new Set(group.childIds)
    const childNodes = group.childIds
      .map((childId) => adjustedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)

    const internalMarriagePartners = new Map<UUID, Set<UUID>>()
    for (const relation of overlayRelations) {
      if (relation.type !== 'marriage') {
        continue
      }

      if (!childSet.has(relation.from) || !childSet.has(relation.to)) {
        continue
      }

      const fromPartners = internalMarriagePartners.get(relation.from) ?? new Set<UUID>()
      fromPartners.add(relation.to)
      internalMarriagePartners.set(relation.from, fromPartners)

      const toPartners = internalMarriagePartners.get(relation.to) ?? new Set<UUID>()
      toPartners.add(relation.from)
      internalMarriagePartners.set(relation.to, toPartners)
    }

    const childNodeById = new Map(childNodes.map((node) => [node.id, node]))
    const visitedChildIds = new Set<UUID>()
    const childBlocks: PositionedNode[][] = []

    for (const childId of group.childIds) {
      if (visitedChildIds.has(childId)) {
        continue
      }

      const stack = [childId]
      const blockIds: UUID[] = []

      while (stack.length > 0) {
        const currentId = stack.pop()

        if (!currentId || visitedChildIds.has(currentId)) {
          continue
        }

        visitedChildIds.add(currentId)
        blockIds.push(currentId)

        const partners = internalMarriagePartners.get(currentId)
        if (!partners) {
          continue
        }

        for (const partnerId of partners) {
          if (!visitedChildIds.has(partnerId)) {
            stack.push(partnerId)
          }
        }
      }

      const blockNodes = blockIds
        .map((id) => childNodeById.get(id))
        .filter((node): node is PositionedNode => node !== undefined)
        .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))

      if (blockNodes.length > 0) {
        childBlocks.push(blockNodes)
      }
    }

    const orderedBlocks = childBlocks
      .sort((leftBlock, rightBlock) => {
        const leftCenter = leftBlock.reduce((sum, node) => sum + node.x + node.width / 2, 0) / leftBlock.length
        const rightCenter = rightBlock.reduce((sum, node) => sum + node.x + node.width / 2, 0) / rightBlock.length
        return leftCenter - rightCenter || leftBlock[0].id.localeCompare(rightBlock[0].id)
      })

    const sortedChildren = orderedBlocks.flat()

    if (sortedChildren.length < 2 || orderedBlocks.length === 0) {
      continue
    }

    const hasExternalPartner = (nodeId: UUID): boolean => {
      const partners = spouseIdsByPerson.get(nodeId)
      return partners ? [...partners].some((partnerId) => !childSet.has(partnerId)) : false
    }

    const maxWidth = sortedChildren.reduce((max, childNode) => Math.max(max, childNode.width), 0)
    const currentBlockCenters = orderedBlocks.map((block) => block.reduce((sum, node) => sum + node.x + node.width / 2, 0) / block.length)
    const currentBlockSteps: number[] = []

    for (let index = 1; index < currentBlockCenters.length; index += 1) {
      currentBlockSteps.push(currentBlockCenters[index] - currentBlockCenters[index - 1])
    }

    const averageBlockStep = currentBlockSteps.length > 0
      ? currentBlockSteps.reduce((sum, step) => sum + step, 0) / currentBlockSteps.length
      : 0
    const slotGap = 60
    const marriageGap = 40
    const partnerSpacingBoost = 28
    const interBlockGapBase = Math.max(slotGap, averageBlockStep - maxWidth)

    const blockLayouts = orderedBlocks.map((block) => {
      const blockWidth = block.reduce((sum, node) => sum + node.width, 0) + marriageGap * Math.max(0, block.length - 1)
      const leftNode = block[0]
      const rightNode = block[block.length - 1]

      return {
        nodes: block,
        width: blockWidth,
        leftNeedsPartnerSpace: hasExternalPartner(leftNode.id),
        rightNeedsPartnerSpace: hasExternalPartner(rightNode.id),
      }
    })

    const blockGaps: number[] = []
    for (let index = 0; index < blockLayouts.length - 1; index += 1) {
      const leftBlock = blockLayouts[index]
      const rightBlock = blockLayouts[index + 1]
      const needsBoost = leftBlock.rightNeedsPartnerSpace || rightBlock.leftNeedsPartnerSpace
      blockGaps.push(interBlockGapBase + (needsBoost ? partnerSpacingBoost : 0))
    }

    const totalWidth = blockLayouts.reduce((sum, block) => sum + block.width, 0)
    const totalGap = blockGaps.reduce((sum, gap) => sum + gap, 0)
    let cursorX = anchorCenterX - (totalWidth + totalGap) / 2

    blockLayouts.forEach((block, blockIndex) => {
      let nodeX = cursorX

      block.nodes.forEach((node) => {
        const currentNode = adjustedNodes.get(node.id)

        if (!currentNode) {
          return
        }

        adjustedNodes.set(node.id, {
          ...currentNode,
          x: nodeX,
        })

        nodeX += currentNode.width + marriageGap
      })

      cursorX += block.width + (blockGaps[blockIndex] ?? 0)
    })

  }

  return { nodes: adjustedNodes }
}

export function alignSingleParentSingleChildNodes(layout: LayoutResult, relations: Relation[]): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const groups = buildBiologicalChildGroups(relations, layout)

  for (const group of groups) {
    if (group.parentIds.length !== 1 || group.childNodes.length !== 1) {
      continue
    }

    const parentNode = adjustedNodes.get(group.parentIds[0])
    const childNode = adjustedNodes.get(group.childNodes[0].id)

    if (!parentNode || !childNode) {
      continue
    }

    const parentCenterX = parentNode.x + parentNode.width / 2
    adjustedNodes.set(childNode.id, {
      ...childNode,
      x: parentCenterX - childNode.width / 2,
    })
  }

  return { nodes: adjustedNodes }
}

export function enforceBiologicalFamilyAxes(
  layout: LayoutResult,
  relations: Relation[],
  options?: {
    maxParentCount?: number
    maxIterations?: number
    epsilon?: number
    targetCoupleGap?: number
  },
): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const maxParentCount = options?.maxParentCount ?? 2
  const maxIterations = options?.maxIterations ?? 8
  const epsilon = options?.epsilon ?? 0.01
  const targetCoupleGap = options?.targetCoupleGap ?? 20
  const biologicalDegree = buildBiologicalDegreeMap(relations)

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false
    const groups = buildBiologicalChildGroups(relations, { nodes: adjustedNodes })

    for (const group of groups) {
      if (group.parentIds.length < 1 || group.parentIds.length > maxParentCount || group.childIds.length < 1) {
        continue
      }

      const parentNodes = group.parentIds
        .map((parentId) => adjustedNodes.get(parentId))
        .filter((node): node is PositionedNode => node !== undefined)
      const childNodes = group.childIds
        .map((childId) => adjustedNodes.get(childId))
        .filter((node): node is PositionedNode => node !== undefined)

      if (parentNodes.length !== group.parentIds.length || childNodes.length !== group.childIds.length) {
        continue
      }

      const parentCenters = parentNodes.map((node) => node.x + node.width / 2)
      const childCenters = childNodes.map((node) => node.x + node.width / 2)
      const parentAxisX = parentCenters.length === 1
        ? parentCenters[0]
        : (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2
      const childAxisX = childCenters.length === 1
        ? childCenters[0]
        : (Math.min(...childCenters) + Math.max(...childCenters)) / 2
      const deltaX = parentAxisX - childAxisX

      if (Math.abs(deltaX) <= epsilon) {
        continue
      }

      changed = true

      if (parentNodes.length === 1 && childNodes.length === 1) {
        const parentNode = parentNodes[0]
        const childNode = childNodes[0]
        const parentDegree = biologicalDegree.get(parentNode.id) ?? 0
        const childDegree = biologicalDegree.get(childNode.id) ?? 0
        const moveParent = parentDegree < childDegree

        adjustedNodes.set(moveParent ? parentNode.id : childNode.id, {
          ...(moveParent ? parentNode : childNode),
          x: (moveParent ? parentNode.x : childNode.x) + (moveParent ? -deltaX : deltaX),
        })
        continue
      }

      if (parentNodes.length === 2) {
        const [leftParentNode, rightParentNode] = orderCoupleNodes(parentNodes[0], parentNodes[1])
        const currentGap = rightParentNode.x - (leftParentNode.x + leftParentNode.width)
        const pairChanged = Math.abs(deltaX) > epsilon || currentGap > targetCoupleGap + epsilon

        if (!pairChanged) {
          continue
        }

        changed = true
        compactCoupleOnAxis(adjustedNodes, leftParentNode, rightParentNode, childAxisX, targetCoupleGap)
        continue
      }

      const parentShiftX = -deltaX * 0.5
      const childShiftX = deltaX * 0.5

      for (const parentNode of parentNodes) {
        adjustedNodes.set(parentNode.id, {
          ...parentNode,
          x: parentNode.x + parentShiftX,
        })
      }

      for (const childNode of childNodes) {
        adjustedNodes.set(childNode.id, {
          ...childNode,
          x: childNode.x + childShiftX,
        })
      }
    }

    if (!changed) {
      break
    }
  }

  return { nodes: adjustedNodes }
}

export function recenterMultiChildGroups(layout: LayoutResult, relations: Relation[]): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const groups = buildBiologicalChildGroups(relations, layout)

  for (const group of groups) {
    if (group.childIds.length < 2) {
      continue
    }

    const parentNodes = group.parentIds
      .map((parentId) => adjustedNodes.get(parentId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (parentNodes.length === 0) {
      continue
    }

    const childNodes = group.childIds
      .map((childId) => adjustedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (childNodes.length < 2) {
      continue
    }

    const anchorX = parentNodes.length === 1
      ? parentNodes[0].x + parentNodes[0].width / 2
      : (Math.min(...parentNodes.map((node) => node.x + node.width / 2)) + Math.max(...parentNodes.map((node) => node.x + node.width / 2))) / 2
    const childCenters = childNodes.map((node) => node.x + node.width / 2)
    const childMidpointX = (Math.min(...childCenters) + Math.max(...childCenters)) / 2
    const deltaX = anchorX - childMidpointX

    if (Math.abs(deltaX) < 0.5) {
      continue
    }

    for (const childNode of childNodes) {
      adjustedNodes.set(childNode.id, {
        ...childNode,
        x: childNode.x + deltaX,
      })
    }
  }

  return { nodes: adjustedNodes }
}

export function symmetrizeChildGroups(
  layout: LayoutResult,
  relations: Relation[],
  overlayRelations: Relation[] = [],
): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const groups = buildBiologicalChildGroups(relations, layout)
  const minimumGap = 20
  const spouseByPersonId = new Map<UUID, UUID>()

  for (const relation of overlayRelations.filter((candidate) => candidate.type === 'marriage')) {
    spouseByPersonId.set(relation.from, relation.to)
    spouseByPersonId.set(relation.to, relation.from)
  }

  for (const group of groups) {
    if (group.childIds.length === 0) {
      continue
    }

    const parentNodes = group.parentIds
      .map((parentId) => adjustedNodes.get(parentId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (parentNodes.length === 0) {
      continue
    }

    const childNodes = group.childIds
      .map((childId) => adjustedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)
      .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))

    if (childNodes.length === 0) {
      continue
    }

    const anchorX = parentNodes.length === 1
      ? parentNodes[0].x + parentNodes[0].width / 2
      : (Math.min(...parentNodes.map((node) => node.x + node.width / 2)) + Math.max(...parentNodes.map((node) => node.x + node.width / 2))) / 2

    const childCenters = childNodes
      .map((node) => node.x + node.width / 2)
      .sort((left, right) => left - right)
    const measuredCenterGaps: number[] = []
    for (let index = 1; index < childCenters.length; index += 1) {
      measuredCenterGaps.push(childCenters[index] - childCenters[index - 1])
    }

    const sortedCenterGaps = measuredCenterGaps
      .map((gap) => Math.max(gap, minimumGap))
      .sort((left, right) => left - right)
    const medianCenterGap = sortedCenterGaps.length === 0
      ? minimumGap
      : sortedCenterGaps[Math.floor(sortedCenterGaps.length / 2)]

    const minimumRequiredCenterGap = childNodes.slice(1).reduce((maxGap, currentNode, index) => {
      const previousNode = childNodes[index]
      const requiredGap = previousNode.width / 2 + currentNode.width / 2 + minimumGap
      return Math.max(maxGap, requiredGap)
    }, minimumGap)
    const centerStep = Math.max(medianCenterGap, minimumRequiredCenterGap)
    const firstCenterX = anchorX - centerStep * ((childNodes.length - 1) / 2)

    childNodes.forEach((childNode, index) => {
      if (childNodes.length === 1) {
        const spouseId = spouseByPersonId.get(childNode.id)
        const spouseNode = spouseId ? adjustedNodes.get(spouseId) : undefined

        if (spouseNode) {
          centerCoupleOnAxis(adjustedNodes, childNode, spouseNode, anchorX, minimumGap)
          return
        }
      }

      const targetCenterX = firstCenterX + index * centerStep
      const targetX = targetCenterX - childNode.width / 2

      adjustedNodes.set(childNode.id, {
        ...childNode,
        x: targetX,
      })
    })
  }

  return { nodes: adjustedNodes }
}

export function alignMarriagePairsToFamilyAxis(
  layout: LayoutResult,
  biologicalRelations: Relation[],
  overlayRelations: Relation[],
): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const minimumGap = 20
  const parentIdsByChild = new Map<UUID, UUID[]>()

  for (const relation of biologicalRelations.filter((candidate) => candidate.type === 'biological_parent')) {
    const parentIds = parentIdsByChild.get(relation.to) ?? []
    parentIds.push(relation.from)
    parentIds.sort((left, right) => left.localeCompare(right))
    parentIdsByChild.set(relation.to, parentIds)
  }

  const marriages = overlayRelations
    .filter((relation) => relation.type === 'marriage')
    .sort((left, right) => left.id.localeCompare(right.id))

  for (const marriage of marriages) {
    const firstNode = adjustedNodes.get(marriage.from)
    const secondNode = adjustedNodes.get(marriage.to)

    if (!firstNode || !secondNode) {
      continue
    }

    const candidateAxes: number[] = []
    for (const node of [firstNode, secondNode]) {
      const parentIds = parentIdsByChild.get(node.id) ?? []
      if (parentIds.length === 0) {
        continue
      }

      const parentNodes = parentIds
        .map((parentId) => adjustedNodes.get(parentId))
        .filter((parentNode): parentNode is PositionedNode => parentNode !== undefined)

      if (parentNodes.length !== parentIds.length) {
        continue
      }

      const parentCenters = parentNodes.map((parentNode) => parentNode.x + parentNode.width / 2)
      candidateAxes.push((Math.min(...parentCenters) + Math.max(...parentCenters)) / 2)
    }

    if (candidateAxes.length === 0) {
      continue
    }

    const axisX = candidateAxes.reduce((sum, axis) => sum + axis, 0) / candidateAxes.length
    centerCoupleOnAxis(adjustedNodes, firstNode, secondNode, axisX, minimumGap)
  }

  return { nodes: adjustedNodes }
}

export function alignTwoParentPairsToChildAxis(
  layout: LayoutResult,
  relations: Relation[],
  overlayRelations: Relation[],
  options?: {
    maxShiftX?: number
    requireMarriage?: boolean
    maxAncestorDriftX?: number
  },
): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const groups = buildBiologicalChildGroups(relations, { nodes: adjustedNodes })
  const minimumGap = 20
  const maxShiftX = options?.maxShiftX ?? Number.POSITIVE_INFINITY
  const requireMarriage = options?.requireMarriage ?? true
  const maxAncestorDriftX = options?.maxAncestorDriftX
  const marriedPairKeys = new Set<string>()
  const parentIdsByChild = new Map<UUID, UUID[]>()

  for (const relation of relations.filter((candidate) => candidate.type === 'biological_parent')) {
    const parentIds = parentIdsByChild.get(relation.to) ?? []
    parentIds.push(relation.from)
    parentIds.sort((left, right) => left.localeCompare(right))
    parentIdsByChild.set(relation.to, parentIds)
  }

  for (const relation of overlayRelations.filter((candidate) => candidate.type === 'marriage')) {
    const left = relation.from < relation.to ? relation.from : relation.to
    const right = relation.from < relation.to ? relation.to : relation.from
    marriedPairKeys.add(`${left}|${right}`)
  }

  for (const group of groups) {
    if (group.parentIds.length !== 2) {
      continue
    }

    const [firstParentId, secondParentId] = group.parentIds
    const leftParentId = firstParentId < secondParentId ? firstParentId : secondParentId
    const rightParentId = firstParentId < secondParentId ? secondParentId : firstParentId
    const pairKey = `${leftParentId}|${rightParentId}`

    if (requireMarriage && !marriedPairKeys.has(pairKey)) {
      continue
    }

    const firstParentNode = adjustedNodes.get(firstParentId)
    const secondParentNode = adjustedNodes.get(secondParentId)
    if (!firstParentNode || !secondParentNode) {
      continue
    }

    const childNodes = group.childIds
      .map((childId) => adjustedNodes.get(childId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (childNodes.length === 0) {
      continue
    }

    const childCenters = childNodes.map((childNode) => childNode.x + childNode.width / 2)
    const desiredAxisX = (Math.min(...childCenters) + Math.max(...childCenters)) / 2
    const currentAxisX = (firstParentNode.x + firstParentNode.width / 2 + secondParentNode.x + secondParentNode.width / 2) / 2
    const axisDeltaX = desiredAxisX - currentAxisX
    const boundedAxisX = Number.isFinite(maxShiftX)
      ? currentAxisX + Math.max(-maxShiftX, Math.min(maxShiftX, axisDeltaX))
      : desiredAxisX

    const ancestorAxes: number[] = []
    for (const parentNode of [firstParentNode, secondParentNode]) {
      const ancestorParentIds = parentIdsByChild.get(parentNode.id) ?? []
      if (ancestorParentIds.length === 0) {
        continue
      }

      const ancestorParentNodes = ancestorParentIds
        .map((ancestorParentId) => adjustedNodes.get(ancestorParentId))
        .filter((ancestorParentNode): ancestorParentNode is PositionedNode => ancestorParentNode !== undefined)

      if (ancestorParentNodes.length !== ancestorParentIds.length) {
        continue
      }

      const ancestorCenters = ancestorParentNodes.map((ancestorParentNode) => ancestorParentNode.x + ancestorParentNode.width / 2)
      ancestorAxes.push((Math.min(...ancestorCenters) + Math.max(...ancestorCenters)) / 2)
    }

    const constrainedAxisX = (() => {
      if (!Number.isFinite(maxAncestorDriftX) || ancestorAxes.length === 0) {
        return boundedAxisX
      }

      const ancestorAxisX = ancestorAxes.reduce((sum, axis) => sum + axis, 0) / ancestorAxes.length
      const maxDrift = Math.max(0, Number(maxAncestorDriftX))
      const minAxisX = ancestorAxisX - maxDrift
      const maxAxisRangeX = ancestorAxisX + maxDrift
      const clampedAxisX = Math.max(minAxisX, Math.min(maxAxisRangeX, boundedAxisX))

      if (Number.isFinite(maxShiftX) && Math.abs(clampedAxisX - currentAxisX) > maxShiftX + 1e-6) {
        return boundedAxisX
      }

      return clampedAxisX
    })()

    centerCoupleOnAxis(adjustedNodes, firstParentNode, secondParentNode, constrainedAxisX, minimumGap)
  }

  return { nodes: adjustedNodes }
}

function orderCoupleNodes(
  firstNode: PositionedNode,
  secondNode: PositionedNode,
): [PositionedNode, PositionedNode] {
  return firstNode.x <= secondNode.x ? [firstNode, secondNode] : [secondNode, firstNode]
}

function resolveCoupleGap(
  firstNode: PositionedNode,
  secondNode: PositionedNode,
  minimumGap: number,
): number {
  const [leftNode, rightNode] = orderCoupleNodes(firstNode, secondNode)
  const currentGap = rightNode.x - (leftNode.x + leftNode.width)
  return Math.max(minimumGap, currentGap)
}

function centerCoupleOnAxis(
  adjustedNodes: Map<UUID, PositionedNode>,
  firstNode: PositionedNode,
  secondNode: PositionedNode,
  axisX: number,
  minimumGap: number,
) {
  const [leftNode, rightNode] = orderCoupleNodes(firstNode, secondNode)
  const gap = resolveCoupleGap(leftNode, rightNode, minimumGap)
  const pairWidth = leftNode.width + rightNode.width + gap
  const nextLeftX = axisX - pairWidth / 2

  adjustedNodes.set(leftNode.id, {
    ...leftNode,
    x: nextLeftX,
  })
  adjustedNodes.set(rightNode.id, {
    ...rightNode,
    x: nextLeftX + leftNode.width + gap,
  })
}

function compactCoupleOnAxis(
  adjustedNodes: Map<UUID, PositionedNode>,
  firstNode: PositionedNode,
  secondNode: PositionedNode,
  axisX: number,
  targetGap: number,
) {
  const [leftNode, rightNode] = orderCoupleNodes(firstNode, secondNode)
  const pairGap = Math.max(20, targetGap)
  const pairWidth = leftNode.width + rightNode.width + pairGap
  const nextLeftX = axisX - pairWidth / 2

  adjustedNodes.set(leftNode.id, {
    ...leftNode,
    x: nextLeftX,
  })
  adjustedNodes.set(rightNode.id, {
    ...rightNode,
    x: nextLeftX + leftNode.width + pairGap,
  })
}

export function placeMarriagePairsLocally(
  layout: LayoutResult,
  relations: Relation[],
  anchoredNodeIds: Set<UUID>,
  biologicalRelations: Relation[] = [],
  options?: {
    maxCenterYDelta?: number
    preferSameRow?: boolean
    allowPairMidpointFallback?: boolean
    allowAnchoredFallbackPlacement?: boolean
    rasterColumnStep?: number
    rasterColumnOrigin?: number
    rasterRowStep?: number
    rasterRowOrigin?: number
  },
): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const targetGap = 40
  const rowTolerance = 14
  const sidePadding = 8
  const maxCenterYDelta = options?.maxCenterYDelta ?? 28
  const preferSameRow = options?.preferSameRow ?? false
  const allowPairMidpointFallback = options?.allowPairMidpointFallback ?? true
  const allowAnchoredFallbackPlacement = options?.allowAnchoredFallbackPlacement ?? true
  const rasterColumnStep = options?.rasterColumnStep
  const rasterColumnOrigin = options?.rasterColumnOrigin ?? 0
  const rasterRowStep = options?.rasterRowStep
  const rasterRowOrigin = options?.rasterRowOrigin ?? 0
  const biologicalDegree = buildBiologicalDegreeMap(biologicalRelations)

  const snapToRaster = (value: number, origin: number, step?: number): number => {
    if (!Number.isFinite(value) || step === undefined || step <= 0) {
      return value
    }

    return origin + Math.round((value - origin) / step) * step
  }

  for (const relation of relations.filter((candidate) => candidate.type === 'marriage').sort((left, right) => left.id.localeCompare(right.id))) {
    const firstNode = adjustedNodes.get(relation.from)
    const secondNode = adjustedNodes.get(relation.to)

    if (!firstNode || !secondNode) {
      continue
    }

    const centerYDelta = Math.abs(firstNode.y + firstNode.height / 2 - (secondNode.y + secondNode.height / 2))
    if (centerYDelta > maxCenterYDelta) {
      continue
    }

    const [leftNode, rightNode] = firstNode.x <= secondNode.x ? [firstNode, secondNode] : [secondNode, firstNode]
    const currentGap = rightNode.x - (leftNode.x + leftNode.width)

    const { anchorNode, movingNode } = resolveMarriageAlignmentRoles(
      firstNode,
      secondNode,
      anchoredNodeIds,
      biologicalDegree,
    )

    const candidateY = snapToRaster(anchorNode.y, rasterRowOrigin, rasterRowStep)

    if (Math.abs(currentGap - targetGap) < 1) {
      if (Math.abs(movingNode.y - candidateY) > 0.5) {
        adjustedNodes.set(movingNode.id, {
          ...movingNode,
            y: candidateY,
        })
      }
      continue
    }

    const anchorPlacement = resolveMarriageAnchorPlacement({
      adjustedNodes,
      anchorNode,
      movingNode,
      candidateY,
      targetGap,
      rowTolerance,
      sidePadding,
      preferSameRow,
    })

    if (anchorPlacement) {
      adjustedNodes.set(movingNode.id, {
        ...movingNode,
          x: snapToRaster(anchorPlacement.x, rasterColumnOrigin, rasterColumnStep),
          y: snapToRaster(anchorPlacement.y, rasterRowOrigin, rasterRowStep),
      })
      continue
    }

    if (allowAnchoredFallbackPlacement && anchoredNodeIds.has(leftNode.id) && !anchoredNodeIds.has(rightNode.id)) {
      adjustedNodes.set(rightNode.id, {
        ...rightNode,
        x: snapToRaster(leftNode.x + leftNode.width + targetGap, rasterColumnOrigin, rasterColumnStep),
        y: rightNode.id === movingNode.id ? candidateY : rightNode.y,
      })
      continue
    }

    if (allowAnchoredFallbackPlacement && anchoredNodeIds.has(rightNode.id) && !anchoredNodeIds.has(leftNode.id)) {
      adjustedNodes.set(leftNode.id, {
        ...leftNode,
        x: snapToRaster(rightNode.x - targetGap - leftNode.width, rasterColumnOrigin, rasterColumnStep),
        y: leftNode.id === movingNode.id ? candidateY : leftNode.y,
      })
      continue
    }

    if (!allowPairMidpointFallback) {
      continue
    }

    const pairMidpoint = (leftNode.x + leftNode.width / 2 + rightNode.x + rightNode.width / 2) / 2
    const totalWidth = leftNode.width + rightNode.width + targetGap
    const nextLeftX = pairMidpoint - totalWidth / 2

    adjustedNodes.set(leftNode.id, {
      ...leftNode,
      x: snapToRaster(nextLeftX, rasterColumnOrigin, rasterColumnStep),
      y: leftNode.id === movingNode.id ? candidateY : leftNode.y,
    })
    adjustedNodes.set(rightNode.id, {
      ...rightNode,
      x: snapToRaster(nextLeftX + leftNode.width + targetGap, rasterColumnOrigin, rasterColumnStep),
      y: rightNode.id === movingNode.id ? candidateY : rightNode.y,
    })
  }

  return { nodes: adjustedNodes }
}

export function alignMarriagePairs(
  layout: LayoutResult,
  relations: Relation[],
  anchoredNodeIds: Set<UUID>,
  biologicalRelations: Relation[] = [],
  options?: {
    maxCenterYDelta?: number
    preferSameRow?: boolean
    allowPairMidpointFallback?: boolean
    allowAnchoredFallbackPlacement?: boolean
  },
): LayoutResult {
  return placeMarriagePairsLocally(
    layout,
    relations,
    anchoredNodeIds,
    biologicalRelations,
    options,
  )
}

function buildBiologicalDegreeMap(biologicalRelations: Relation[]): Map<UUID, number> {
  const biologicalDegree = new Map<UUID, number>()

  for (const relation of biologicalRelations.filter((candidate) => candidate.type === 'biological_parent')) {
    biologicalDegree.set(relation.from, (biologicalDegree.get(relation.from) ?? 0) + 1)
    biologicalDegree.set(relation.to, (biologicalDegree.get(relation.to) ?? 0) + 1)
  }

  return biologicalDegree
}

function resolveMarriageAlignmentRoles(
  firstNode: PositionedNode,
  secondNode: PositionedNode,
  anchoredNodeIds: Set<UUID>,
  biologicalDegree: Map<UUID, number>,
): { anchorNode: PositionedNode; movingNode: PositionedNode } {
  const firstDegree = biologicalDegree.get(firstNode.id) ?? 0
  const secondDegree = biologicalDegree.get(secondNode.id) ?? 0

  if (anchoredNodeIds.has(secondNode.id) && !anchoredNodeIds.has(firstNode.id)) {
    return { anchorNode: secondNode, movingNode: firstNode }
  }

  if (!anchoredNodeIds.has(firstNode.id) && !anchoredNodeIds.has(secondNode.id) && secondDegree > firstDegree) {
    return { anchorNode: secondNode, movingNode: firstNode }
  }

  return { anchorNode: firstNode, movingNode: secondNode }
}

function collectMarriageRowNodes(
  adjustedNodes: Map<UUID, PositionedNode>,
  anchorNode: PositionedNode,
  movingNode: PositionedNode,
  candidateY: number,
  rowTolerance: number,
): PositionedNode[] {
  return [...adjustedNodes.values()].filter((node) => {
    if (node.id === anchorNode.id || node.id === movingNode.id) {
      return false
    }

    const centerYDelta = Math.abs((node.y + node.height / 2) - (candidateY + anchorNode.height / 2))
    return centerYDelta <= rowTolerance
  })
}

function resolveMarriageAnchorPlacement({
  adjustedNodes,
  anchorNode,
  movingNode,
  candidateY,
  targetGap,
  rowTolerance,
  sidePadding,
  preferSameRow,
}: {
  adjustedNodes: Map<UUID, PositionedNode>
  anchorNode: PositionedNode
  movingNode: PositionedNode
  candidateY: number
  targetGap: number
  rowTolerance: number
  sidePadding: number
  preferSameRow: boolean
}): { x: number; y: number } | null {
  const rowNodes = collectMarriageRowNodes(adjustedNodes, anchorNode, movingNode, candidateY, rowTolerance)
  const candidateRightX = anchorNode.x + anchorNode.width + targetGap
  const candidateLeftX = anchorNode.x - targetGap - movingNode.width

  const isCandidateFree = (candidateX: number) => isMarriagePlacementFree({
    rowNodes,
    movingNode,
    candidateX,
    candidateY,
    sidePadding,
  })

  const sameRowX = resolvePreferredSameRowPlacement(candidateRightX, candidateLeftX, isCandidateFree)
  if (sameRowX !== null) {
    return { x: sameRowX, y: candidateY }
  }

  if (preferSameRow) {
    const extendedSameRowX = resolveExtendedSameRowPlacement(candidateRightX, candidateLeftX, isCandidateFree)
    if (extendedSameRowX !== null) {
      return { x: extendedSameRowX, y: candidateY }
    }
  }

  return resolveMarriageVerticalPlacement(adjustedNodes, anchorNode, movingNode, candidateRightX, candidateY, sidePadding)
}

function isMarriagePlacementFree({
  rowNodes,
  movingNode,
  candidateX,
  candidateY,
  sidePadding,
}: {
  rowNodes: PositionedNode[]
  movingNode: PositionedNode
  candidateX: number
  candidateY: number
  sidePadding: number
}): boolean {
  return !rowNodes.some((node) => {
    const overlapX = candidateX < node.x + node.width + sidePadding && candidateX + movingNode.width > node.x - sidePadding
    const overlapY = candidateY < node.y + node.height + sidePadding && candidateY + movingNode.height > node.y - sidePadding
    return overlapX && overlapY
  })
}

function resolvePreferredSameRowPlacement(
  candidateRightX: number,
  candidateLeftX: number,
  isCandidateFree: (candidateX: number) => boolean,
): number | null {
  const rightFree = isCandidateFree(candidateRightX)
  const leftFree = isCandidateFree(candidateLeftX)

  if (!rightFree && !leftFree) {
    return null
  }

  return rightFree ? candidateRightX : candidateLeftX
}

function resolveExtendedSameRowPlacement(
  candidateRightX: number,
  candidateLeftX: number,
  isCandidateFree: (candidateX: number) => boolean,
): number | null {
  const horizontalSearchOffsets = [20, 40, 60, 90, 130, 180]

  for (const offset of horizontalSearchOffsets) {
    const rightCandidate = candidateRightX + offset
    if (isCandidateFree(rightCandidate)) {
      return rightCandidate
    }

    const leftCandidate = candidateLeftX - offset
    if (isCandidateFree(leftCandidate)) {
      return leftCandidate
    }
  }

  return null
}

function resolveMarriageVerticalPlacement(
  adjustedNodes: Map<UUID, PositionedNode>,
  anchorNode: PositionedNode,
  movingNode: PositionedNode,
  candidateX: number,
  candidateY: number,
  sidePadding: number,
): { x: number; y: number } | null {
  const verticalOffsets = [movingNode.height + 18, 2 * (movingNode.height + 18), 3 * (movingNode.height + 18)]

  for (const offset of verticalOffsets) {
    const nextY = candidateY + offset
    const collision = [...adjustedNodes.values()].some((node) => {
      if (node.id === anchorNode.id || node.id === movingNode.id) {
        return false
      }

      const overlapX = candidateX < node.x + node.width + sidePadding && candidateX + movingNode.width > node.x - sidePadding
      const overlapY = nextY < node.y + node.height + sidePadding && nextY + movingNode.height > node.y - sidePadding
      return overlapX && overlapY
    })

    if (!collision) {
      return { x: candidateX, y: nextY }
    }
  }

  return null
}

export function normalizeMarriagePairGeometry(
  layout: LayoutResult,
  relations: Relation[],
  options?: {
    maxCenterYDelta?: number
    targetGap?: number
  },
): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const targetGap = options?.targetGap ?? 40
  const maxCenterYDelta = options?.maxCenterYDelta ?? 28
  const sidePadding = 8

  for (const relation of relations.filter((candidate) => candidate.type === 'marriage').sort((left, right) => left.id.localeCompare(right.id))) {
    const firstNode = adjustedNodes.get(relation.from)
    const secondNode = adjustedNodes.get(relation.to)

    if (!firstNode || !secondNode) {
      continue
    }

    const centerYDelta = Math.abs(firstNode.y + firstNode.height / 2 - (secondNode.y + secondNode.height / 2))
    if (centerYDelta > maxCenterYDelta) {
      continue
    }

    const [leftNode, rightNode] = orderCoupleNodes(firstNode, secondNode)
    const pairMidpoint = (leftNode.x + leftNode.width / 2 + rightNode.x + rightNode.width / 2) / 2
    const nextLeftX = pairMidpoint - (leftNode.width + rightNode.width + targetGap) / 2
    const nextRightX = nextLeftX + leftNode.width + targetGap
    const targetY = Math.min(leftNode.y, rightNode.y)

    const pairPlacement = [
      {
        id: leftNode.id,
        x: nextLeftX,
        y: targetY,
        width: leftNode.width,
        height: leftNode.height,
      },
      {
        id: rightNode.id,
        x: nextRightX,
        y: targetY,
        width: rightNode.width,
        height: rightNode.height,
      },
    ]

    if (!isMarriagePairPlacementFree(adjustedNodes, pairPlacement, sidePadding)) {
      const yOnlyPlacement = [
        {
          id: leftNode.id,
          x: leftNode.x,
          y: targetY,
          width: leftNode.width,
          height: leftNode.height,
        },
        {
          id: rightNode.id,
          x: rightNode.x,
          y: targetY,
          width: rightNode.width,
          height: rightNode.height,
        },
      ]

      if (isMarriagePairPlacementFree(adjustedNodes, yOnlyPlacement, sidePadding)) {
        adjustedNodes.set(leftNode.id, {
          ...leftNode,
          y: targetY,
        })
        adjustedNodes.set(rightNode.id, {
          ...rightNode,
          y: targetY,
        })
      }

      continue
    }

    adjustedNodes.set(leftNode.id, {
      ...leftNode,
      x: nextLeftX,
      y: targetY,
    })
    adjustedNodes.set(rightNode.id, {
      ...rightNode,
      x: nextLeftX + leftNode.width + targetGap,
      y: targetY,
    })
  }

  return { nodes: adjustedNodes }
}

function isMarriagePairPlacementFree(
  adjustedNodes: Map<UUID, PositionedNode>,
  pairPlacement: Array<{ id: UUID; x: number; y: number; width: number; height: number }>,
  sidePadding: number,
): boolean {
  return pairPlacement.every((candidate) => {
    return ![...adjustedNodes.values()].some((node) => {
      if (node.id === candidate.id || pairPlacement.some((entry) => entry.id === node.id)) {
        return false
      }

      const overlapX = candidate.x < node.x + node.width + sidePadding && candidate.x + candidate.width > node.x - sidePadding
      const overlapY = candidate.y < node.y + node.height + sidePadding && candidate.y + candidate.height > node.y - sidePadding
      return overlapX && overlapY
    })
  })
}

export function buildSpouseProjectionState(
  validation: ValidationResult,
  layout: LayoutResult,
  _selectedIds: UUID[],
  spouseOwnerOverrides: Record<string, UUID>,
  options?: {
    collapseChildEdges?: boolean
    duplicateBothPartners?: boolean
    preferSameRowPlacement?: boolean
    suppressProjectionWhenEitherPartnerParentless?: boolean
  },
): SpouseProjectionState {
  const collapseChildEdges = options?.collapseChildEdges ?? true
  const duplicateBothPartners = options?.duplicateBothPartners ?? false
  const preferSameRowPlacement = options?.preferSameRowPlacement ?? false
  const suppressProjectionWhenEitherPartnerParentless = options?.suppressProjectionWhenEitherPartnerParentless ?? false
  const hiddenChildEdgeKeys = new Set<string>()
  const projectedMarriageIds = new Set<UUID>()
  const nodes: SpouseProjectionNode[] = []
  const occupiedRects: ProjectionRect[] = Array.from(layout.nodes.values()).map((node) => ({
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  }))
  const marriages = validation.validOverlayRelations.filter((relation) => relation.type === 'marriage').sort((left, right) => left.id.localeCompare(right.id))
  const marriagePartnerIdsByPerson = buildMarriagePartnerIdsByPerson(marriages)

  for (const relation of marriages) {
    const fromNode = layout.nodes.get(relation.from)
    const toNode = layout.nodes.get(relation.to)

    if (!fromNode || !toNode) {
      continue
    }

    const fromParentCount = (validation.parentsByChild.get(relation.from) ?? []).length
    const toParentCount = (validation.parentsByChild.get(relation.to) ?? []).length
    const hasSingleAnchoredSpouse = (fromParentCount === 0) !== (toParentCount === 0)
    if (suppressProjectionWhenEitherPartnerParentless && (fromParentCount === 0 || toParentCount === 0)) {
      continue
    }

    const sharedChildren = getSharedChildren(relation.from, relation.to, validation)
    const ownerId = resolveProjectedMarriageOwner({
      relation,
      validation,
      spouseOwnerOverrides,
    })

    projectedMarriageIds.add(relation.id)

    if (collapseChildEdges) {
      for (const childId of sharedChildren) {
        const collapsedParentId = ownerId === relation.from ? relation.to : relation.from
        hiddenChildEdgeKeys.add(`${collapsedParentId}|${childId}`)
      }
    }

    const width = SPOUSE_PROJECTION_NODE_WIDTH
    const height = SPOUSE_PROJECTION_NODE_HEIGHT
    const horizontalGap = SPOUSE_PROJECTION_HORIZONTAL_GAP
    const ownerPartnerId = ownerId === relation.from ? relation.to : relation.from
    const placements = hasSingleAnchoredSpouse
      ? (() => {
          const anchorId = fromParentCount > 0 ? relation.from : relation.to
          const companionId = anchorId === relation.from ? relation.to : relation.from
          return [{ anchorId, companionId }]
        })()
      : duplicateBothPartners
        ? [
            { anchorId: ownerId, companionId: ownerPartnerId },
            { anchorId: ownerPartnerId, companionId: ownerId },
          ]
        : [{ anchorId: ownerId, companionId: ownerPartnerId }]

    for (const placementTarget of placements) {
      const anchorNode = layout.nodes.get(placementTarget.anchorId)
      const partnerNode = layout.nodes.get(placementTarget.companionId)

      if (!anchorNode || !partnerNode) {
        continue
      }

      if (!duplicateBothPartners && canRenderInlineMarriage(anchorNode, partnerNode)) {
        continue
      }

      const side = resolveProjectionSide({
        anchorId: placementTarget.anchorId,
        companionId: placementTarget.companionId,
        anchorNode,
        partnerNode,
        marriagePartnerIdsByPerson,
        layout,
      })
      const placement = findProjectionPlacement(anchorNode, side, width, height, horizontalGap, occupiedRects, preferSameRowPlacement)

      occupiedRects.push({
        x: placement.x,
        y: placement.y,
        width,
        height,
      })

      nodes.push({
        relationId: relation.id,
        ownerId: placementTarget.anchorId,
        companionId: placementTarget.companionId,
        sharedChildren,
        x: placement.x,
        y: placement.y,
        width,
        height,
        side,
      })
    }
  }

  return { hiddenChildEdgeKeys, projectedMarriageIds, nodes }
}

function findProjectionPlacement(
  anchorNode: { x: number; y: number; width: number; height: number },
  side: 'left' | 'right',
  width: number,
  height: number,
  horizontalGap: number,
  occupiedRects: ProjectionRect[],
  preferSameRowPlacement: boolean,
): { x: number; y: number } {
  const sameRowCollisionPadding = SPOUSE_PROJECTION_SAME_ROW_COLLISION_PADDING
  const fallbackCollisionPadding = SPOUSE_PROJECTION_FALLBACK_COLLISION_PADDING
  const sideSign = side === 'right' ? 1 : -1
  const oppositeSideSign = -sideSign
  const baseX = side === 'right' ? anchorNode.x + anchorNode.width + horizontalGap : anchorNode.x - width - horizontalGap
  const oppositeBaseX = side === 'right' ? anchorNode.x - width - horizontalGap : anchorNode.x + anchorNode.width + horizontalGap
  const baseY = anchorNode.y + SPOUSE_PROJECTION_VERTICAL_ANCHOR_OFFSET
  const horizontalSteps = [0, 36, 72, 112, 156, 220, 300, 420, 560, 720]
  const verticalStep = height + SPOUSE_PROJECTION_VERTICAL_STEP_GAP
  const offsets = [0, -verticalStep, verticalStep, -2 * verticalStep, 2 * verticalStep, -3 * verticalStep, 3 * verticalStep]

  // Keep projected spouses on the same visual row and choose the nearest free slot.
  const sameRowCandidates = horizontalSteps.flatMap((step) => ([
    { x: baseX + sideSign * step, y: baseY },
    { x: oppositeBaseX + oppositeSideSign * step, y: baseY },
  ]))

  for (const candidate of sameRowCandidates) {
    const rect = { x: candidate.x, y: candidate.y, width, height }
    if (!occupiedRects.some((occupiedRect) => rectsOverlap(rect, occupiedRect, sameRowCollisionPadding))) {
      return { x: rect.x, y: rect.y }
    }
  }

  for (const offsetY of offsets) {
    const candidate = { x: baseX, y: baseY + offsetY, width, height }
    if (!occupiedRects.some((occupiedRect) => rectsOverlap(candidate, occupiedRect, fallbackCollisionPadding))) {
      return { x: candidate.x, y: candidate.y }
    }
  }

  if (preferSameRowPlacement) {
    // As last resort keep spouse projection on the anchor row.
    return { x: baseX, y: baseY }
  }

  return { x: baseX, y: baseY + 4 * verticalStep }
}

export function canRenderInlineMarriage(
  firstNode: { x: number; y: number; width: number; height: number },
  secondNode: { x: number; y: number; width: number; height: number },
): boolean {
  const centerYDelta = Math.abs(firstNode.y + firstNode.height / 2 - (secondNode.y + secondNode.height / 2))
  const [leftNode, rightNode] = firstNode.x <= secondNode.x ? [firstNode, secondNode] : [secondNode, firstNode]
  const boxGap = rightNode.x - (leftNode.x + leftNode.width)
  const maxInlineGap = Math.max(leftNode.width, rightNode.width) * INLINE_MARRIAGE_MAX_GAP_FACTOR

  return centerYDelta <= INLINE_MARRIAGE_MAX_CENTER_Y_DELTA && boxGap >= 0 && boxGap <= maxInlineGap
}

function rectsOverlap(first: ProjectionRect, second: ProjectionRect, padding: number): boolean {
  return !(
    first.x + first.width + padding <= second.x
    || second.x + second.width + padding <= first.x
    || first.y + first.height + padding <= second.y
    || second.y + second.height + padding <= first.y
  )
}

function getSharedChildren(firstParentId: UUID, secondParentId: UUID, validation: ValidationResult): UUID[] {
  const firstChildren = new Set(validation.childrenByParent.get(firstParentId) ?? [])
  const secondChildren = validation.childrenByParent.get(secondParentId) ?? []

  return secondChildren.filter((childId) => firstChildren.has(childId)).sort((left, right) => left.localeCompare(right))
}

function buildMarriagePartnerIdsByPerson(marriages: Relation[]): Map<UUID, UUID[]> {
  const partnerIdsByPerson = new Map<UUID, Set<UUID>>()

  for (const relation of marriages) {
    const fromPartnerIds = partnerIdsByPerson.get(relation.from) ?? new Set<UUID>()
    fromPartnerIds.add(relation.to)
    partnerIdsByPerson.set(relation.from, fromPartnerIds)

    const toPartnerIds = partnerIdsByPerson.get(relation.to) ?? new Set<UUID>()
    toPartnerIds.add(relation.from)
    partnerIdsByPerson.set(relation.to, toPartnerIds)
  }

  const result = new Map<UUID, UUID[]>()
  for (const [personId, partnerIds] of partnerIdsByPerson) {
    result.set(personId, Array.from(partnerIds).sort((left, right) => left.localeCompare(right)))
  }

  return result
}

function resolveProjectionSide({
  anchorId,
  companionId,
  anchorNode,
  partnerNode,
  marriagePartnerIdsByPerson,
  layout,
}: {
  anchorId: UUID
  companionId: UUID
  anchorNode: { x: number; y: number; width: number; height: number }
  partnerNode: { x: number; y: number; width: number; height: number }
  marriagePartnerIdsByPerson: Map<UUID, UUID[]>
  layout: LayoutResult
}): 'left' | 'right' {
  const partnerIds = marriagePartnerIdsByPerson.get(anchorId) ?? []
  if (partnerIds.length < 2) {
    return partnerNode.x >= anchorNode.x ? 'right' : 'left'
  }

  const orderedPartnerIds = partnerIds
    .map((partnerId) => {
      const node = layout.nodes.get(partnerId)
      return {
        partnerId,
        x: node ? node.x + node.width / 2 : Number.POSITIVE_INFINITY,
      }
    })
    .sort((left, right) => {
      if (left.x !== right.x) {
        return left.x - right.x
      }

      return left.partnerId.localeCompare(right.partnerId)
    })
    .map((entry) => entry.partnerId)

  const partnerIndex = orderedPartnerIds.indexOf(companionId)
  if (partnerIndex === 0) {
    return 'left'
  }

  return 'right'
}

function resolveProjectedMarriageOwner({
  relation,
  validation,
  spouseOwnerOverrides,
}: {
  relation: Relation
  validation: ValidationResult
  spouseOwnerOverrides: Record<string, UUID>
}): UUID {
  return resolveContinuationOwner({
    relation,
    validation,
    spouseOwnerOverrides,
  })
}

export function expandCameraBounds(camera: CameraView, projections: SpouseProjectionNode[], houseAnchors: HouseAnchor[]): CameraView {
  if (projections.length === 0 && houseAnchors.length === 0) {
    return camera
  }

  const overlayRects = [
    ...projections.map((projection) => ({
      minX: projection.x - 40,
      minY: projection.y - 40,
      maxX: projection.x + projection.width + 40,
      maxY: projection.y + projection.height + 40,
    })),
    ...houseAnchors.map((anchor) => ({
      minX: anchor.x - 40,
      minY: anchor.y - 40,
      maxX: anchor.x + anchor.width + 40,
      maxY: anchor.y + anchor.height + 72,
    })),
  ]

  const minX = Math.min(camera.x, ...overlayRects.map((rect) => rect.minX))
  const minY = Math.min(camera.y, ...overlayRects.map((rect) => rect.minY))
  const maxX = Math.max(camera.x + camera.width, ...overlayRects.map((rect) => rect.maxX))
  const maxY = Math.max(camera.y + camera.height, ...overlayRects.map((rect) => rect.maxY))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}
