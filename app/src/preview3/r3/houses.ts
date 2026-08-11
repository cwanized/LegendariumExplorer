import type { HouseDefinition, HouseDefinitions, Person, UUID } from '../../graph'

export type HouseLookup = {
  getPrimaryHouse: (personId: UUID) => HouseDefinition | null
  getPrimaryStartHouse: (personId: UUID) => HouseDefinition | null
}

export function createHouseLookup(houseDefinitions: HouseDefinitions, personById: Map<UUID, Person>): HouseLookup {
  const houseByKey = new Map<string, HouseDefinition>()

  for (const house of houseDefinitions.houses) {
    houseByKey.set(normalizeHouseKey(house.id), house)
    houseByKey.set(normalizeHouseKey(house.displayName), house)
    for (const alias of house.aliases ?? []) {
      houseByKey.set(normalizeHouseKey(alias), house)
    }
  }

  const getPrimaryHouse = (personId: UUID): HouseDefinition | null => {
    const person = personById.get(personId)

    if (!person) {
      return null
    }

    for (const houseName of person.houses ?? []) {
      const house = houseByKey.get(normalizeHouseKey(houseName))
      if (house) {
        return house
      }
    }

    return null
  }

  const getPrimaryStartHouse = (personId: UUID): HouseDefinition | null => {
    const house = getPrimaryHouse(personId)
    if (!house || house.tier !== 'start' || !house.anchor.enabled) {
      return null
    }

    return house
  }

  return {
    getPrimaryHouse,
    getPrimaryStartHouse,
  }
}

export function normalizeHouseKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}