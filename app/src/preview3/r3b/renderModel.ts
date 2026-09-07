import type { HouseDefinitions, LayoutResult, Relation, UUID, ValidationResult } from '../../graph'
import { resolveContinuationOwner } from '../continuation'
import type { BiologicalChildGroup, HouseAnchor, SpouseProjectionState } from '../treeCore'
import { buildSpouseProjectionState, canRenderInlineMarriage } from '../treeCore'
import { buildModeR3ConnectorModel } from '../r3/connectorModel'
import type { R3ConnectorAnchor, R3ConnectorGroupModel } from '../r3/connectorModel'
import { buildModeR3BiologicalChildGroups, buildModeR3HouseAnchors } from '../r3/render'

export function buildModeR3BHouseAnchors(
  validation: ValidationResult,
  layout: LayoutResult,
  houseDefinitions: HouseDefinitions,
  options?: {
    allowFallback?: boolean
  },
): HouseAnchor[] {
  return buildModeR3HouseAnchors(validation, layout, houseDefinitions, options)
}

export function buildModeR3BBiologicalChildGroups(
  validation: ValidationResult,
  relations: Relation[],
  layout: LayoutResult,
  options?: {
    allowFallback?: boolean
  },
): BiologicalChildGroup[] {
  return buildModeR3BiologicalChildGroups(validation, relations, layout, options)
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
  selectedIds: UUID[],
  spouseOwnerOverrides: Record<string, UUID>,
  options?: {
    collapseChildEdges?: boolean
    duplicateBothPartners?: boolean
    preferSameRowPlacement?: boolean
  },
): SpouseProjectionState {
  const baseState = buildSpouseProjectionState(validation, layout, selectedIds, spouseOwnerOverrides, {
    collapseChildEdges: options?.collapseChildEdges,
    duplicateBothPartners: options?.duplicateBothPartners,
    preferSameRowPlacement: options?.preferSameRowPlacement,
    suppressProjectionWhenEitherPartnerParentless: false,
  })

  const keptRelationIds = new Set<UUID>()
  const nodes = baseState.nodes.filter((node) => {
    const relation = validation.validOverlayRelations.find((candidate) => candidate.id === node.relationId)
    if (!relation || relation.type !== 'marriage') {
      return false
    }

    if (shouldSuppressProjectionForMarriage(relation, validation, layout)) {
      return false
    }

    keptRelationIds.add(relation.id)
    return true
  })

  return {
    hiddenChildEdgeKeys: options?.collapseChildEdges ? filterHiddenChildEdgeKeys(baseState, keptRelationIds) : new Set<string>(),
    projectedMarriageIds: keptRelationIds,
    nodes,
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

function filterHiddenChildEdgeKeys(
  baseState: SpouseProjectionState,
  keptRelationIds: Set<string>,
): Set<string> {
  if (keptRelationIds.size === baseState.projectedMarriageIds.size) {
    return baseState.hiddenChildEdgeKeys
  }

  return new Set<string>()
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