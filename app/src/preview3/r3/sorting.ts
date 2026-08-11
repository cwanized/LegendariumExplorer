import { comparePersonsForLayout } from '../../graph'
import type { Person, UUID } from '../../graph'

export function comparePersonIdsForR3(leftId: UUID, rightId: UUID, personById: Map<UUID, Person>): number {
  const left = personById.get(leftId)
  const right = personById.get(rightId)

  if (left && right) {
    return comparePersonsForLayout(left, right)
  }

  if (left) {
    return -1
  }

  if (right) {
    return 1
  }

  return leftId.localeCompare(rightId)
}

export function sortPersonIdsForR3(personIds: UUID[], personById: Map<UUID, Person>): UUID[] {
  return [...personIds].sort((leftId, rightId) => comparePersonIdsForR3(leftId, rightId, personById))
}