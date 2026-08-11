import type {
  HouseDefinitions,
  LayoutResult,
  PositionedNode,
  Relation,
  UUID,
  ValidationResult,
} from '../../graph'
import type { BiologicalChildGroup, HouseAnchor } from '../treeCore'
import { createHouseLookup } from './houses'
import { getModeR3LayoutArtifacts } from './layout'
import { sortPersonIdsForR3 } from './sorting'
import type { R3FamilyPlacement } from './types'

const R3_COLUMN_WIDTH = 220
const R3_ROW_HEIGHT = 192
const R3_NODE_HEIGHT = 64

export function buildModeR3HouseAnchors(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    allowFallback?: boolean
  },
): HouseAnchor[] {
  const allowFallback = options?.allowFallback ?? false
  const startHouseIds = new Set(
    houseDefinitions.houses
      .filter((house) => house.anchor.enabled && house.tier === 'start')
      .map((house) => house.id),
  )
  const artifacts = getModeR3LayoutArtifacts(layout)
  if (artifacts && artifacts.houseAnchorPlacements.length > 0) {
    return artifacts.houseAnchorPlacements
      .map((placement) => {
        const connectorNodeIds = resolveAnchorConnectorNodeIds({
          baseConnectorNodeIds: placement.connectorNodeIds,
          houseId: placement.houseId,
          startHouseIds,
          houseDefinitions,
          validation,
          layout,
        })

        return {
          houseId: placement.houseId,
          displayName: placement.displayName,
          memberIds: placement.memberIds,
          connectorNodeIds,
          x: placement.centerColumn * R3_COLUMN_WIDTH - artifacts.normalizationOffsetX - placement.width / 2,
          y: placement.rootRow * R3_ROW_HEIGHT - artifacts.normalizationOffsetY - 94,
          width: placement.width,
          height: placement.height,
        }
      })
      .sort((left, right) => left.y - right.y || left.houseId.localeCompare(right.houseId))
  }

  if (!allowFallback) {
    return []
  }

  const houseLookup = createHouseLookup(houseDefinitions, validation.personById)
  const startHouses = houseDefinitions.houses
    .filter((house) => house.anchor.enabled && house.tier === 'start')
    .sort((left, right) => left.anchor.order - right.anchor.order || left.id.localeCompare(right.id))

  return startHouses
    .map((house) => {
      const memberIds = validation.persons
        .filter((person) => houseLookup.getPrimaryHouse(person.id)?.id === house.id)
        .map((person) => person.id)
      const rootIds = sortPersonIdsForR3(
        memberIds.filter((personId) => (validation.parentsByChild.get(personId) ?? []).length === 0),
        validation.personById,
      )
      const rootNodes = rootIds
        .map((personId) => layout.nodes.get(personId))
        .filter((node): node is PositionedNode => node !== undefined)

      if (rootNodes.length === 0) {
        return null
      }

      const centerX = (Math.min(...rootNodes.map((node) => node.x + node.width / 2)) + Math.max(...rootNodes.map((node) => node.x + node.width / 2))) / 2
      const width = Math.max(176, house.displayName.length * 8 + 42)

      return {
        houseId: house.id,
        displayName: house.displayName,
        memberIds: rootIds,
        connectorNodeIds: rootIds,
        x: centerX - width / 2,
        y: Math.min(...rootNodes.map((node) => node.y)) - 94,
        width,
        height: 64,
      }
    })
    .filter((anchor): anchor is HouseAnchor => anchor !== null)
}

export function buildModeR3BiologicalChildGroups(
  validation: ValidationResult,
  relations: Relation[],
  layout: LayoutResult,
  options?: {
    allowFallback?: boolean
  },
): BiologicalChildGroup[] {
  const allowFallback = options?.allowFallback ?? false
  const artifacts = getModeR3LayoutArtifacts(layout)
  if (artifacts) {
    return buildChildGroupsFromPlacements(validation, relations, layout, artifacts.familyPlacements, artifacts.normalizationOffsetX, artifacts.normalizationOffsetY)
  }

  if (!allowFallback) {
    return []
  }

  const relationsByChild = new Map<UUID, Relation[]>()

  for (const relation of relations) {
    const childRelations = relationsByChild.get(relation.to) ?? []
    childRelations.push(relation)
    childRelations.sort((left, right) => left.id.localeCompare(right.id))
    relationsByChild.set(relation.to, childRelations)
  }

  const groupedChildren = new Map<string, { parentIds: UUID[]; childIds: UUID[]; relationIds: UUID[] }>()

  for (const [childId, childRelations] of relationsByChild.entries()) {
    const parentIds = sortPersonIdsForR3(childRelations.map((relation) => relation.from), validation.personById)
    const groupKey = parentIds.join('|')
    const group = groupedChildren.get(groupKey)
    const relationIds = childRelations.map((relation) => relation.id).sort((left, right) => left.localeCompare(right))

    if (group) {
      group.childIds.push(childId)
      group.childIds = sortPersonIdsForR3(group.childIds, validation.personById)
      group.relationIds.push(...relationIds)
      group.relationIds.sort((left, right) => left.localeCompare(right))
      continue
    }

    groupedChildren.set(groupKey, {
      parentIds,
      childIds: [childId],
      relationIds,
    })
  }

  return [...groupedChildren.entries()]
    .map(([groupKey, group]) => {
      const parentNodes = group.parentIds
        .map((parentId) => layout.nodes.get(parentId))
        .filter((node): node is PositionedNode => node !== undefined)
        .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
      const orderedChildIds = sortPersonIdsForR3(group.childIds, validation.personById)
      const childNodes = orderedChildIds
        .map((childId) => layout.nodes.get(childId))
        .filter((node): node is PositionedNode => node !== undefined)

      if (parentNodes.length === 0 || childNodes.length === 0) {
        return null
      }

      const childCenters = childNodes.map((node) => node.x + node.width / 2)
      const childTopY = Math.min(...childNodes.map((node) => node.y))
      const parentBottomY = Math.max(...parentNodes.map((node) => node.y + node.height))
      const gap = Math.max(childTopY - parentBottomY, 36)
      const junctionY = parentBottomY + Math.min(Math.max(gap * 0.22, 18), 34)
      const siblingY = Math.max(junctionY + 18, childTopY - 20)
      const junctionX = childNodes.length === 1
        ? childCenters[0]
        : (Math.min(...childCenters) + Math.max(...childCenters)) / 2

      return {
        key: groupKey,
        parentIds: group.parentIds,
        childIds: orderedChildIds,
        relationIds: group.relationIds,
        junctionX,
        junctionY,
        siblingY,
        parentNodes,
        childNodes,
      }
    })
    .filter((group): group is BiologicalChildGroup => group !== null)
    .sort((left, right) => left.junctionY - right.junctionY || left.key.localeCompare(right.key))
}

function buildChildGroupsFromPlacements(
  validation: ValidationResult,
  relations: Relation[],
  layout: LayoutResult,
  placements: R3FamilyPlacement[],
  normalizationOffsetX: number,
  normalizationOffsetY: number,
): BiologicalChildGroup[] {
  const relationIdsByEndpoints = new Map<string, string[]>()
  for (const relation of relations) {
    const key = `${relation.from}|${relation.to}`
    const relationIds = relationIdsByEndpoints.get(key) ?? []
    relationIds.push(relation.id)
    relationIdsByEndpoints.set(key, relationIds)
  }

  return placements
    .map((placement) => {
      const parentNodes = placement.parentIds
        .map((parentId) => layout.nodes.get(parentId))
        .filter((node): node is PositionedNode => node !== undefined)
        .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
      const orderedChildIds = sortPersonIdsForR3(placement.childIds, validation.personById)
      const childNodes = orderedChildIds
        .map((childId) => layout.nodes.get(childId))
        .filter((node): node is PositionedNode => node !== undefined)

      if (parentNodes.length === 0 || childNodes.length === 0) {
        return null
      }

      const relationIds = new Set<string>()
      for (const parentId of placement.parentIds) {
        for (const childId of orderedChildIds) {
          for (const relationId of relationIdsByEndpoints.get(`${parentId}|${childId}`) ?? []) {
            relationIds.add(relationId)
          }
        }
      }

      const childTopYFromRows = placement.childRow * R3_ROW_HEIGHT - normalizationOffsetY
      const parentBottomYFromRows = placement.parentRow * R3_ROW_HEIGHT + R3_NODE_HEIGHT - normalizationOffsetY
      const childTopY = Math.min(childTopYFromRows, ...childNodes.map((node) => node.y))
      const parentBottomY = Math.max(parentBottomYFromRows, ...parentNodes.map((node) => node.y + node.height))
      const gap = Math.max(childTopY - parentBottomY, 36)
      const junctionY = parentBottomY + Math.min(Math.max(gap * 0.22, 18), 34)
      const siblingY = Math.max(junctionY + 18, childTopY - 20)
      const junctionX = placement.axisColumn * R3_COLUMN_WIDTH - normalizationOffsetX

      return {
        key: placement.key,
        parentIds: placement.parentIds,
        childIds: orderedChildIds,
        relationIds: [...relationIds].sort((left, right) => left.localeCompare(right)),
        junctionX,
        junctionY,
        siblingY,
        parentNodes,
        childNodes,
      }
    })
    .filter((group): group is BiologicalChildGroup => group !== null)
    .sort((left, right) => left.junctionY - right.junctionY || left.key.localeCompare(right.key))
}

function resolveAnchorConnectorNodeIds({
  baseConnectorNodeIds,
  houseId,
  startHouseIds,
  houseDefinitions,
  validation,
  layout,
}: {
  baseConnectorNodeIds: UUID[]
  houseId: string
  startHouseIds: Set<string>
  houseDefinitions: HouseDefinitions
  validation: ValidationResult
  layout: LayoutResult
}): UUID[] {
  if (!startHouseIds.has(houseId)) {
    return baseConnectorNodeIds
  }

  const houseLookup = createHouseLookup(houseDefinitions, validation.personById)

  const connectorNodeIds = new Set(baseConnectorNodeIds)
  const marriages = validation.validOverlayRelations.filter((relation) => relation.type === 'marriage')

  for (const nodeId of baseConnectorNodeIds) {
    const node = layout.nodes.get(nodeId)
    if (!node) {
      continue
    }

    const nodeParentCount = (validation.parentsByChild.get(nodeId) ?? []).length
    if (nodeParentCount !== 0) {
      continue
    }

    const partnerCandidateIds = new Set<UUID>()

    for (const marriage of marriages) {
      if (marriage.from !== nodeId && marriage.to !== nodeId) {
        continue
      }

      const partnerId = marriage.from === nodeId ? marriage.to : marriage.from
      partnerCandidateIds.add(partnerId)
    }

    for (const partnerId of partnerCandidateIds) {
      const partnerNode = layout.nodes.get(partnerId)
      if (!partnerNode) {
        continue
      }

      const partnerParentCount = (validation.parentsByChild.get(partnerId) ?? []).length
      if (partnerParentCount !== 0) {
        continue
      }

      if (Math.abs(partnerNode.y - node.y) > 4) {
        continue
      }

      const partnerHouseId = houseLookup.getPrimaryHouse(partnerId)?.id ?? null
      if (partnerHouseId !== houseId) {
        continue
      }

      connectorNodeIds.add(partnerId)
    }
  }

  return sortPersonIdsForR3([...connectorNodeIds], validation.personById)
}