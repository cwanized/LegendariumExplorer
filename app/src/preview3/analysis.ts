import { findLowestCommonAncestor } from '../graph'
import type { Person, UUID, ValidationResult } from '../graph'

import type { FadeMode, FilterLogic, FilterState } from './state'

export type Preview3LcaAnalysis = ReturnType<typeof findLowestCommonAncestor>

export type Preview3ViewState = {
  filteredPeople: Person[]
  searchResults: Person[]
  matchingNodeIds: Set<UUID>
  selectedIds: UUID[]
  selectedSet: Set<UUID>
  lcaAnalysis: Preview3LcaAnalysis
  highlightedNodeIds: Set<UUID>
  highlightedEdgeIds: Set<UUID>
  filteredOutNodeIds: Set<UUID>
  shouldHideNode: (personId: UUID) => boolean
  shouldDimNode: (personId: UUID) => boolean
  hasBothSelections: boolean
  lcaState: 'idle' | 'connected' | 'disconnected'
}

export function buildPreview3ViewState({
  validation,
  filters,
  filterLogic,
  searchQuery,
  selectionA,
  selectionB,
  fadeMode,
}: {
  validation: ValidationResult
  filters: FilterState
  filterLogic: FilterLogic
  searchQuery: string
  selectionA: UUID | null
  selectionB: UUID | null
  fadeMode: FadeMode
}): Preview3ViewState {
  const searchValue = searchQuery.trim().toLocaleLowerCase()

  const personMatchesFilters = (person: Person) => {
    const matchesByCategory = [
      filters.houses.length === 0 ? null : (person.houses ?? []).some((house) => filters.houses.includes(house)),
      filters.species.length === 0 ? null : (person.species ? filters.species.includes(person.species) : false),
      filters.genders.length === 0 ? null : (person.gender ? filters.genders.includes(person.gender) : false),
      filters.eras.length === 0 ? null : filters.eras.some((era) => era === person.birth?.era || era === person.death?.era),
    ].filter((value): value is boolean => value !== null)

    if (matchesByCategory.length === 0) {
      return true
    }

    return filterLogic === 'and' ? matchesByCategory.every(Boolean) : matchesByCategory.some(Boolean)
  }

  const personMatchesSearch = (person: Person) => searchValue.length === 0 || buildSearchText(person).includes(searchValue)

  const filteredPeople = validation.persons.filter((person) => personMatchesFilters(person))
  const searchResults = filteredPeople.filter((person) => personMatchesSearch(person)).slice(0, 40)
  const matchingPeople = filteredPeople.filter((person) => personMatchesSearch(person))
  const matchingNodeIds = new Set(matchingPeople.map((person) => person.id))
  const selectedIds = [selectionA, selectionB].filter((value): value is UUID => Boolean(value))
  const selectedSet = new Set(selectedIds)
  const lcaAnalysis = selectionA && selectionB ? findLowestCommonAncestor(selectionA, selectionB, validation) : null
  const highlightedNodeIds = lcaAnalysis?.nodeIds ?? new Set<UUID>()
  const highlightedEdgeIds = lcaAnalysis?.edgeIds ?? new Set<UUID>()
  const filteredOutNodeIds = new Set(validation.persons.filter((person) => !matchingNodeIds.has(person.id)).map((person) => person.id))
  const hiddenBySelection = new Set<UUID>()

  if (lcaAnalysis && fadeMode === 'hide') {
    validation.persons.forEach((person) => {
      if (!lcaAnalysis.nodeIds.has(person.id) && person.id !== selectionA && person.id !== selectionB) {
        hiddenBySelection.add(person.id)
      }
    })
  }

  const shouldHideNode = (personId: UUID) => hiddenBySelection.has(personId)
  const shouldDimNode = (personId: UUID) => Boolean(lcaAnalysis && fadeMode === 'dim' && !lcaAnalysis.nodeIds.has(personId) && personId !== selectionA && personId !== selectionB)
  const hasBothSelections = Boolean(selectionA && selectionB)
  const lcaState: 'idle' | 'connected' | 'disconnected' = lcaAnalysis ? 'connected' : hasBothSelections ? 'disconnected' : 'idle'

  return {
    filteredPeople,
    searchResults,
    matchingNodeIds,
    selectedIds,
    selectedSet,
    lcaAnalysis,
    highlightedNodeIds,
    highlightedEdgeIds,
    filteredOutNodeIds,
    shouldHideNode,
    shouldDimNode,
    hasBothSelections,
    lcaState,
  }
}

function buildSearchText(person: Person): string {
  return [
    person.name,
    person.gender ?? '',
    person.species,
    person.houses?.join(' '),
    person.birth?.era,
    person.death?.era,
    person.birth?.year?.toString() ?? '',
    person.death?.year?.toString() ?? '',
    person.metadata?.description ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase()
}
