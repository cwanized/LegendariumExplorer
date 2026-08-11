import type { Relation, ValidationResult, UUID } from '../graph'

export function resolveContinuationOwner({
  relation,
  validation,
  spouseOwnerOverrides,
}: {
  relation: Relation
  validation: ValidationResult
  spouseOwnerOverrides?: Record<string, UUID>
}): UUID {
  const continuationOwner = relation.attributes?.layout?.continuationOwner

  if (continuationOwner === 'from') {
    return relation.from
  }

  if (continuationOwner === 'to') {
    return relation.to
  }

  const overrideOwnerId = spouseOwnerOverrides?.[relation.id]

  if (overrideOwnerId === relation.from || overrideOwnerId === relation.to) {
    return overrideOwnerId
  }

  const fromGender = normalizeGender(validation.personById.get(relation.from)?.gender)
  const toGender = normalizeGender(validation.personById.get(relation.to)?.gender)

  if (fromGender === 'male' && toGender !== 'male') {
    return relation.from
  }

  if (toGender === 'male' && fromGender !== 'male') {
    return relation.to
  }

  return relation.from
}

function normalizeGender(value: string | null | undefined): 'male' | 'female' | 'other' {
  if (!value) {
    return 'other'
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === 'male' || normalized === 'm' || normalized === 'mann' || normalized === 'männlich') {
    return 'male'
  }

  if (normalized === 'female' || normalized === 'f' || normalized === 'frau' || normalized === 'weiblich') {
    return 'female'
  }

  return 'other'
}