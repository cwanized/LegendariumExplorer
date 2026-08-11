import type { HouseDefinitions, UUID, ValidationResult } from '../../graph'
import type { HouseLookup } from './houses'
import { sortPersonIdsForR3 } from './sorting'
import type { R3HouseCluster, R3PlacementPlan } from './types'

export function buildClusterAssignments({
  validation,
  orderedPersonIds,
  houseLookup,
}: {
  validation: ValidationResult
  orderedPersonIds: UUID[]
  houseLookup: HouseLookup
}): Map<UUID, string> {
  const clusterByPersonId = new Map<UUID, string>()

  for (const personId of orderedPersonIds) {
    const startHouse = houseLookup.getPrimaryStartHouse(personId)
    if (startHouse) {
      clusterByPersonId.set(personId, `house:${startHouse.id}`)
      continue
    }

    const parentIds = validation.parentsByChild.get(personId) ?? []
    const inheritedCluster = parentIds
      .map((parentId) => clusterByPersonId.get(parentId))
      .find((clusterKey): clusterKey is string => Boolean(clusterKey))

    if (inheritedCluster) {
      clusterByPersonId.set(personId, inheritedCluster)
      continue
    }

    clusterByPersonId.set(personId, `other:${personId}`)
  }

  return clusterByPersonId
}

export function buildClusters({
  validation,
  houseDefinitions,
  orderedPersonIds,
  placementPlan,
  houseLookup,
}: {
  validation: ValidationResult
  houseDefinitions: HouseDefinitions
  orderedPersonIds: UUID[]
  placementPlan: R3PlacementPlan
  houseLookup: HouseLookup
}): R3HouseCluster[] {
  const roots = orderedPersonIds.filter((personId) => (validation.parentsByChild.get(personId) ?? []).length === 0)
  const startHouseOrder = new Map(
    houseDefinitions.houses
      .filter((house) => house.anchor.enabled && house.tier === 'start')
      .sort((left, right) => left.anchor.order - right.anchor.order || left.id.localeCompare(right.id))
      .map((house, index) => [house.id, index]),
  )
  const rootsByCluster = new Map<string, UUID[]>()

  for (const rootId of roots) {
    const clusterKey = placementPlan.clusterByPersonId.get(rootId) ?? `other:${rootId}`
    const members = rootsByCluster.get(clusterKey) ?? []
    members.push(rootId)
    rootsByCluster.set(clusterKey, members)
  }

  return [...rootsByCluster.entries()]
    .map(([key, rootIds]) => {
      const sortedRootIds = sortPersonIdsForR3(rootIds, validation.personById)
      const house = houseLookup.getPrimaryStartHouse(sortedRootIds[0])
      return {
        key,
        house,
        rootIds: sortedRootIds,
        order: house ? (startHouseOrder.get(house.id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER,
      }
    })
    .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
}