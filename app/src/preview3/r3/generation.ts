import type { HouseDefinitions, UUID, ValidationResult } from '../../graph'
import type { HouseLookup } from './houses'
import { comparePersonIdsForR3 } from './sorting'

export function buildGenerationRows({
  validation,
  orderedPersonIds,
  houseDefinitions,
  houseLookup,
}: {
  validation: ValidationResult
  orderedPersonIds: UUID[]
  houseDefinitions: HouseDefinitions
  houseLookup: HouseLookup
}): Map<UUID, number> {
  const seededRows = new Map<UUID, number>()
  const startHouses = houseDefinitions.houses
    .filter((house) => house.anchor.enabled && house.tier === 'start')
    .sort((left, right) => left.anchor.order - right.anchor.order || left.id.localeCompare(right.id))

  for (const house of startHouses) {
    const memberIds = orderedPersonIds.filter((personId) => houseLookup.getPrimaryHouse(personId)?.id === house.id)
    const rootIds = memberIds.filter((personId) => (validation.parentsByChild.get(personId) ?? []).length === 0)
    const seedRow = 1 + (house.layout?.yOffset ?? 0)

    for (const rootId of rootIds) {
      const current = seededRows.get(rootId)
      if (current === undefined || seedRow > current) {
        seededRows.set(rootId, seedRow)
      }
    }
  }

  const rowByPersonId = new Map<UUID, number>()
  const remainingParents = new Map<UUID, number>()
  const queue: UUID[] = []

  for (const personId of orderedPersonIds) {
    const parentCount = (validation.parentsByChild.get(personId) ?? []).length
    remainingParents.set(personId, parentCount)
    if (parentCount === 0) {
      queue.push(personId)
    }
  }

  while (queue.length > 0) {
    queue.sort((leftId, rightId) => {
      const leftRow = rowByPersonId.get(leftId) ?? seededRows.get(leftId) ?? 1
      const rightRow = rowByPersonId.get(rightId) ?? seededRows.get(rightId) ?? 1
      return leftRow - rightRow || comparePersonIdsForR3(leftId, rightId, validation.personById)
    })

    const personId = queue.shift()

    if (!personId) {
      continue
    }

    const parentIds = validation.parentsByChild.get(personId) ?? []
    const parentRow = parentIds.reduce((maximum, parentId) => Math.max(maximum, rowByPersonId.get(parentId) ?? 1), 0)
    const seededRow = seededRows.get(personId) ?? 1
    rowByPersonId.set(personId, Math.max(seededRow, parentRow > 0 ? parentRow + 1 : seededRow))

    for (const childId of validation.childrenByParent.get(personId) ?? []) {
      const nextRemaining = (remainingParents.get(childId) ?? 1) - 1
      remainingParents.set(childId, nextRemaining)
      if (nextRemaining === 0) {
        queue.push(childId)
      }
    }
  }

  return rowByPersonId
}