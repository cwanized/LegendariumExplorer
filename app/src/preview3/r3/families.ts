import type { Person, Relation, UUID, ValidationResult } from '../../graph'
import { resolveContinuationOwner } from '../continuation'
import { comparePersonIdsForR3, sortPersonIdsForR3 } from './sorting'
import type { R3FamilyGroup } from './types'

export function buildBiologicalFamilies(validation: ValidationResult): R3FamilyGroup[] {
  const groupsByKey = new Map<string, { parentIds: UUID[]; childIds: UUID[] }>()

  for (const [childId, rawParentIds] of validation.parentsByChild.entries()) {
    if (rawParentIds.length === 0) {
      continue
    }

    const parentIds = sortPersonIdsForR3(rawParentIds, validation.personById)
    const key = parentIds.join('|')
    const existing = groupsByKey.get(key)

    if (existing) {
      existing.childIds.push(childId)
      continue
    }

    groupsByKey.set(key, {
      parentIds,
      childIds: [childId],
    })
  }

  return [...groupsByKey.entries()]
    .map(([key, group]) => {
      const childIds = sortPersonIdsForR3(group.childIds, validation.personById)
      const marriage = findMarriageRelation(group.parentIds, validation.validOverlayRelations)
      return {
        key,
        parentIds: group.parentIds,
        childIds,
        ownerId: resolveFamilyOwnerId({ parentIds: group.parentIds, marriage, validation }),
        marriage,
      }
    })
    .sort((left, right) => compareFamilyGroups(left, right, validation.personById))
}

export function compareFamilyGroups(left: R3FamilyGroup, right: R3FamilyGroup, personById: Map<UUID, Person>): number {
  if (left.ownerId !== right.ownerId) {
    return comparePersonIdsForR3(left.ownerId, right.ownerId, personById)
  }

  if (left.marriage && right.marriage) {
    const leftDate = left.marriage.attributes?.date?.year ?? Number.MAX_SAFE_INTEGER
    const rightDate = right.marriage.attributes?.date?.year ?? Number.MAX_SAFE_INTEGER
    if (leftDate !== rightDate) {
      return leftDate - rightDate
    }

    return left.marriage.id.localeCompare(right.marriage.id)
  }

  return left.key.localeCompare(right.key)
}

function resolveFamilyOwnerId({
  parentIds,
  marriage,
  validation,
}: {
  parentIds: UUID[]
  marriage: Relation | null
  validation: ValidationResult
}): UUID {
  if (parentIds.length === 1) {
    return parentIds[0]
  }

  if (marriage) {
    return resolveContinuationOwner({ relation: marriage, validation })
  }

  const [firstParentId, secondParentId] = parentIds
  const firstGender = (validation.personById.get(firstParentId)?.gender ?? '').trim().toLowerCase()
  const secondGender = (validation.personById.get(secondParentId)?.gender ?? '').trim().toLowerCase()

  if (firstGender === 'male' && secondGender !== 'male') {
    return firstParentId
  }

  if (secondGender === 'male' && firstGender !== 'male') {
    return secondParentId
  }

  return comparePersonIdsForR3(firstParentId, secondParentId, validation.personById) <= 0 ? firstParentId : secondParentId
}

function findMarriageRelation(parentIds: UUID[], relations: Relation[]): Relation | null {
  if (parentIds.length !== 2) {
    return null
  }

  const [leftId, rightId] = parentIds
  return relations.find((relation) => (
    relation.type === 'marriage'
    && ((relation.from === leftId && relation.to === rightId) || (relation.from === rightId && relation.to === leftId))
  )) ?? null
}