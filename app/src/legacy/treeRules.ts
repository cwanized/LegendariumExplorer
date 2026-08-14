import type { LayoutResult, PositionedNode, Relation, UUID, ValidationResult } from '../graph'
import {
  INLINE_MARRIAGE_MAX_CENTER_Y_DELTA,
  INLINE_MARRIAGE_MAX_GAP_FACTOR,
  SPOUSE_PROJECTION_FALLBACK_COLLISION_PADDING,
  SPOUSE_PROJECTION_HORIZONTAL_GAP,
  SPOUSE_PROJECTION_NODE_HEIGHT,
  SPOUSE_PROJECTION_NODE_WIDTH,
  SPOUSE_PROJECTION_VERTICAL_ANCHOR_OFFSET,
  SPOUSE_PROJECTION_VERTICAL_STEP_GAP,
} from '../preview3/ruleConstants'

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

export function buildBiologicalChildGroups(
  relations: Relation[],
  layout: LayoutResult,
): BiologicalChildGroup[] {
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
        junctionX:
          parentCenters.length === 1
            ? parentCenters[0]
            : (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2,
        junctionY,
        siblingY,
        parentNodes,
        childNodes,
      }
    })
    .filter((group): group is BiologicalChildGroup => group !== null)
    .sort((left, right) => left.junctionY - right.junctionY || left.key.localeCompare(right.key))
}

export function getSingleChildCenterTargets(
  layout: LayoutResult,
  relations: Relation[],
): Map<UUID, number> {
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

export function alignSingleChildNodes(
  layout: LayoutResult,
  centerTargets: Map<UUID, number>,
): LayoutResult {
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

  return {
    nodes: adjustedNodes,
  }
}

export function alignMarriagePairs(
  layout: LayoutResult,
  relations: Relation[],
  anchoredNodeIds: Set<UUID>,
): LayoutResult {
  const adjustedNodes = new Map(layout.nodes)
  const targetGap = 32

  for (const relation of relations
    .filter((candidate) => candidate.type === 'marriage')
    .sort((left, right) => left.id.localeCompare(right.id))) {
    const firstNode = adjustedNodes.get(relation.from)
    const secondNode = adjustedNodes.get(relation.to)

    if (!firstNode || !secondNode) {
      continue
    }

    const centerYDelta = Math.abs(
      firstNode.y + firstNode.height / 2 - (secondNode.y + secondNode.height / 2),
    )

    if (centerYDelta > INLINE_MARRIAGE_MAX_CENTER_Y_DELTA) {
      continue
    }

    const [leftNode, rightNode] = firstNode.x <= secondNode.x
      ? [firstNode, secondNode]
      : [secondNode, firstNode]
    const currentGap = rightNode.x - (leftNode.x + leftNode.width)

    if (Math.abs(currentGap - targetGap) < 1) {
      continue
    }

    if (anchoredNodeIds.has(leftNode.id) && !anchoredNodeIds.has(rightNode.id)) {
      adjustedNodes.set(rightNode.id, {
        ...rightNode,
        x: leftNode.x + leftNode.width + targetGap,
      })
      continue
    }

    if (anchoredNodeIds.has(rightNode.id) && !anchoredNodeIds.has(leftNode.id)) {
      adjustedNodes.set(leftNode.id, {
        ...leftNode,
        x: rightNode.x - targetGap - leftNode.width,
      })
      continue
    }

    const pairMidpoint =
      (leftNode.x + leftNode.width / 2 + rightNode.x + rightNode.width / 2) / 2
    const totalWidth = leftNode.width + rightNode.width + targetGap
    const nextLeftX = pairMidpoint - totalWidth / 2

    adjustedNodes.set(leftNode.id, {
      ...leftNode,
      x: nextLeftX,
    })
    adjustedNodes.set(rightNode.id, {
      ...rightNode,
      x: nextLeftX + leftNode.width + targetGap,
    })
  }

  return {
    nodes: adjustedNodes,
  }
}

export function buildSpouseProjectionState(
  validation: ValidationResult,
  layout: LayoutResult,
  selectedIds: UUID[],
  spouseOwnerOverrides: Record<string, UUID>,
): SpouseProjectionState {
  const hiddenChildEdgeKeys = new Set<string>()
  const projectedMarriageIds = new Set<UUID>()
  const nodes: SpouseProjectionNode[] = []
  const occupiedRects: ProjectionRect[] = Array.from(layout.nodes.values()).map((node) => ({
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  }))
  const rankedNodes = Array.from(layout.nodes.values()).sort(
    (left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id),
  )
  const rankById = new Map(rankedNodes.map((node, index) => [node.id, index]))

  const marriages = validation.validOverlayRelations
    .filter((relation) => relation.type === 'marriage')
    .sort((left, right) => left.id.localeCompare(right.id))

  for (const relation of marriages) {
    const fromNode = layout.nodes.get(relation.from)
    const toNode = layout.nodes.get(relation.to)

    if (!fromNode || !toNode) {
      continue
    }

    if (canRenderInlineMarriage(fromNode, toNode)) {
      continue
    }

    const sharedChildren = getSharedChildren(relation.from, relation.to, validation)

    const overrideOwnerId = spouseOwnerOverrides[relation.id]
    const selectedOwnerId = selectedIds.find((selectedId) => selectedId === relation.from || selectedId === relation.to)
    const ownerId =
      overrideOwnerId === relation.from || overrideOwnerId === relation.to
        ? overrideOwnerId
        : selectedOwnerId ?? defaultMarriageOwnerId(relation, rankById)

    if (!layout.nodes.has(ownerId)) {
      continue
    }

    projectedMarriageIds.add(relation.id)

    for (const childId of sharedChildren) {
      const collapsedParentId = ownerId === relation.from ? relation.to : relation.from
      hiddenChildEdgeKeys.add(`${collapsedParentId}|${childId}`)
    }

    for (const anchorId of [relation.from, relation.to] as const) {
      const anchorNode = layout.nodes.get(anchorId)
      const partnerId = anchorId === relation.from ? relation.to : relation.from
      const partnerNode = layout.nodes.get(partnerId)

      if (!anchorNode || !partnerNode) {
        continue
      }

      const side = partnerNode.x >= anchorNode.x ? 'right' : 'left'
      const placement = findProjectionPlacement(anchorNode, side, occupiedRects)

      occupiedRects.push({
        x: placement.x,
        y: placement.y,
        width: SPOUSE_PROJECTION_NODE_WIDTH,
        height: SPOUSE_PROJECTION_NODE_HEIGHT,
      })

      nodes.push({
        relationId: relation.id,
        ownerId: anchorId,
        companionId: partnerId,
        sharedChildren,
        x: placement.x,
        y: placement.y,
        width: SPOUSE_PROJECTION_NODE_WIDTH,
        height: SPOUSE_PROJECTION_NODE_HEIGHT,
        side,
      })
    }
  }

  return {
    hiddenChildEdgeKeys,
    projectedMarriageIds,
    nodes,
  }
}

function findProjectionPlacement(
  anchorNode: { x: number; y: number; width: number; height: number },
  side: 'left' | 'right',
  occupiedRects: ProjectionRect[],
): { x: number; y: number } {
  const baseX = side === 'right'
    ? anchorNode.x + anchorNode.width + SPOUSE_PROJECTION_HORIZONTAL_GAP
    : anchorNode.x - SPOUSE_PROJECTION_NODE_WIDTH - SPOUSE_PROJECTION_HORIZONTAL_GAP
  const baseY = anchorNode.y + SPOUSE_PROJECTION_VERTICAL_ANCHOR_OFFSET
  const stepY = SPOUSE_PROJECTION_NODE_HEIGHT + SPOUSE_PROJECTION_VERTICAL_STEP_GAP
  const offsets = [0, -stepY, stepY, -2 * stepY, 2 * stepY, -3 * stepY, 3 * stepY]

  for (const offsetY of offsets) {
    const candidate = {
      x: baseX,
      y: baseY + offsetY,
      width: SPOUSE_PROJECTION_NODE_WIDTH,
      height: SPOUSE_PROJECTION_NODE_HEIGHT,
    }

    if (!occupiedRects.some((occupiedRect) => rectsOverlap(candidate, occupiedRect, SPOUSE_PROJECTION_FALLBACK_COLLISION_PADDING))) {
      return { x: candidate.x, y: candidate.y }
    }
  }

  return { x: baseX, y: baseY + 4 * stepY }
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

function defaultMarriageOwnerId(relation: Relation, rankById: Map<UUID, number>): UUID {
  const fromRank = rankById.get(relation.from) ?? Number.MAX_SAFE_INTEGER
  const toRank = rankById.get(relation.to) ?? Number.MAX_SAFE_INTEGER

  if (fromRank !== toRank) {
    return fromRank < toRank ? relation.from : relation.to
  }

  return relation.from.localeCompare(relation.to) <= 0 ? relation.from : relation.to
}
