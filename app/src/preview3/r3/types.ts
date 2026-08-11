import type { HouseDefinition, Relation, UUID } from '../../graph'

export type R3FamilyGroup = {
  key: string
  parentIds: UUID[]
  childIds: UUID[]
  ownerId: UUID
  marriage: Relation | null
}

export type R3HouseCluster = {
  key: string
  house: HouseDefinition | null
  rootIds: UUID[]
  order: number
}

export type R3PlacementPlan = {
  rowByPersonId: Map<UUID, number>
  clusterByPersonId: Map<UUID, string>
  ownedFamiliesByPersonId: Map<UUID, R3FamilyGroup[]>
  families: R3FamilyGroup[]
}

export type R3FamilyPlacement = {
  key: string
  parentIds: UUID[]
  childIds: UUID[]
  axisColumn: number
  parentRow: number
  childRow: number
}

export type R3HouseAnchorPlacement = {
  key: string
  houseId: string
  displayName: string
  memberIds: UUID[]
  connectorNodeIds: UUID[]
  centerColumn: number
  rootRow: number
  width: number
  height: number
}

export type R3LayoutArtifacts = {
  familyPlacements: R3FamilyPlacement[]
  houseAnchorPlacements: R3HouseAnchorPlacement[]
  rowByPersonId: Map<UUID, number>
  clusterByPersonId: Map<UUID, string>
  normalizationOffsetX: number
  normalizationOffsetY: number
}