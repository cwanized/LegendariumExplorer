import type { HouseDefinitions, LayoutResult, PositionedNode, Relation, UUID, ValidationResult } from '../../graph'
import { resolveContinuationOwner } from '../continuation'
import type { BiologicalChildGroup, HouseAnchor, SpouseProjectionState } from '../treeCore'
import { buildModeR3ConnectorModel } from '../r3/connectorModel'
import type { R3ConnectorAnchor, R3ConnectorGroupModel } from '../r3/connectorModel'
import { createHouseLookup } from '../r3/houses'
import { sortPersonIdsForR3 } from '../r3/sorting'
import type { R3FamilyPlacement } from '../r3/types'
import { getModeR3BLayoutArtifacts } from './placement'
import { resolveR3BProjectionPlacements } from './projections'
import type { R3BVisibleParentSlot } from './types'

const R3B_ROW_HEIGHT = 192
const R3B_NODE_HEIGHT = 64

export function buildModeR3BHouseAnchors(
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
  const artifacts = getModeR3BLayoutArtifacts(layout)
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
        const anchorNodeIds = connectorNodeIds.length > 0 ? connectorNodeIds : placement.memberIds
        const anchorNodes = anchorNodeIds
          .map((nodeId) => layout.nodes.get(nodeId))
          .filter((node): node is PositionedNode => node !== undefined)

        if (anchorNodes.length === 0) {
          return null
        }

        const centerX = (Math.min(...anchorNodes.map((node) => node.x + node.width / 2)) + Math.max(...anchorNodes.map((node) => node.x + node.width / 2))) / 2
        const topY = Math.min(...anchorNodes.map((node) => node.y))

        return {
          houseId: placement.houseId,
          displayName: placement.displayName,
          memberIds: placement.memberIds,
          connectorNodeIds,
          x: centerX - placement.width / 2,
          y: topY - 94,
          width: placement.width,
          height: placement.height,
        }
      })
      .filter((anchor): anchor is HouseAnchor => anchor !== null)
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

export function buildModeR3BBiologicalChildGroups(
  validation: ValidationResult,
  relations: Relation[],
  layout: LayoutResult,
  options?: {
    allowFallback?: boolean
  },
): BiologicalChildGroup[] {
  const allowFallback = options?.allowFallback ?? false
  const artifacts = getModeR3BLayoutArtifacts(layout)
  if (artifacts) {
    return buildChildGroupsFromPlacements(
      validation,
      relations,
      layout,
      artifacts.familyPlacements,
      artifacts.visibleParentSlotsByFamily,
      artifacts.normalizationOffsetY,
    )
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

export function buildModeR3BConnectorModel(
  biologicalChildGroups: BiologicalChildGroup[],
  groupParentAnchorsByKey: Map<string, R3ConnectorAnchor[]>,
): Map<string, R3ConnectorGroupModel> {
  return buildModeR3ConnectorModel(biologicalChildGroups, groupParentAnchorsByKey)
}

export function buildModeR3BSpouseProjectionState(
  validation: ValidationResult,
  layout: LayoutResult,
  _selectedIds: UUID[],
  spouseOwnerOverrides: Record<string, UUID>,
  options?: {
    collapseChildEdges?: boolean
    duplicateBothPartners?: boolean
    preferSameRowPlacement?: boolean
  },
): SpouseProjectionState {
  const collapseChildEdges = options?.collapseChildEdges ?? false
  const duplicateBothPartners = options?.duplicateBothPartners ?? false
  const projectionPlan = getModeR3BLayoutArtifacts(layout)?.projectionPlan
  const visibleParentSlotsByFamily = getModeR3BLayoutArtifacts(layout)?.visibleParentSlotsByFamily
  const finalProjectionSlotsByContext = getModeR3BLayoutArtifacts(layout)?.finalProjectionSlotsByContext
  const resolved = resolveR3BProjectionPlacements({
    validation,
    layout,
    spouseOwnerOverrides,
    collapseChildEdges,
    duplicateBothPartners,
    projectionPlan,
    visibleParentSlotsByFamily,
    finalProjectionSlotsByContext,
  })

  return {
    hiddenChildEdgeKeys: collapseChildEdges ? resolved.hiddenChildEdgeKeys : new Set<string>(),
    projectedMarriageIds: resolved.projectedMarriageIds,
    nodes: resolved.nodes,
  }
}

export function buildModeR3BParentAnchorsByKey({
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
}): Map<string, R3ConnectorAnchor[]> {
  const visibleParentSlotsByFamily = getModeR3BLayoutArtifacts(layout)?.visibleParentSlotsByFamily
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

    const pairKey = buildParentPairKey(relation.from, relation.to)
    marriageByParentPairKey.set(pairKey, relation)
    ownerByMarriageId.set(relation.id, resolveContinuationOwner({ relation, validation, spouseOwnerOverrides }))
  }

  const anchorsByKey = new Map<string, R3ConnectorAnchor[]>()

  for (const group of biologicalChildGroups) {
    const visibleSlotAnchors = overlayEnabled
      ? buildVisibleSlotAnchors(group, visibleParentSlotsByFamily)
      : null
    if (visibleSlotAnchors) {
      anchorsByKey.set(group.key, visibleSlotAnchors)
      continue
    }

    const pairKey = group.parentIds.length === 2
      ? buildParentPairKey(group.parentIds[0], group.parentIds[1])
      : null
    const marriage = pairKey ? marriageByParentPairKey.get(pairKey) ?? null : null
    const ownerId = marriage ? ownerByMarriageId.get(marriage.id) ?? null : null

    if (!overlayEnabled || !marriage || !ownerId || !spouseProjection.projectedMarriageIds.has(marriage.id)) {
      anchorsByKey.set(group.key, group.parentIds.map((parentId) => buildMainAnchor(parentId, layout)).filter((anchor): anchor is R3ConnectorAnchor => anchor !== null))
      continue
    }

    const companionId = group.parentIds.find((parentId) => parentId !== ownerId) ?? null
    const ownerAnchor = buildMainAnchor(ownerId, layout)
    const companionProjection = companionId
      ? selectProjectedCompanionAnchor({
          companionId,
          ownerId,
          marriageId: marriage.id,
          group,
          projectionCandidates: projectionsByCompanionId.get(companionId) ?? [],
        })
      : null

    if (ownerAnchor && companionProjection) {
      anchorsByKey.set(group.key, group.parentIds.map((parentId) => {
        if (parentId === ownerId) {
          return ownerAnchor
        }

        if (companionId && parentId === companionId) {
          return companionProjection
        }

        return buildMainAnchor(parentId, layout)
      }).filter((anchor): anchor is R3ConnectorAnchor => anchor !== null))
      continue
    }

    anchorsByKey.set(group.key, group.parentIds.map((parentId) => buildMainAnchor(parentId, layout)).filter((anchor): anchor is R3ConnectorAnchor => anchor !== null))
  }

  return anchorsByKey
}

function buildMainAnchor(parentId: UUID, layout: LayoutResult): R3ConnectorAnchor | null {
  const mainNode = layout.nodes.get(parentId)
  if (!mainNode) {
    return null
  }

  return {
    key: `main:${parentId}`,
    parentId,
    x: mainNode.x,
    y: mainNode.y,
    width: mainNode.width,
    height: mainNode.height,
    isProjection: false,
  }
}

function buildVisibleSlotAnchors(
  group: BiologicalChildGroup,
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]> | undefined,
): R3ConnectorAnchor[] | null {
  const slots = visibleParentSlotsByFamily?.get(group.key)
  if (!slots || slots.length !== group.parentIds.length) {
    return null
  }

  const slotsByPersonId = new Map(slots.map((slot) => [slot.personId, slot]))
  const anchors = group.parentIds.map((parentId) => {
    const slot = slotsByPersonId.get(parentId)
    if (!slot) {
      return null
    }

    return {
      key: `${slot.kind}:${slot.key}`,
      parentId,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      isProjection: slot.kind === 'projection',
    } satisfies R3ConnectorAnchor
  })

  return anchors.every((anchor): anchor is R3ConnectorAnchor => anchor !== null) ? anchors : null
}

function selectProjectedCompanionAnchor({
  companionId,
  ownerId,
  marriageId,
  group,
  projectionCandidates,
}: {
  companionId: UUID
  ownerId: UUID
  marriageId: UUID
  group: BiologicalChildGroup
  projectionCandidates: SpouseProjectionState['nodes']
}): R3ConnectorAnchor | null {
  const matching = projectionCandidates
    .filter((projection) => projection.companionId === companionId)
    .filter((projection) => projection.ownerId === ownerId)
    .filter((projection) => projection.relationId === marriageId)
    .filter((projection) => projection.sharedChildren.some((childId) => group.childIds.includes(childId)))
    .sort((left, right) => {
      return left.y - right.y
        || left.x - right.x
        || left.relationId.localeCompare(right.relationId)
        || left.ownerId.localeCompare(right.ownerId)
        || left.companionId.localeCompare(right.companionId)
    })

  const candidate = matching[0]
  if (!candidate) {
    return null
  }

  return {
    key: `projection:${candidate.relationId}:${candidate.ownerId}:${candidate.companionId}`,
    parentId: companionId,
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
    isProjection: true,
  }
}

function buildParentPairKey(leftId: UUID, rightId: UUID): string {
  return [leftId, rightId].sort((left, right) => left.localeCompare(right)).join('|')
}

function buildChildGroupsFromPlacements(
  validation: ValidationResult,
  relations: Relation[],
  layout: LayoutResult,
  placements: R3FamilyPlacement[],
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>,
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
      const parentNodes = buildVisibleSlotParentNodes(placement, visibleParentSlotsByFamily)
        ?? placement.parentIds
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

      const childTopYFromRows = placement.childRow * R3B_ROW_HEIGHT - normalizationOffsetY
      const parentBottomYFromRows = placement.parentRow * R3B_ROW_HEIGHT + R3B_NODE_HEIGHT - normalizationOffsetY
      const childTopY = Math.min(childTopYFromRows, ...childNodes.map((node) => node.y))
      const parentBottomY = Math.max(parentBottomYFromRows, ...parentNodes.map((node) => node.y + node.height))
      const gap = Math.max(childTopY - parentBottomY, 36)
      const junctionY = parentBottomY + Math.min(Math.max(gap * 0.22, 18), 34)
      const siblingY = Math.max(junctionY + 18, childTopY - 20)
      const parentCenters = parentNodes.map((node) => node.x + node.width / 2)
      const junctionX = parentCenters.length === 1
        ? parentCenters[0]
        : (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2

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

function buildVisibleSlotParentNodes(
  placement: R3FamilyPlacement,
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>,
): PositionedNode[] | null {
  const slots = visibleParentSlotsByFamily.get(placement.key)
  if (!slots || slots.length !== placement.parentIds.length) {
    return null
  }

  const slotsByPersonId = new Map(slots.map((slot) => [slot.personId, slot]))
  const nodes = placement.parentIds.map((parentId) => {
    const slot = slotsByPersonId.get(parentId)
    if (!slot) {
      return null
    }

    return {
      id: `${slot.kind}:${slot.key}`,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
    } satisfies PositionedNode
  })

  return nodes.every((node): node is PositionedNode => node !== null)
    ? nodes.sort((left, right) => left.x - right.x || left.id.localeCompare(right.id))
    : null
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