import type { Relation, UUID, ValidationResult } from '../../graph'
import type { R3FamilyGroup } from '../r3/types'
import type { R3BProjectionContext, R3BProjectionPlan, R3BProjectionRequirement, R3BVisiblePartnerSlotPlan } from './types'

export function buildR3BProjectionContextKey(relationId: UUID, ownerId: UUID, companionId: UUID): string {
  return `${relationId}:${ownerId}:${companionId}`
}

export function buildR3BProjectionPlan({
  validation,
  families,
}: {
  validation: ValidationResult
  families: R3FamilyGroup[]
}): R3BProjectionPlan {
  const requirementsByMarriageId = new Map<UUID, R3BProjectionRequirement>()
  const marriages = getMarriages(validation)
  const { canonicalMainMarriageIds, canonicalMainPartnerIdsByOwnerId, canonicalMainPartnerSidesByOwnerId } = buildCanonicalMainMarriagePlan(marriages, validation)
  const visiblePartnerSlotsByFamily = buildVisiblePartnerSlotPlans(families, validation, canonicalMainMarriageIds)

  for (const relation of marriages) {
    requirementsByMarriageId.set(relation.id, buildProjectionRequirement(relation, validation))
  }
  const projectionContextsByKey = buildProjectionContexts(marriages, visiblePartnerSlotsByFamily)

  return {
    requirementsByMarriageId,
    visiblePartnerSlotsByFamily,
    canonicalMainMarriageIds,
    canonicalMainPartnerIdsByOwnerId,
    canonicalMainPartnerSidesByOwnerId,
    projectionContextsByKey,
  }
}

function buildProjectionContexts(
  marriages: Relation[],
  visiblePartnerSlotsByFamily: Map<string, R3BVisiblePartnerSlotPlan>,
): Map<string, R3BProjectionContext> {
  const contexts = new Map<string, R3BProjectionContext>()
  const slotPlanByRelationId = new Map<UUID, R3BVisiblePartnerSlotPlan>()
  for (const slotPlan of visiblePartnerSlotsByFamily.values()) {
    if (slotPlan.relationId) {
      slotPlanByRelationId.set(slotPlan.relationId, slotPlan)
    }
  }

  for (const relation of marriages) {
    const slotPlan = slotPlanByRelationId.get(relation.id)
    const context: R3BProjectionContext = {
      relationId: relation.id,
      ownerId: slotPlan?.ownerId ?? relation.from,
      companionId: slotPlan?.companionId ?? relation.to,
      familyKey: slotPlan?.familyKey ?? `marriage:${relation.id}`,
    }
    contexts.set(buildR3BProjectionContextKey(context.relationId, context.ownerId, context.companionId), context)
    contexts.set(buildR3BProjectionContextKey(context.relationId, context.companionId, context.ownerId), {
      ...context,
      ownerId: context.companionId,
      companionId: context.ownerId,
    })
  }

  return contexts
}

function getMarriages(validation: ValidationResult): Relation[] {
  return validation.validOverlayRelations
    .filter((relation) => relation.type === 'marriage')
    .sort((left, right) => {
      const leftYear = left.attributes?.date?.year ?? Number.MAX_SAFE_INTEGER
      const rightYear = right.attributes?.date?.year ?? Number.MAX_SAFE_INTEGER
      return leftYear - rightYear || left.id.localeCompare(right.id)
    })
}

function buildProjectionRequirement(relation: Relation, validation: ValidationResult): R3BProjectionRequirement {
  const fromParentCount = (validation.parentsByChild.get(relation.from) ?? []).length
  const toParentCount = (validation.parentsByChild.get(relation.to) ?? []).length
  const anchoredPartnerId = fromParentCount === 0 && toParentCount > 0
    ? relation.to
    : toParentCount === 0 && fromParentCount > 0
      ? relation.from
      : undefined

  return {
    relationId: relation.id,
    partnerIds: [relation.from, relation.to],
    sharedChildren: getSharedChildren(relation.from, relation.to, validation),
    anchoredPartnerId,
  }
}

function buildVisiblePartnerSlotPlans(
  families: R3FamilyGroup[],
  validation: ValidationResult,
  canonicalMainMarriageIds: Set<UUID>,
): Map<string, R3BVisiblePartnerSlotPlan> {
  const visiblePartnerSlotsByFamily = new Map<string, R3BVisiblePartnerSlotPlan>()

  for (const family of families) {
    const slotPlan = buildVisiblePartnerSlotPlan(family, validation)
    const parentlessCompanionId = getParentlessCompanionId(family, validation)
    const isPrimaryParentlessMarriage = family.marriage !== null
      && canonicalMainMarriageIds.has(family.marriage.id)

    visiblePartnerSlotsByFamily.set(family.key, {
      ...slotPlan,
	  relationId: family.marriage?.id,
      companionKind: parentlessCompanionId
        ? isPrimaryParentlessMarriage ? 'real' : 'projection'
        : slotPlan.companionKind,
    })
  }

  return visiblePartnerSlotsByFamily
}

function buildCanonicalMainMarriagePlan(
  marriages: Relation[],
  validation: ValidationResult,
): {
  canonicalMainMarriageIds: Set<UUID>
  canonicalMainPartnerIdsByOwnerId: Map<UUID, UUID[]>
  canonicalMainPartnerSidesByOwnerId: Map<UUID, Map<UUID, 'left' | 'right'>>
} {
  const canonicalMainMarriageIds = new Set<UUID>()
  const canonicalMainPartnerIdsByOwnerId = new Map<UUID, UUID[]>()
  const canonicalMainPartnerSidesByOwnerId = new Map<UUID, Map<UUID, 'left' | 'right'>>()
  const primaryMarriageIdByParentlessPartner = new Map<UUID, UUID>()

  for (const relation of marriages) {
    const anchoredPartnerId = getAnchoredPartnerId(relation, validation)
    if (!anchoredPartnerId) {
      continue
    }

    const parentlessPartnerId = anchoredPartnerId === relation.from ? relation.to : relation.from
    if (primaryMarriageIdByParentlessPartner.has(parentlessPartnerId)) {
      continue
    }

    primaryMarriageIdByParentlessPartner.set(parentlessPartnerId, relation.id)
    canonicalMainMarriageIds.add(relation.id)
    const partners = canonicalMainPartnerIdsByOwnerId.get(anchoredPartnerId) ?? []
    partners.push(parentlessPartnerId)
    canonicalMainPartnerIdsByOwnerId.set(anchoredPartnerId, partners)
    const ownerMarriages = marriages.filter((candidate) => getAnchoredPartnerId(candidate, validation) === anchoredPartnerId)
    const ownerMarriageIndex = ownerMarriages.findIndex((candidate) => candidate.id === relation.id)
    const sides = canonicalMainPartnerSidesByOwnerId.get(anchoredPartnerId) ?? new Map<UUID, 'left' | 'right'>()
    sides.set(parentlessPartnerId, ownerMarriages.length > 1 && ownerMarriageIndex === 0 ? 'left' : 'right')
    canonicalMainPartnerSidesByOwnerId.set(anchoredPartnerId, sides)
  }

  return { canonicalMainMarriageIds, canonicalMainPartnerIdsByOwnerId, canonicalMainPartnerSidesByOwnerId }
}

function buildVisiblePartnerSlotPlan(family: R3FamilyGroup, validation: ValidationResult): R3BVisiblePartnerSlotPlan {
  const companionId = family.parentIds.find((parentId) => parentId !== family.ownerId)
  const companionKind = companionId && shouldProjectCompanion(family, validation)
    ? 'projection'
    : 'real'

  return {
    familyKey: family.key,
	  relationId: family.marriage?.id,
    ownerId: family.ownerId,
    companionId,
    companionKind,
  }
}

function getParentlessCompanionId(family: R3FamilyGroup, validation: ValidationResult): UUID | undefined {
  if (family.parentIds.length !== 2) {
    return undefined
  }

  const companionId = family.parentIds.find((parentId) => parentId !== family.ownerId)
  if (!companionId) {
    return undefined
  }

  const ownerParentCount = (validation.parentsByChild.get(family.ownerId) ?? []).length
  const companionParentCount = (validation.parentsByChild.get(companionId) ?? []).length
  return ownerParentCount > 0 && companionParentCount === 0 ? companionId : undefined
}

function getAnchoredPartnerId(relation: Relation, validation: ValidationResult): UUID | undefined {
  const fromParentCount = (validation.parentsByChild.get(relation.from) ?? []).length
  const toParentCount = (validation.parentsByChild.get(relation.to) ?? []).length
  if ((fromParentCount === 0) === (toParentCount === 0)) {
    return undefined
  }

  return fromParentCount > 0 ? relation.from : relation.to
}

function shouldProjectCompanion(family: R3FamilyGroup, validation: ValidationResult): boolean {
  if (family.parentIds.length !== 2) {
    return false
  }

  return family.parentIds.every((parentId) => (validation.parentsByChild.get(parentId) ?? []).length > 0)
}

function getSharedChildren(firstParentId: UUID, secondParentId: UUID, validation: ValidationResult): UUID[] {
  const firstChildren = new Set(validation.childrenByParent.get(firstParentId) ?? [])
  const secondChildren = validation.childrenByParent.get(secondParentId) ?? []
  return secondChildren.filter((childId) => firstChildren.has(childId)).sort((left, right) => left.localeCompare(right))
}