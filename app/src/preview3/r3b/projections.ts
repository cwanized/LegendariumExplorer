import type { LayoutResult, PositionedNode, Relation, UUID, ValidationResult } from '../../graph'
import {
  SPOUSE_PROJECTION_HORIZONTAL_GAP,
  SPOUSE_PROJECTION_NODE_HEIGHT,
  SPOUSE_PROJECTION_NODE_WIDTH,
  SPOUSE_PROJECTION_VERTICAL_ANCHOR_OFFSET,
} from '../ruleConstants'
import { resolveContinuationOwner } from '../continuation'
import { canRenderInlineMarriage, type SpouseProjectionNode } from '../treeCore'
import type { R3BProjectionPlacementDecision, R3BProjectionPlan, R3BProjectionShiftEligibility, R3BVisibleParentSlot } from './types'
import { buildR3BProjectionContextKey } from './projectionPlan'

type NodeBox = Pick<PositionedNode, 'x' | 'y' | 'width' | 'height'>

export type R3BProjectionGeometry = {
  x: number
  y: number
  width: number
  height: number
  side: 'left' | 'right'
}

export function buildR3BMarriagePartnerIdsByPerson(marriages: Relation[]): Map<UUID, UUID[]> {
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

export function buildR3BProjectionGeometry({
  ownerId,
  companionId,
  ownerNode,
  companionNode,
  partnerIdsByPerson,
  nodesById,
  fallbackSide,
  forcedSide,
}: {
  ownerId: UUID
  companionId: UUID
  ownerNode: NodeBox
  companionNode: NodeBox | null
  partnerIdsByPerson: Map<UUID, UUID[]>
  nodesById: Map<UUID, NodeBox>
  fallbackSide?: 'left' | 'right'
  forcedSide?: 'left' | 'right'
}): R3BProjectionGeometry {
  const side = resolveR3BProjectionSide({
    anchorId: ownerId,
    companionId,
    anchorNode: ownerNode,
    partnerNode: companionNode,
    partnerIdsByPerson,
    nodesById,
    fallbackSide,
    forcedSide,
  })

  return {
    x: side === 'right'
      ? ownerNode.x + ownerNode.width + SPOUSE_PROJECTION_HORIZONTAL_GAP
      : ownerNode.x - SPOUSE_PROJECTION_NODE_WIDTH - SPOUSE_PROJECTION_HORIZONTAL_GAP,
    y: ownerNode.y + SPOUSE_PROJECTION_VERTICAL_ANCHOR_OFFSET,
    width: SPOUSE_PROJECTION_NODE_WIDTH,
    height: SPOUSE_PROJECTION_NODE_HEIGHT,
    side,
  }
}

export function getR3BProjectionMidpointX({
  ownerNode,
  geometry,
}: {
  ownerNode: NodeBox
  geometry: Pick<R3BProjectionGeometry, 'x' | 'width'>
}): number {
  const ownerCenterX = ownerNode.x + ownerNode.width / 2
  const projectionCenterX = geometry.x + geometry.width / 2
  return (ownerCenterX + projectionCenterX) / 2
}

function resolveR3BProjectionSide({
  anchorId,
  companionId,
  anchorNode,
  partnerNode,
  partnerIdsByPerson,
  nodesById,
  fallbackSide,
  forcedSide,
}: {
  anchorId: UUID
  companionId: UUID
  anchorNode: NodeBox
  partnerNode: NodeBox | null
  partnerIdsByPerson: Map<UUID, UUID[]>
  nodesById: Map<UUID, NodeBox>
  fallbackSide?: 'left' | 'right'
  forcedSide?: 'left' | 'right'
}): 'left' | 'right' {
  if (forcedSide) {
    return forcedSide
  }
  const partnerIds = partnerIdsByPerson.get(anchorId) ?? []
  if (partnerIds.length < 2) {
    if (partnerNode) {
      return partnerNode.x >= anchorNode.x ? 'right' : 'left'
    }

    return fallbackSide ?? 'right'
  }

  const orderedPartnerIds = partnerIds
    .map((partnerId) => {
      const node = nodesById.get(partnerId)
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

  if (partnerIndex > 0) {
    return 'right'
  }

  return fallbackSide ?? 'right'
}

export function resolveR3BProjectionPlacements({
  validation,
  layout,
  spouseOwnerOverrides,
  collapseChildEdges,
  duplicateBothPartners,
  projectionPlan,
  visibleParentSlotsByFamily,
  finalProjectionSlotsByContext,
}: {
  validation: ValidationResult
  layout: LayoutResult
  spouseOwnerOverrides: Record<string, UUID>
  collapseChildEdges: boolean
  duplicateBothPartners: boolean
  projectionPlan?: R3BProjectionPlan
  visibleParentSlotsByFamily?: Map<string, R3BVisibleParentSlot[]>
  finalProjectionSlotsByContext?: Map<string, R3BVisibleParentSlot>
}): {
  decisions: R3BProjectionPlacementDecision[]
  nodes: SpouseProjectionNode[]
  projectedMarriageIds: Set<UUID>
  hiddenChildEdgeKeys: Set<string>
} {
  const marriages = validation.validOverlayRelations
    .filter((relation) => relation.type === 'marriage')
    .sort((left, right) => left.id.localeCompare(right.id))
  const partnerIdsByPerson = buildR3BMarriagePartnerIdsByPerson(marriages)
  const projectedMarriageIds = new Set<UUID>()
  const hiddenChildEdgeKeys = new Set<string>()

  const rawDecisions = marriages.flatMap((relation) => {
    if (projectionPlan?.canonicalMainMarriageIds.has(relation.id)) {
      return []
    }

    const requirement = projectionPlan?.requirementsByMarriageId.get(relation.id)
    const isAdditionalParentlessMarriage = requirement?.anchoredPartnerId !== undefined
    if (!isAdditionalParentlessMarriage && shouldSuppressProjectionForMarriage(relation, validation, layout)) {
      return []
    }

    const fromParentCount = (validation.parentsByChild.get(relation.from) ?? []).length
    const toParentCount = (validation.parentsByChild.get(relation.to) ?? []).length
    const hasSingleAnchoredSpouse = requirement
      ? requirement.anchoredPartnerId !== undefined
      : (fromParentCount === 0) !== (toParentCount === 0)
    const sharedChildren = requirement?.sharedChildren ?? getSharedChildren(relation.from, relation.to, validation)
    const plannedContext = findProjectionContext(relation, projectionPlan)
    const visibleSlotFamily = findVisibleSlotFamily(relation, plannedContext, visibleParentSlotsByFamily)
    const ownerSlot = visibleSlotFamily?.find((slot) => slot.role === 'owner')
    const companionSlot = visibleSlotFamily?.find((slot) => slot.role === 'companion')
    const hasRealVisibleParentPair = visibleSlotFamily?.length === 2
      && visibleSlotFamily.every((slot) => slot.kind === 'real')
    if (!isAdditionalParentlessMarriage && hasRealVisibleParentPair) {
      return []
    }
    const ownerId = plannedContext?.ownerId ?? ownerSlot?.personId ?? resolveContinuationOwner({ relation, validation, spouseOwnerOverrides })
    const companionId = companionSlot?.personId ?? (ownerId === relation.from ? relation.to : relation.from)

    projectedMarriageIds.add(relation.id)
    if (collapseChildEdges) {
      for (const childId of sharedChildren) {
        hiddenChildEdgeKeys.add(`${companionId}|${childId}`)
      }
    }

    const placements = hasSingleAnchoredSpouse
      ? (() => {
          const anchorId = requirement?.anchoredPartnerId ?? (fromParentCount > 0 ? relation.from : relation.to)
          const projectedCompanionId = anchorId === relation.from ? relation.to : relation.from
          return [{ anchorId, projectedCompanionId }]
        })()
      : duplicateBothPartners
        ? [
            { anchorId: ownerId, projectedCompanionId: companionId },
            { anchorId: companionId, projectedCompanionId: ownerId },
          ]
        : [{ anchorId: ownerId, projectedCompanionId: companionId }]

    return placements
      .map(({ anchorId, projectedCompanionId }) => {
        const anchorNode = layout.nodes.get(anchorId)
        const companionNode = layout.nodes.get(projectedCompanionId)
        if (!anchorNode || !companionNode) {
          return null
        }

        const slotGeometry = finalProjectionSlotsByContext?.get(
          buildR3BProjectionContextKey(relation.id, anchorId, projectedCompanionId),
        ) ?? null
        const fallbackGeometry = buildR3BProjectionGeometry({
          ownerId: anchorId,
          companionId: projectedCompanionId,
          ownerNode: anchorNode,
          companionNode,
          partnerIdsByPerson,
          nodesById: layout.nodes,
        })
        const geometry = slotGeometry ?? fallbackGeometry
        const resolvedSide = slotGeometry
          ? resolveSlotSide(anchorNode, slotGeometry)
          : fallbackGeometry.side

        return {
          relationId: relation.id,
          ownerId: anchorId,
          companionId: projectedCompanionId,
          sharedChildren,
          isFamilyRelevant: slotGeometry !== null,
          preferredSide: resolvedSide,
          resolvedSide,
          resolutionMode: 'primary-slot' as const,
          x: geometry.x,
          y: geometry.y,
          width: geometry.width,
          height: geometry.height,
        }
      })
        .filter((decision): decision is NonNullable<typeof decision> => decision !== null)
  })

  const decisions = applyProjectionCollisionClearance(rawDecisions, layout)
  const nodes = decisions.map((decision) => ({
    relationId: decision.relationId,
    ownerId: decision.ownerId,
    companionId: decision.companionId,
    sharedChildren: decision.sharedChildren,
    x: decision.x,
    y: decision.y,
    width: decision.width,
    height: decision.height,
    side: decision.resolvedSide,
    isPlannedSlot: decision.isFamilyRelevant,
  }))

  return {
    decisions,
    nodes,
    projectedMarriageIds,
    hiddenChildEdgeKeys,
  }
}

function findProjectionContext(
  relation: Relation,
  projectionPlan: R3BProjectionPlan | undefined,
): { relationId: UUID; ownerId: UUID; companionId: UUID; familyKey: string } | null {
  if (!projectionPlan) {
    return null
  }

  return projectionPlan.projectionContextsByKey.get(
    buildR3BProjectionContextKey(relation.id, relation.from, relation.to),
  ) ?? projectionPlan.projectionContextsByKey.get(
    buildR3BProjectionContextKey(relation.id, relation.to, relation.from),
  ) ?? null
}

function findVisibleSlotFamily(
  relation: Relation,
  context: { relationId: UUID; ownerId: UUID; companionId: UUID; familyKey: string } | null,
  visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]> | undefined,
): R3BVisibleParentSlot[] | null {
  if (!context || !visibleParentSlotsByFamily) {
    return null
  }

  const slots = visibleParentSlotsByFamily.get(context.familyKey)
  if (!slots || slots.length !== 2) {
    return null
  }

  const hasExactContext = slots.some((slot) => (
    slot.relationId === relation.id
    && slot.ownerId === context.ownerId
    && slot.companionId === context.companionId
  ))

  return hasExactContext ? slots : null
}

function resolveSlotSide(anchorNode: NodeBox, slot: R3BVisibleParentSlot): 'left' | 'right' {
  return slot.x + slot.width / 2 >= anchorNode.x + anchorNode.width / 2 ? 'right' : 'left'
}

function shouldSuppressProjectionForMarriage(
  relation: Relation,
  validation: ValidationResult,
  layout: LayoutResult,
): boolean {
  const fromNode = layout.nodes.get(relation.from)
  const toNode = layout.nodes.get(relation.to)
  if (!fromNode || !toNode) {
    return false
  }

  const fromParentCount = (validation.parentsByChild.get(relation.from) ?? []).length
  const toParentCount = (validation.parentsByChild.get(relation.to) ?? []).length
  const hasSingleParentlessPartner = (fromParentCount === 0) !== (toParentCount === 0)

  if (!hasSingleParentlessPartner) {
    return false
  }

  return canRenderInlineMarriage(fromNode, toNode)
}

function getSharedChildren(firstParentId: UUID, secondParentId: UUID, validation: ValidationResult): UUID[] {
  const firstChildren = new Set(validation.childrenByParent.get(firstParentId) ?? [])
  const secondChildren = validation.childrenByParent.get(secondParentId) ?? []
  return secondChildren.filter((childId) => firstChildren.has(childId)).sort((left, right) => left.localeCompare(right))
}

function applyProjectionCollisionClearance(
  decisions: R3BProjectionPlacementDecision[],
  layout: LayoutResult,
): R3BProjectionPlacementDecision[] {
  const occupied = Array.from(layout.nodes.values()).map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  }))
  const sorted = [...decisions].sort((left, right) => left.y - right.y || left.x - right.x || left.relationId.localeCompare(right.relationId))
  const adjusted: R3BProjectionPlacementDecision[] = []

  for (const decision of sorted) {
    let x = decision.x
    let resolutionMode = decision.resolutionMode
    let blockingNodeId: UUID | undefined
    let shiftEligibility: R3BProjectionShiftEligibility | undefined
    const direction = decision.resolvedSide === 'right' ? 1 : -1

    for (let iteration = 0; iteration < 8; iteration += 1) {
      const rect = { x, y: decision.y, width: decision.width, height: decision.height }
      const overlappingLayoutNode = occupied.find((candidate) => rectsOverlap(rect, candidate))
      if (!overlappingLayoutNode) {
        const hasProjectionOverlap = adjusted.some((entry) => rectsOverlap(rect, entry))
        if (!hasProjectionOverlap) {
          break
        }
        x += direction * (decision.width + 20)
        resolutionMode = 'shifted-local-branch'
        continue
      }

      blockingNodeId = overlappingLayoutNode.id
      shiftEligibility = classifyShiftEligibility(overlappingLayoutNode.id, layout)

      if (shiftEligibility === 'ineligible') {
        x += direction * (decision.width + 20)
        resolutionMode = 'shifted-local-branch'
        break
      }

      x += direction * (decision.width + 20)
      resolutionMode = 'shifted-local-branch'
    }

    adjusted.push({
      ...decision,
      x,
      y: decision.y,
      resolutionMode,
      blockingNodeId,
      shiftEligibility,
    })
  }

  return adjusted
}

function classifyShiftEligibility(
  blockedNodeId: UUID,
  layout: LayoutResult,
): R3BProjectionShiftEligibility {
  const node = layout.nodes.get(blockedNodeId)
  if (!node) {
    return 'ineligible'
  }

  return 'single-child-continuation'
}

function rectsOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    first.x + first.width <= second.x
    || second.x + second.width <= first.x
    || first.y + first.height <= second.y
    || second.y + second.height <= first.y
  )
}