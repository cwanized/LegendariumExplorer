import ELK from 'elkjs/lib/elk.bundled.js'

export type UUID = string

export type TimeValue = {
  era: string
  year: number
} | null

export type SourceLink = {
  label: string
  url: string
}

export type Person = {
  id: UUID
  name: string
  gender?: string | null
  species?: string | null
  birth: TimeValue
  death: TimeValue
  houses?: string[]
  sourceLinks?: SourceLink[]
  portraitUrl?: string | null
  portraitSourceLabel?: string | null
  portraitSourceUrl?: string | null
  metadata?: {
    description?: string
  }
}

export type RelationType =
  | 'biological_parent'
  | 'marriage'
  | 'mentor'
  | 'step_parent'
  | 'adoption'
  | 'member_of'
  | 'custom'

export type Relation = {
  id: UUID
  type: RelationType
  from: UUID
  to: UUID
  attributes?: {
    date?: TimeValue
  }
}

export type EventRecord = {
  id: UUID
  type: string
  date: TimeValue
  participants: UUID[]
  metadata?: Record<string, unknown>
}

export type ScenarioDefinition = {
  name: string
  description: string
  contract: boolean
  input: {
    persons: UUID[]
    relations: UUID[]
  }
  expected?: {
    ignoredRelations?: UUID[]
    warnings?: string[]
    disconnectedComponents?: number
    status?: ValidationStatus
  }
}

export type ScenarioManifest = {
  scenarios: ScenarioDefinition[]
}

export type LoadedDataset = {
  persons: Person[]
  relations: Relation[]
  events: EventRecord[]
  manifest: ScenarioManifest
}

export type DatasetName = 'testing' | 'demo' | 'prod'

export type WarningCode = 'cycle_detected' | 'missing_reference' | 'over_parent' | 'self_parent'

export type IgnoredReason = 'cycle' | 'missing_reference' | 'over_parent' | 'self_parent'

export type ValidationWarning = {
  code: WarningCode
  message: string
  relationId?: UUID
  personId?: UUID
  relatedIds: UUID[]
}

export type IgnoredRelation = {
  relationId: UUID
  reason: IgnoredReason
}

export type ValidationStatus = 'ok' | 'warning'

export type ValidationResult = {
  persons: Person[]
  personById: Map<UUID, Person>
  relations: Relation[]
  events: EventRecord[]
  validBiologicalRelations: Relation[]
  validOverlayRelations: Relation[]
  ignoredRelations: IgnoredRelation[]
  warnings: ValidationWarning[]
  parentsByChild: Map<UUID, UUID[]>
  childrenByParent: Map<UUID, UUID[]>
  bioRelationByEndpoints: Map<string, UUID>
  disconnectedComponents: number
  status: ValidationStatus
}

export type PositionedNode = {
  id: UUID
  x: number
  y: number
  width: number
  height: number
}

export type LayoutResult = {
  nodes: Map<UUID, PositionedNode>
}

export type CameraView = {
  x: number
  y: number
  width: number
  height: number
}

export type ContractEvaluation = {
  passed: boolean
  actual: {
    ignoredRelations: UUID[]
    warnings: string[]
    disconnectedComponents: number
    status: ValidationStatus
  }
  mismatches: string[]
}

export type GraphMvpState = {
  dataset: LoadedDataset
  validation: ValidationResult
  layout: LayoutResult
  contractScenario: ScenarioDefinition | null
  contractEvaluation: ContractEvaluation | null
}

const elk = new ELK()
const nodeWidth = 176
const nodeHeight = 64

function getAppAssetPath(relativePath: string): string {
  const normalizedBasePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return `${normalizedBasePath}${relativePath.replace(/^\/+/, '')}`
}

export async function loadDataset(datasetName: DatasetName): Promise<LoadedDataset> {
  const allowMissing = datasetName === 'prod'
  const basePath = getAppAssetPath(`datasets/${datasetName}`)
  const [manifest, personIndex, relationIndex, eventIndex] = await Promise.all([
    loadJson<ScenarioManifest>(`${basePath}/scenario-manifest.json`, allowMissing, { scenarios: [] }),
    loadJson<{ items: string[] }>(`${basePath}/persons/index.json`, allowMissing, { items: [] }),
    loadJson<{ items: string[] }>(`${basePath}/relations/index.json`, allowMissing, { items: [] }),
    loadJson<{ items: string[] }>(`${basePath}/events/index.json`, allowMissing, { items: [] }),
  ])

  // Load individual item files in parallel
  const [persons, relations, events] = await Promise.all([
    Promise.all(personIndex.items.map((filename) => loadJson<Person>(`${basePath}/persons/${filename}`))),
    Promise.all(relationIndex.items.map((filename) => loadJson<Relation>(`${basePath}/relations/${filename}`))),
    Promise.all(eventIndex.items.map((filename) => loadJson<EventRecord>(`${basePath}/events/${filename}`))),
  ])

  return {
    manifest,
    persons: sortById(persons),
    relations: sortById(relations),
    events: sortById(events),
  }
}

async function loadJson<T>(path: string, allowMissing = false, fallbackValue?: T): Promise<T> {
  const response = await fetch(path)

  if (allowMissing && response.status === 404 && fallbackValue !== undefined) {
    return fallbackValue
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`)
  }

  return (await response.json()) as T
}

export function validateDataset(dataset: LoadedDataset): ValidationResult {
  const persons = sortById(dataset.persons)
  const relations = sortById(dataset.relations)
  const personById = new Map(persons.map((person) => [person.id, person]))
  const validOverlayRelations: Relation[] = []
  const biologicalCandidates: Relation[] = []
  const ignoredRelations: IgnoredRelation[] = []
  const warnings: ValidationWarning[] = []

  for (const relation of relations) {
    const fromExists = personById.has(relation.from)
    const toExists = personById.has(relation.to)

    if (!fromExists || !toExists) {
      ignoredRelations.push({ relationId: relation.id, reason: 'missing_reference' })
      warnings.push({
        code: 'missing_reference',
        message: `Relation ${relation.id} references a missing person and was ignored.`,
        relationId: relation.id,
        relatedIds: [relation.from, relation.to],
      })
      continue
    }

    if (relation.type === 'biological_parent' && relation.from === relation.to) {
      ignoredRelations.push({ relationId: relation.id, reason: 'self_parent' })
      warnings.push({
        code: 'self_parent',
        message: `Relation ${relation.id} is a self-parent edge and was ignored.`,
        relationId: relation.id,
        personId: relation.from,
        relatedIds: [relation.from],
      })
      continue
    }

    if (relation.type === 'biological_parent') {
      biologicalCandidates.push(relation)
      continue
    }

    validOverlayRelations.push(relation)
  }

  const groupedByChild = new Map<UUID, Relation[]>()

  for (const relation of biologicalCandidates) {
    const relationsForChild = groupedByChild.get(relation.to) ?? []
    relationsForChild.push(relation)
    groupedByChild.set(relation.to, relationsForChild)
  }

  const overParentChildren = new Set<UUID>()

  for (const [childId, relationsForChild] of groupedByChild) {
    if (relationsForChild.length > 2) {
      overParentChildren.add(childId)
      warnings.push({
        code: 'over_parent',
        message: `Person ${childId} has more than two biological parents; all such layout edges were ignored.`,
        personId: childId,
        relatedIds: relationsForChild.map((relation) => relation.id),
      })

      for (const relation of relationsForChild) {
        ignoredRelations.push({ relationId: relation.id, reason: 'over_parent' })
      }
    }
  }

  let validBiologicalRelations = biologicalCandidates.filter(
    (relation) => !overParentChildren.has(relation.to),
  )

  while (true) {
    const cycleEdgeIds = findCycleEdgeIds(validBiologicalRelations)

    if (cycleEdgeIds.length === 0) {
      break
    }

    const relationId = cycleEdgeIds.at(-1)

    if (!relationId) {
      break
    }

    validBiologicalRelations = validBiologicalRelations.filter((relation) => relation.id !== relationId)
    ignoredRelations.push({ relationId, reason: 'cycle' })
    warnings.push({
      code: 'cycle_detected',
      message: `Cycle detected in biological lineage; relation ${relationId} was ignored.`,
      relationId,
      relatedIds: cycleEdgeIds,
    })
  }

  const sortedIgnoredRelations = ignoredRelations.sort((left, right) =>
    left.relationId.localeCompare(right.relationId),
  )
  const sortedWarnings = warnings.sort((left, right) =>
    compareWarningKeys(left).localeCompare(compareWarningKeys(right)),
  )
  const parentsByChild = buildParentsByChild(validBiologicalRelations)
  const childrenByParent = buildChildrenByParent(validBiologicalRelations)
  const bioRelationByEndpoints = new Map(
    validBiologicalRelations.map((relation) => [`${relation.from}|${relation.to}`, relation.id]),
  )

  return {
    persons,
    personById,
    relations,
    events: dataset.events,
    validBiologicalRelations,
    validOverlayRelations: sortById(validOverlayRelations),
    ignoredRelations: sortedIgnoredRelations,
    warnings: sortedWarnings,
    parentsByChild,
    childrenByParent,
    bioRelationByEndpoints,
    disconnectedComponents: countDisconnectedComponents(persons, validBiologicalRelations),
    status: sortedWarnings.length > 0 ? 'warning' : 'ok',
  }
}

function compareWarningKeys(warning: ValidationWarning) {
  return [warning.code, warning.relationId ?? '', warning.personId ?? '', warning.message].join('|')
}

function buildParentsByChild(relations: Relation[]) {
  const parentsByChild = new Map<UUID, UUID[]>()

  for (const relation of relations) {
    const parents = parentsByChild.get(relation.to) ?? []
    parents.push(relation.from)
    parents.sort((left, right) => left.localeCompare(right))
    parentsByChild.set(relation.to, parents)
  }

  return parentsByChild
}

function buildChildrenByParent(relations: Relation[]) {
  const childrenByParent = new Map<UUID, UUID[]>()

  for (const relation of relations) {
    const children = childrenByParent.get(relation.from) ?? []
    children.push(relation.to)
    children.sort((left, right) => left.localeCompare(right))
    childrenByParent.set(relation.from, children)
  }

  return childrenByParent
}

function findCycleEdgeIds(relations: Relation[]): UUID[] {
  const adjacency = new Map<UUID, UUID[]>()

  for (const relation of relations) {
    const next = adjacency.get(relation.from) ?? []
    next.push(relation.to)
    next.sort((left, right) => left.localeCompare(right))
    adjacency.set(relation.from, next)
  }

  const indexByNode = new Map<UUID, number>()
  const lowLinkByNode = new Map<UUID, number>()
  const stack: UUID[] = []
  const onStack = new Set<UUID>()
  const cycleEdgeIds = new Set<UUID>()
  let index = 0

  function strongConnect(nodeId: UUID) {
    indexByNode.set(nodeId, index)
    lowLinkByNode.set(nodeId, index)
    index += 1
    stack.push(nodeId)
    onStack.add(nodeId)

    for (const childId of adjacency.get(nodeId) ?? []) {
      if (!indexByNode.has(childId)) {
        strongConnect(childId)
        lowLinkByNode.set(
          nodeId,
          Math.min(lowLinkByNode.get(nodeId) ?? 0, lowLinkByNode.get(childId) ?? 0),
        )
      } else if (onStack.has(childId)) {
        lowLinkByNode.set(
          nodeId,
          Math.min(lowLinkByNode.get(nodeId) ?? 0, indexByNode.get(childId) ?? 0),
        )
      }
    }

    if ((lowLinkByNode.get(nodeId) ?? -1) !== (indexByNode.get(nodeId) ?? -2)) {
      return
    }

    const component: UUID[] = []

    while (stack.length > 0) {
      const stackedNode = stack.pop()

      if (!stackedNode) {
        break
      }

      onStack.delete(stackedNode)
      component.push(stackedNode)

      if (stackedNode === nodeId) {
        break
      }
    }

    if (component.length < 2) {
      return
    }

    const componentSet = new Set(component)

    for (const relation of relations) {
      if (componentSet.has(relation.from) && componentSet.has(relation.to)) {
        cycleEdgeIds.add(relation.id)
      }
    }
  }

  const nodes = Array.from(new Set(relations.flatMap((relation) => [relation.from, relation.to]))).sort(
    (left, right) => left.localeCompare(right),
  )

  for (const nodeId of nodes) {
    if (!indexByNode.has(nodeId)) {
      strongConnect(nodeId)
    }
  }

  return Array.from(cycleEdgeIds).sort((left, right) => left.localeCompare(right))
}

function countDisconnectedComponents(persons: Person[], relations: Relation[]) {
  const adjacency = new Map<UUID, UUID[]>()

  for (const person of persons) {
    adjacency.set(person.id, [])
  }

  for (const relation of relations) {
    adjacency.get(relation.from)?.push(relation.to)
    adjacency.get(relation.to)?.push(relation.from)
  }

  const visited = new Set<UUID>()
  let components = 0

  for (const person of persons) {
    if (visited.has(person.id)) {
      continue
    }

    components += 1
    const queue = [person.id]
    visited.add(person.id)

    while (queue.length > 0) {
      const nodeId = queue.shift()

      if (!nodeId) {
        continue
      }

      for (const neighborId of adjacency.get(nodeId) ?? []) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId)
          queue.push(neighborId)
        }
      }
    }
  }

  return components
}

export async function layoutGraph(persons: Person[], relations: Relation[]): Promise<LayoutResult> {
  const sortedPersons = sortById(persons)
  const sortedRelations = sortById(relations)

  try {
    const layout = await elk.layout({
      id: 'legendarium-root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.layered.spacing.nodeNodeBetweenLayers': '110',
        'elk.spacing.nodeNode': '78',
        'elk.spacing.componentComponent': '220',
        'elk.edgeRouting': 'ORTHOGONAL',
      },
      children: sortedPersons.map((person) => ({
        id: person.id,
        width: nodeWidth,
        height: nodeHeight,
      })),
      edges: sortedRelations.map((relation) => ({
        id: relation.id,
        sources: [relation.from],
        targets: [relation.to],
      })),
    })

    const nodes = new Map<UUID, PositionedNode>()

    for (const child of layout.children ?? []) {
      nodes.set(child.id, {
        id: child.id,
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? nodeWidth,
        height: child.height ?? nodeHeight,
      })
    }

    if (nodes.size === sortedPersons.length) {
      return { nodes }
    }
  } catch (error) {
    console.warn('ELK layout failed, using deterministic fallback layout.', error)
  }

  return { nodes: fallbackLayout(sortedPersons, sortedRelations) }
}

function fallbackLayout(persons: Person[], relations: Relation[]) {
  const childIdsByParent = buildChildrenByParent(relations)
  const inDegree = new Map<UUID, number>(persons.map((person) => [person.id, 0]))

  for (const relation of relations) {
    inDegree.set(relation.to, (inDegree.get(relation.to) ?? 0) + 1)
  }

  const queue = persons
    .filter((person) => (inDegree.get(person.id) ?? 0) === 0)
    .map((person) => person.id)
    .sort((left, right) => left.localeCompare(right))
  const generationByPerson = new Map<UUID, number>()

  for (const rootId of queue) {
    generationByPerson.set(rootId, 0)
  }

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId) {
      continue
    }

    const currentGeneration = generationByPerson.get(currentId) ?? 0

    for (const childId of childIdsByParent.get(currentId) ?? []) {
      generationByPerson.set(
        childId,
        Math.max(generationByPerson.get(childId) ?? 0, currentGeneration + 1),
      )

      const nextInDegree = (inDegree.get(childId) ?? 1) - 1
      inDegree.set(childId, nextInDegree)

      if (nextInDegree === 0) {
        queue.push(childId)
        queue.sort((left, right) => left.localeCompare(right))
      }
    }
  }

  for (const person of persons) {
    if (!generationByPerson.has(person.id)) {
      generationByPerson.set(person.id, 0)
    }
  }

  const peopleByGeneration = new Map<number, Person[]>()

  for (const person of persons) {
    const generation = generationByPerson.get(person.id) ?? 0
    const people = peopleByGeneration.get(generation) ?? []
    people.push(person)
    people.sort((left, right) => `${left.name}|${left.id}`.localeCompare(`${right.name}|${right.id}`))
    peopleByGeneration.set(generation, people)
  }

  const nodes = new Map<UUID, PositionedNode>()
  const generations = Array.from(peopleByGeneration.keys()).sort((left, right) => left - right)

  for (const generation of generations) {
    const row = peopleByGeneration.get(generation) ?? []

    row.forEach((person, index) => {
      nodes.set(person.id, {
        id: person.id,
        x: index * 280,
        y: generation * 170,
        width: nodeWidth,
        height: nodeHeight,
      })
    })
  }

  return nodes
}

export function getGraphBounds(nodes: Map<UUID, PositionedNode>): CameraView {
  const positionedNodes = Array.from(nodes.values())

  if (positionedNodes.length === 0) {
    return { x: 0, y: 0, width: 1200, height: 800 }
  }

  const minX = Math.min(...positionedNodes.map((node) => node.x)) - 80
  const minY = Math.min(...positionedNodes.map((node) => node.y)) - 80
  const maxX = Math.max(...positionedNodes.map((node) => node.x + node.width)) + 80
  const maxY = Math.max(...positionedNodes.map((node) => node.y + node.height)) + 80

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1200),
    height: Math.max(maxY - minY, 780),
  }
}

export function findLowestCommonAncestor(
  firstPersonId: UUID,
  secondPersonId: UUID,
  validation: ValidationResult,
) {
  const firstDistances = ancestorDistances(firstPersonId, validation.parentsByChild)
  const secondDistances = ancestorDistances(secondPersonId, validation.parentsByChild)
  const commonAncestors = Array.from(firstDistances.keys()).filter((ancestorId) =>
    secondDistances.has(ancestorId),
  )

  if (commonAncestors.length === 0) {
    return null
  }

  commonAncestors.sort((left, right) => {
    const leftSum = (firstDistances.get(left) ?? 0) + (secondDistances.get(left) ?? 0)
    const rightSum = (firstDistances.get(right) ?? 0) + (secondDistances.get(right) ?? 0)

    if (leftSum !== rightSum) {
      return leftSum - rightSum
    }

    const leftMax = Math.max(firstDistances.get(left) ?? 0, secondDistances.get(left) ?? 0)
    const rightMax = Math.max(firstDistances.get(right) ?? 0, secondDistances.get(right) ?? 0)

    if (leftMax !== rightMax) {
      return leftMax - rightMax
    }

    return left.localeCompare(right)
  })

  const ancestorId = commonAncestors[0]
  const firstPath = pathToAncestor(firstPersonId, ancestorId, validation.parentsByChild, validation.bioRelationByEndpoints)
  const secondPath = pathToAncestor(secondPersonId, ancestorId, validation.parentsByChild, validation.bioRelationByEndpoints)

  if (!firstPath || !secondPath) {
    return null
  }

  return {
    ancestorId,
    nodeIds: new Set([...firstPath.nodeIds, ...secondPath.nodeIds]),
    edgeIds: new Set([...firstPath.edgeIds, ...secondPath.edgeIds]),
  }
}

function ancestorDistances(personId: UUID, parentsByChild: Map<UUID, UUID[]>) {
  const distances = new Map<UUID, number>([[personId, 0]])
  const queue: UUID[] = [personId]

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId) {
      continue
    }

    const currentDistance = distances.get(currentId) ?? 0

    for (const parentId of parentsByChild.get(currentId) ?? []) {
      if (!distances.has(parentId)) {
        distances.set(parentId, currentDistance + 1)
        queue.push(parentId)
      }
    }
  }

  return distances
}

function pathToAncestor(
  startId: UUID,
  ancestorId: UUID,
  parentsByChild: Map<UUID, UUID[]>,
  relationIdsByPair: Map<string, UUID>,
): { nodeIds: UUID[]; edgeIds: UUID[] } | null {
  if (startId === ancestorId) {
    return { nodeIds: [startId], edgeIds: [] }
  }

  const queue: Array<{ nodeId: UUID; nodeIds: UUID[]; edgeIds: UUID[] }> = [
    { nodeId: startId, nodeIds: [startId], edgeIds: [] },
  ]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      continue
    }

    for (const parentId of parentsByChild.get(current.nodeId) ?? []) {
      const relationId = relationIdsByPair.get(`${parentId}|${current.nodeId}`)

      if (!relationId) {
        continue
      }

      const nextNodeIds = [...current.nodeIds, parentId]
      const nextEdgeIds = [...current.edgeIds, relationId]

      if (parentId === ancestorId) {
        return {
          nodeIds: nextNodeIds,
          edgeIds: nextEdgeIds,
        }
      }

      queue.push({ nodeId: parentId, nodeIds: nextNodeIds, edgeIds: nextEdgeIds })
    }
  }

  return null
}

export function evaluateScenario(
  scenario: ScenarioDefinition,
  validation: ValidationResult,
): ContractEvaluation {
  const actual = {
    ignoredRelations: validation.ignoredRelations.map((relation) => relation.relationId),
    warnings: Array.from(new Set(validation.warnings.map((warning) => warning.code))).sort((left, right) =>
      left.localeCompare(right),
    ),
    disconnectedComponents: validation.disconnectedComponents,
    status: validation.status,
  }
  const mismatches: string[] = []

  if (scenario.expected?.ignoredRelations) {
    const expected = [...scenario.expected.ignoredRelations].sort((left, right) => left.localeCompare(right))

    if (JSON.stringify(expected) !== JSON.stringify(actual.ignoredRelations)) {
      mismatches.push('ignoredRelations mismatch')
    }
  }

  if (scenario.expected?.warnings) {
    const expected = [...scenario.expected.warnings].sort((left, right) => left.localeCompare(right))

    if (JSON.stringify(expected) !== JSON.stringify(actual.warnings)) {
      mismatches.push('warnings mismatch')
    }
  }

  if (typeof scenario.expected?.disconnectedComponents === 'number') {
    if (scenario.expected.disconnectedComponents !== actual.disconnectedComponents) {
      mismatches.push('disconnectedComponents mismatch')
    }
  }

  if (scenario.expected?.status && scenario.expected.status !== actual.status) {
    mismatches.push('status mismatch')
  }

  return {
    passed: mismatches.length === 0,
    actual,
    mismatches,
  }
}

function sortById<T extends { id: UUID }>(items: T[]) {
  return [...items].sort((left, right) => left.id.localeCompare(right.id))
}