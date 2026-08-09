import { comparePersonsForLayout } from '../graph'
import type {
  HouseDefinition,
  HouseDefinitions,
  LayoutResult,
  Person,
  PositionedNode,
  Relation,
  UUID,
  ValidationResult,
} from '../graph'

const NODE_WIDTH = 176
const NODE_HEIGHT = 64
const OUTER_PADDING = 40
const GENERATION_HEIGHT = 194
const COLUMN_SIZE = 220
const PARTNER_GAP = 40
const BLOCK_GAP_SPAN = 0.35
const SIBLING_BLOCK_GAP_SPAN = 0.16
const SIBLING_DESCENDANT_SPAN_CAP = 1.35
const GROUP_GAP_SPAN = 0.45
const HOUSE_GAP_SPAN = 1.2
const CORRIDOR_PADDING_SPAN = 0.7
const PAIR_OWN_SPAN = (2 * NODE_WIDTH + PARTNER_GAP) / COLUMN_SIZE
const CORRIDOR_COMPACTION_GAP = 0.8 * COLUMN_SIZE
const APPLY_R2_BIOLOGICAL_SYMMETRY_POSTPASS = true
const APPLY_R2_PARENTLESS_ADJACENCY_POSTPASS = true
const APPLY_R2_MARRIAGE_ROW_HARMONIZATION = false
const APPLY_R2_MARRIAGE_Y_ALIGNMENT_POSTPASS = false
const R2_SYMMETRY_MAX_SHIFT_PER_PASS = COLUMN_SIZE * 1.35

type FamilyGroup = {
  key: string
  parentIds: UUID[]
  childIds: UUID[]
}

type HouseContext = {
  house: HouseDefinition
  rootIds: UUID[]
}

type CoupleBlock = {
  key: string
  memberIds: [UUID, UUID]
  parentIds: UUID[]
  childIds: UUID[]
}

type FamilyBlock = {
  key: string
  parentIds: UUID[]
  childIds: UUID[]
  memberIds: UUID[]
  blocks: UUID[][]
}

type RowGroup = {
  key: string
  memberIds: UUID[]
  parentIds: UUID[]
  desiredCenter: number
  blocks: UUID[][]
  widthSpan: number
  blockGapSpan: number
  descendantSpanCap?: number
  leftSpan: number
}

type CorridorDefinition = {
  key: string
  leftSpan: number
  widthSpan: number
  centerSpan: number
}

export function buildModeR2Layout(validation: ValidationResult, houseDefinitions: HouseDefinitions): LayoutResult {
  const personById = validation.personById
  const houseHelpers = createHouseHelpers(houseDefinitions, personById)
  const startHouses = houseDefinitions.houses
    .filter((house) => house.anchor.enabled && house.tier === 'start')
    .sort((left, right) => left.anchor.order - right.anchor.order || left.id.localeCompare(right.id))
  const orderedPersons = [...validation.persons].sort(comparePersonsForLayout)
  const orderedPersonIds = orderedPersons.map((person) => person.id)
  const personComparator = (leftId: UUID, rightId: UUID) => comparePersonIds(leftId, rightId, personById)
  const familyGroups = buildFamilyGroups(validation, personComparator)
  const familyByKey = new Map(familyGroups.map((group) => [group.key, group]))
  const sharedChildPairKeys = new Set(
    familyGroups
      .filter((group) => group.parentIds.length === 2)
      .map((group) => group.parentIds.join('|')),
  )
  const coParentIdsByPersonId = buildCoParentMap(familyGroups)
  const familiesByParentId = new Map<UUID, FamilyGroup[]>()

  for (const group of familyGroups) {
    for (const parentId of group.parentIds) {
      const parentGroups = familiesByParentId.get(parentId) ?? []
      parentGroups.push(group)
      parentGroups.sort((left, right) => left.key.localeCompare(right.key))
      familiesByParentId.set(parentId, parentGroups)
    }
  }

  const startHouseContexts = buildStartHouseContexts({
    validation,
    startHouses,
    getPrimaryHouse: houseHelpers.getPrimaryHouse,
    compareIds: personComparator,
  })
  const rowByPersonId = buildGenerationRows({
    validation,
    orderedPersonIds,
    startHouseContexts,
  })
  const spouseIdsByPersonId = buildSpouseMap(validation.validOverlayRelations, personById)
  const placementOwnerByPersonId = resolvePlacementOwners({
    validation,
    familyGroups,
    orderedPersonIds,
    rowByPersonId,
    startHouseContexts,
    getPrimaryStartHouse: houseHelpers.getPrimaryStartHouse,
    spouseIdsByPersonId,
    personById,
  })
  const componentKeyByPersonId = buildUndirectedComponentKeys(validation, orderedPersonIds, personComparator)
  const partnerIdsByPersonId = buildPartnerMap(spouseIdsByPersonId, coParentIdsByPersonId)
  const corridorKeyByPersonId = new Map<UUID, string>()

  for (const personId of orderedPersonIds) {
    const ownerHouseId = placementOwnerByPersonId.get(personId)
    const corridorKey = ownerHouseId ? `house:${ownerHouseId}` : `other:${componentKeyByPersonId.get(personId) ?? personId}`
    corridorKeyByPersonId.set(personId, corridorKey)
  }

  for (let pass = 0; pass < 3; pass += 1) {
    for (const personId of orderedPersonIds) {
      const parentIds = validation.parentsByChild.get(personId) ?? []
      if (parentIds.length !== 0) {
        continue
      }

      const partnerIds = [...(partnerIdsByPersonId.get(personId) ?? new Set<UUID>())]
        .filter((partnerId) => (validation.parentsByChild.get(partnerId) ?? []).length > 0)
      if (partnerIds.length === 0) {
        continue
      }

      const partnerCorridors = partnerIds
        .map((partnerId) => corridorKeyByPersonId.get(partnerId))
        .filter((corridorKey): corridorKey is string => Boolean(corridorKey))
        .sort((left, right) => left.localeCompare(right))
      const targetCorridor = partnerCorridors[0]
      if (!targetCorridor) {
        continue
      }

      corridorKeyByPersonId.set(personId, targetCorridor)
    }
  }

  const getCorridorKey = (personId: UUID) => {
    return corridorKeyByPersonId.get(personId) ?? `other:${componentKeyByPersonId.get(personId) ?? personId}`
  }

  const personSpanCache = new Map<UUID, number>()
  const familySpanCache = new Map<string, number>()

  const getPersonSpan = (personId: UUID): number => {
    const cached = personSpanCache.get(personId)
    if (cached !== undefined) {
      return cached
    }

    const parentGroups = familiesByParentId.get(personId) ?? []
    const span = parentGroups.length === 0
      ? 1
      : Math.max(1, ...parentGroups.map((group) => getFamilySpan(group.key)))
    personSpanCache.set(personId, span)
    return span
  }

  const getFamilySpan = (familyKey: string): number => {
    const cached = familySpanCache.get(familyKey)
    if (cached !== undefined) {
      return cached
    }

    const family = familyByKey.get(familyKey)
    if (!family) {
      return 1
    }

    const childSpan = family.childIds.reduce((sum, childId, index) => {
      const nextSum = sum + getPersonSpan(childId)
      return index === family.childIds.length - 1 ? nextSum : nextSum + GROUP_GAP_SPAN
    }, 0)
    const span = Math.max(family.parentIds.length === 2 ? PAIR_OWN_SPAN : 1, childSpan || 1)
    familySpanCache.set(familyKey, span)
    return span
  }

  const getBlockSpan = (block: UUID[]): number => {
    if (block.length === 1) {
      return Math.max(1, getPersonSpan(block[0]))
    }

    const pairKey = [...block].sort(personComparator).join('|')
    const sharedFamilySpan = familyByKey.has(pairKey) ? getFamilySpan(pairKey) : 0
    return Math.max(PAIR_OWN_SPAN, sharedFamilySpan, getPersonSpan(block[0]), getPersonSpan(block[1]))
  }

  const getBlockSpanWithinGroup = (block: UUID[], descendantSpanCap?: number): number => {
    const baseSpan = getBlockSpan(block)
    if (block.length === 1 && descendantSpanCap !== undefined) {
      return Math.max(1, Math.min(baseSpan, descendantSpanCap))
    }

    return baseSpan
  }

  const getGroupWidthSpan = (blocks: UUID[][], blockGapSpan = BLOCK_GAP_SPAN, descendantSpanCap?: number): number => blocks.reduce((sum, block, index) => {
    const nextSum = sum + getBlockSpanWithinGroup(block, descendantSpanCap)
    return index === blocks.length - 1 ? nextSum : nextSum + blockGapSpan
  }, 0)

  const rowIdsByGeneration = new Map<number, UUID[]>()
  for (const personId of orderedPersonIds) {
    const row = rowByPersonId.get(personId) ?? 1
    const rowIds = rowIdsByGeneration.get(row) ?? []
    rowIds.push(personId)
    rowIdsByGeneration.set(row, rowIds)
  }

  const corridorDefinitions = buildCorridorDefinitions({
    rowIdsByGeneration,
    startHouses,
    orderedPersonIds,
    getCorridorKey,
    spouseIdsByPersonId,
    coParentIdsByPersonId,
    sharedChildPairKeys,
    getGroupWidthSpan,
    compareIds: personComparator,
  })

  const positionedNodes = new Map<UUID, PositionedNode>()
  const centerSpanByPersonId = new Map<UUID, number>()
  const sortedRows = [...rowIdsByGeneration.keys()].sort((left, right) => left - right)

  for (const row of sortedRows) {
    const rowIds = rowIdsByGeneration.get(row) ?? []
    const membersByCorridor = new Map<string, UUID[]>()

    for (const personId of rowIds) {
      const corridorKey = getCorridorKey(personId)
      const members = membersByCorridor.get(corridorKey) ?? []
      members.push(personId)
      membersByCorridor.set(corridorKey, members)
    }

    const rowY = row * GENERATION_HEIGHT
    for (const corridor of corridorDefinitions) {
      const corridorMemberIds = membersByCorridor.get(corridor.key)
      if (!corridorMemberIds || corridorMemberIds.length === 0) {
        continue
      }

      const rowIdSet = new Set(corridorMemberIds)
      const familyBlocks = buildFamilyBlocksForRow({
        memberIds: corridorMemberIds,
        rowIdSet,
        validation,
        familyByKey,
        spouseIdsByPersonId,
        coParentIdsByPersonId,
        sharedChildPairKeys,
        compareIds: personComparator,
      })

      const groups: RowGroup[] = familyBlocks.map((familyBlock) => {
        const memberIds = [...familyBlock.memberIds].sort(personComparator)
        const blockGapSpan = resolveGroupBlockGapSpan(familyBlock)
        const descendantSpanCap = resolveGroupDescendantSpanCap(familyBlock)
        const widthSpan = getGroupWidthSpan(familyBlock.blocks, blockGapSpan, descendantSpanCap)
        const desiredCenter = resolveDesiredCenter({
          parentIds: familyBlock.parentIds,
          corridorCenter: corridor.centerSpan,
          centerSpanByPersonId,
        })

        return {
          key: familyBlock.key,
          memberIds,
          parentIds: familyBlock.parentIds,
          desiredCenter,
          blocks: familyBlock.blocks,
          widthSpan,
          blockGapSpan,
          descendantSpanCap,
          leftSpan: corridor.leftSpan,
        }
      })

      groups.sort((left, right) => {
        if (left.desiredCenter !== right.desiredCenter) {
          return left.desiredCenter - right.desiredCenter
        }

        return personComparator(left.memberIds[0], right.memberIds[0])
      })

      layoutGroupsWithinCorridor(groups, corridor)

      for (const group of groups) {
        let blockCursor = group.leftSpan

        for (const block of group.blocks) {
          const blockSpan = getBlockSpanWithinGroup(block, group.descendantSpanCap)
          const slotX = blockCursor * COLUMN_SIZE
          const slotWidth = blockSpan * COLUMN_SIZE
          const blockCenterSpan = blockCursor + blockSpan / 2

          if (block.length === 1) {
            const personId = block[0]
            const personX = slotX + (slotWidth - NODE_WIDTH) / 2
            positionedNodes.set(personId, {
              id: personId,
              x: personX,
              y: rowY,
              width: NODE_WIDTH,
              height: NODE_HEIGHT,
            })
            centerSpanByPersonId.set(personId, blockCenterSpan)
            blockCursor += blockSpan + group.blockGapSpan
            continue
          }

          const pairWidth = 2 * NODE_WIDTH + PARTNER_GAP
          const pairLeft = slotX + (slotWidth - pairWidth) / 2
          const leftId = block[0]
          const rightId = block[1]
          const leftX = pairLeft
          const rightX = pairLeft + NODE_WIDTH + PARTNER_GAP

          positionedNodes.set(leftId, {
            id: leftId,
            x: leftX,
            y: rowY,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          })
          positionedNodes.set(rightId, {
            id: rightId,
            x: rightX,
            y: rowY,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          })
          centerSpanByPersonId.set(leftId, blockCenterSpan)
          centerSpanByPersonId.set(rightId, blockCenterSpan)
          blockCursor += blockSpan + group.blockGapSpan
        }
      }
    }
  }

  if (positionedNodes.size === 0) {
    return { nodes: positionedNodes }
  }

  const compactedNodes = compactCorridorLayout({
    nodes: positionedNodes,
    corridorDefinitions,
    corridorKeyByPersonId,
  })

  const symmetryAlignedNodes = APPLY_R2_BIOLOGICAL_SYMMETRY_POSTPASS
    ? enforceBiologicalFamilySymmetry({
        nodes: compactedNodes,
        familyGroups,
      })
    : compactedNodes

  const postProcessedNodes = APPLY_R2_PARENTLESS_ADJACENCY_POSTPASS
    ? enforceParentlessPartnerAdjacency({
        nodes: symmetryAlignedNodes,
        partnerIdsByPersonId,
        parentsByChild: validation.parentsByChild,
      })
    : symmetryAlignedNodes

  const marriageAlignedYNodes = APPLY_R2_MARRIAGE_Y_ALIGNMENT_POSTPASS
    ? enforceMarriagePairYAlignment({
        nodes: postProcessedNodes,
        marriages: validation.validOverlayRelations,
        parentsByChild: validation.parentsByChild,
        childrenByParent: validation.childrenByParent,
      })
    : postProcessedNodes

  const minX = Math.min(...[...marriageAlignedYNodes.values()].map((node) => node.x))
  const minY = Math.min(...[...marriageAlignedYNodes.values()].map((node) => node.y))
  const normalizedNodes = new Map<UUID, PositionedNode>()

  for (const node of marriageAlignedYNodes.values()) {
    normalizedNodes.set(node.id, {
      ...node,
      x: node.x - minX + OUTER_PADDING,
      y: node.y - minY + OUTER_PADDING,
    })
  }

  return {
    nodes: normalizedNodes,
  }
}

function resolveGroupBlockGapSpan(familyBlock: FamilyBlock): number {
  const isSiblingSingletonGroup = familyBlock.parentIds.length > 0
    && familyBlock.blocks.length > 1
    && familyBlock.blocks.every((block) => block.length === 1)

  return isSiblingSingletonGroup ? SIBLING_BLOCK_GAP_SPAN : BLOCK_GAP_SPAN
}

function resolveGroupDescendantSpanCap(familyBlock: FamilyBlock): number | undefined {
  const isSiblingSingletonGroup = familyBlock.parentIds.length > 0
    && familyBlock.blocks.length > 1
    && familyBlock.blocks.every((block) => block.length === 1)

  return isSiblingSingletonGroup ? SIBLING_DESCENDANT_SPAN_CAP : undefined
}

function enforceBiologicalFamilySymmetry({
  nodes,
  familyGroups,
}: {
  nodes: Map<UUID, PositionedNode>
  familyGroups: FamilyGroup[]
}): Map<UUID, PositionedNode> {
  const adjustedNodes = new Map(nodes)
  const parentIdsWithChildren = new Set<UUID>()
  for (const family of familyGroups) {
    for (const parentId of family.parentIds) {
      parentIdsWithChildren.add(parentId)
    }
  }
  const familiesByTopRow = [...familyGroups].sort((left, right) => {
    const leftRow = Math.min(...left.childIds.map((childId) => adjustedNodes.get(childId)?.y ?? Number.MAX_SAFE_INTEGER))
    const rightRow = Math.min(...right.childIds.map((childId) => adjustedNodes.get(childId)?.y ?? Number.MAX_SAFE_INTEGER))

    if (leftRow !== rightRow) {
      return leftRow - rightRow
    }

    return left.key.localeCompare(right.key)
  })

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false

    for (const family of familiesByTopRow) {
      const parentNodes = family.parentIds
        .map((parentId) => adjustedNodes.get(parentId))
        .filter((node): node is PositionedNode => node !== undefined)
      const movableChildIds = family.childIds.filter((childId) => !parentIdsWithChildren.has(childId))
      if (movableChildIds.length === 0) {
        continue
      }
      const effectiveChildIds = movableChildIds
      const childNodes = effectiveChildIds
        .map((childId) => adjustedNodes.get(childId))
        .filter((node): node is PositionedNode => node !== undefined)

      if (parentNodes.length === 0 || childNodes.length === 0) {
        continue
      }

      const parentCenter = resolveFamilyParentCenter(parentNodes, family.parentIds.length)
      const childCenters = childNodes.map((node) => node.x + node.width / 2)
      const childCenter = (Math.min(...childCenters) + Math.max(...childCenters)) / 2
      const deltaX = parentCenter - childCenter
      const clampedDeltaX = Math.max(-R2_SYMMETRY_MAX_SHIFT_PER_PASS, Math.min(R2_SYMMETRY_MAX_SHIFT_PER_PASS, deltaX))

      if (Math.abs(clampedDeltaX) < 0.5) {
        continue
      }

      changed = true
      for (const childId of effectiveChildIds) {
        const node = adjustedNodes.get(childId)
        if (!node) {
          continue
        }

        adjustedNodes.set(childId, {
          ...node,
          x: node.x + clampedDeltaX,
        })
      }
    }

    if (!changed) {
      break
    }
  }

  return adjustedNodes
}

function resolveFamilyParentCenter(parentNodes: PositionedNode[], parentCount: number): number {
  if (parentCount <= 1 || parentNodes.length <= 1) {
    return parentNodes[0].x + parentNodes[0].width / 2
  }

  const sortedByY = [...parentNodes].sort((left, right) => left.y - right.y)
  const topParent = sortedByY[0]
  const bottomParent = sortedByY[sortedByY.length - 1]
  const generationGap = Math.abs(bottomParent.y - topParent.y)

  // For split-generation couples, prefer the local visual pair center around the lower parent.
  if (generationGap >= 2 * GENERATION_HEIGHT) {
    const bottomCenter = bottomParent.x + bottomParent.width / 2
    const topCenter = topParent.x + topParent.width / 2
    const direction = topCenter >= bottomCenter ? 1 : -1
    return bottomCenter + direction * ((NODE_WIDTH + PARTNER_GAP) / 2)
  }

  const parentCenters = parentNodes.map((node) => node.x + node.width / 2)
  return (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2
}

function enforceParentlessPartnerAdjacency({
  nodes,
  partnerIdsByPersonId,
  parentsByChild,
}: {
  nodes: Map<UUID, PositionedNode>
  partnerIdsByPersonId: Map<UUID, Set<UUID>>
  parentsByChild: Map<UUID, UUID[]>
}): Map<UUID, PositionedNode> {
  const adjustedNodes = new Map(nodes)
  const processedPairKeys = new Set<string>()

  for (const [personId, partnerIds] of partnerIdsByPersonId.entries()) {
    for (const partnerId of partnerIds) {
      const pairKey = [personId, partnerId].sort().join('|')
      if (processedPairKeys.has(pairKey)) {
        continue
      }
      processedPairKeys.add(pairKey)

      const personParentCount = (parentsByChild.get(personId) ?? []).length
      const partnerParentCount = (parentsByChild.get(partnerId) ?? []).length

      if (!((personParentCount === 0 && partnerParentCount > 0) || (partnerParentCount === 0 && personParentCount > 0))) {
        continue
      }

      const floatingId = personParentCount === 0 ? personId : partnerId
      const anchoredId = personParentCount === 0 ? partnerId : personId
      const floatingNode = adjustedNodes.get(floatingId)
      const anchoredNode = adjustedNodes.get(anchoredId)

      if (!floatingNode || !anchoredNode) {
        continue
      }

      const toRight = floatingNode.x >= anchoredNode.x
      const targetX = toRight
        ? anchoredNode.x + anchoredNode.width + PARTNER_GAP
        : anchoredNode.x - floatingNode.width - PARTNER_GAP

      adjustedNodes.set(floatingId, {
        ...floatingNode,
        x: targetX,
        y: anchoredNode.y,
      })
    }
  }

  return adjustedNodes
}

function enforceMarriagePairYAlignment({
  nodes,
  marriages,
  parentsByChild,
  childrenByParent,
}: {
  nodes: Map<UUID, PositionedNode>
  marriages: Relation[]
  parentsByChild: Map<UUID, UUID[]>
  childrenByParent: Map<UUID, UUID[]>
}): Map<UUID, PositionedNode> {
  const adjustedNodes = new Map(nodes)

  for (const relation of marriages.filter((candidate) => candidate.type === 'marriage')) {
    const fromNode = adjustedNodes.get(relation.from)
    const toNode = adjustedNodes.get(relation.to)
    if (!fromNode || !toNode) {
      continue
    }

    const fromParentCount = (parentsByChild.get(relation.from) ?? []).length
    const toParentCount = (parentsByChild.get(relation.to) ?? []).length
    const fromDegree = fromParentCount + (childrenByParent.get(relation.from) ?? []).length
    const toDegree = toParentCount + (childrenByParent.get(relation.to) ?? []).length

    let anchorId = relation.from
    let movingId = relation.to

    if (toParentCount > fromParentCount || (toParentCount === fromParentCount && toDegree > fromDegree)) {
      anchorId = relation.to
      movingId = relation.from
    }

    const anchorNode = adjustedNodes.get(anchorId)
    const movingNode = adjustedNodes.get(movingId)
    if (!anchorNode || !movingNode) {
      continue
    }

    if (Math.abs(anchorNode.y - movingNode.y) < 0.5) {
      continue
    }

    adjustedNodes.set(movingId, {
      ...movingNode,
      y: anchorNode.y,
    })
  }

  return adjustedNodes
}

function compactCorridorLayout({
  nodes,
  corridorDefinitions,
  corridorKeyByPersonId,
}: {
  nodes: Map<UUID, PositionedNode>
  corridorDefinitions: CorridorDefinition[]
  corridorKeyByPersonId: Map<UUID, string>
}): Map<UUID, PositionedNode> {
  const nodeIdsByCorridorKey = new Map<string, UUID[]>()

  for (const [personId, corridorKey] of corridorKeyByPersonId.entries()) {
    const node = nodes.get(personId)
    if (!node) {
      continue
    }

    const nodeIds = nodeIdsByCorridorKey.get(corridorKey) ?? []
    nodeIds.push(personId)
    nodeIdsByCorridorKey.set(corridorKey, nodeIds)
  }

  const compactedNodes = new Map(nodes)
  let previousRight = Number.NEGATIVE_INFINITY

  for (const corridor of corridorDefinitions) {
    const nodeIds = nodeIdsByCorridorKey.get(corridor.key) ?? []
    if (nodeIds.length === 0) {
      continue
    }

    const corridorNodes = nodeIds
      .map((nodeId) => compactedNodes.get(nodeId))
      .filter((node): node is PositionedNode => node !== undefined)

    if (corridorNodes.length === 0) {
      continue
    }

    const minX = Math.min(...corridorNodes.map((node) => node.x))
    const maxX = Math.max(...corridorNodes.map((node) => node.x + node.width))
    const targetMinX = Number.isFinite(previousRight)
      ? previousRight + CORRIDOR_COMPACTION_GAP
      : minX
    const deltaX = targetMinX - minX

    if (Math.abs(deltaX) > 0.5) {
      for (const node of corridorNodes) {
        compactedNodes.set(node.id, {
          ...node,
          x: node.x + deltaX,
        })
      }
    }

    previousRight = maxX + deltaX
  }

  return compactedNodes
}

function buildFamilyGroups(validation: ValidationResult, compareIds: (leftId: UUID, rightId: UUID) => number): FamilyGroup[] {
  const groupsByKey = new Map<string, FamilyGroup>()

  for (const [childId, parentIdsRaw] of validation.parentsByChild.entries()) {
    if (parentIdsRaw.length === 0) {
      continue
    }

    const parentIds = [...parentIdsRaw].sort(compareIds)
    const key = parentIds.join('|')
    const existing = groupsByKey.get(key)

    if (existing) {
      existing.childIds.push(childId)
      existing.childIds.sort(compareIds)
      continue
    }

    groupsByKey.set(key, {
      key,
      parentIds,
      childIds: [childId],
    })
  }

  return [...groupsByKey.values()].sort((left, right) => left.key.localeCompare(right.key))
}

function buildStartHouseContexts({
  validation,
  startHouses,
  getPrimaryHouse,
  compareIds,
}: {
  validation: ValidationResult
  startHouses: HouseDefinition[]
  getPrimaryHouse: (personId: UUID) => HouseDefinition | null
  compareIds: (leftId: UUID, rightId: UUID) => number
}): HouseContext[] {
  const baseGenerationCache = new Map<UUID, number>()

  return startHouses.map((house) => {
    const memberIds = validation.persons
      .filter((person) => getPrimaryHouse(person.id)?.id === house.id)
      .map((person) => person.id)
      .sort(compareIds)
    let rootIds = memberIds.filter((personId) => {
      const parentIds = validation.parentsByChild.get(personId) ?? []
      return parentIds.length === 0
    })

    if (rootIds.length === 0 && memberIds.length > 0) {
      const rootGeneration = Math.min(...memberIds.map((personId) => getBaseGeneration(personId, validation, baseGenerationCache, new Set())))
      rootIds = memberIds.filter((personId) => getBaseGeneration(personId, validation, baseGenerationCache, new Set()) === rootGeneration)
    }

    return {
      house,
      rootIds: rootIds.sort(compareIds),
    }
  })
}

function buildGenerationRows({
  validation,
  orderedPersonIds,
  startHouseContexts,
}: {
  validation: ValidationResult
  orderedPersonIds: UUID[]
  startHouseContexts: HouseContext[]
}): Map<UUID, number> {
  const seededRows = new Map<UUID, number>()

  for (const context of startHouseContexts) {
    const seedRow = (context.house.layout?.yOffset ?? 0) + 1
    for (const rootId of context.rootIds) {
      const currentSeed = seededRows.get(rootId)
      if (currentSeed === undefined || seedRow > currentSeed) {
        seededRows.set(rootId, seedRow)
      }
    }
  }

  const remainingParents = new Map<UUID, number>()
  for (const personId of orderedPersonIds) {
    remainingParents.set(personId, (validation.parentsByChild.get(personId) ?? []).length)
  }

  const rowByPersonId = new Map<UUID, number>()
  const queue = orderedPersonIds.filter((personId) => (remainingParents.get(personId) ?? 0) === 0)

  while (queue.length > 0) {
    queue.sort((left, right) => (rowByPersonId.get(left) ?? seededRows.get(left) ?? 1) - (rowByPersonId.get(right) ?? seededRows.get(right) ?? 1) || left.localeCompare(right))
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

  for (const personId of orderedPersonIds) {
    if (!rowByPersonId.has(personId)) {
      rowByPersonId.set(personId, seededRows.get(personId) ?? 1)
    }
  }

  if (APPLY_R2_MARRIAGE_ROW_HARMONIZATION) {
    harmonizeMarriageRows(validation, rowByPersonId)
    enforceBiologicalRowOrder(validation, rowByPersonId)
  }

  return rowByPersonId
}

function harmonizeMarriageRows(validation: ValidationResult, rowByPersonId: Map<UUID, number>): void {
  const marriages = validation.validOverlayRelations
    .filter((relation) => relation.type === 'marriage')
    .sort((left, right) => left.id.localeCompare(right.id))

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false

    for (const relation of marriages) {
      const fromRow = rowByPersonId.get(relation.from) ?? 1
      const toRow = rowByPersonId.get(relation.to) ?? 1
      if (fromRow === toRow) {
        continue
      }

      const fromParentIds = validation.parentsByChild.get(relation.from) ?? []
      const toParentIds = validation.parentsByChild.get(relation.to) ?? []
      const minFromRow = fromParentIds.length === 0
        ? 1
        : Math.max(...fromParentIds.map((parentId) => rowByPersonId.get(parentId) ?? 1)) + 1
      const minToRow = toParentIds.length === 0
        ? 1
        : Math.max(...toParentIds.map((parentId) => rowByPersonId.get(parentId) ?? 1)) + 1
      const targetRow = Math.max(fromRow, toRow, minFromRow, minToRow)

      if (fromRow !== targetRow) {
        rowByPersonId.set(relation.from, targetRow)
        changed = true
      }

      if (toRow !== targetRow) {
        rowByPersonId.set(relation.to, targetRow)
        changed = true
      }
    }

    if (!changed) {
      break
    }
  }
}

function enforceBiologicalRowOrder(validation: ValidationResult, rowByPersonId: Map<UUID, number>): void {
  const biologicalRelations = validation.validBiologicalRelations
    .filter((relation) => relation.type === 'biological_parent')

  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false

    for (const relation of biologicalRelations) {
      const parentRow = rowByPersonId.get(relation.from) ?? 1
      const childRow = rowByPersonId.get(relation.to) ?? 1
      const minChildRow = parentRow + 1

      if (childRow >= minChildRow) {
        continue
      }

      rowByPersonId.set(relation.to, minChildRow)
      changed = true
    }

    if (!changed) {
      break
    }
  }
}

function resolvePlacementOwners({
  validation,
  familyGroups,
  orderedPersonIds,
  rowByPersonId,
  startHouseContexts,
  getPrimaryStartHouse,
  spouseIdsByPersonId,
  personById,
}: {
  validation: ValidationResult
  familyGroups: FamilyGroup[]
  orderedPersonIds: UUID[]
  rowByPersonId: Map<UUID, number>
  startHouseContexts: HouseContext[]
  getPrimaryStartHouse: (personId: UUID) => HouseDefinition | null
  spouseIdsByPersonId: Map<UUID, Set<UUID>>
  personById: Map<UUID, Person>
}): Map<UUID, string | null> {
  const ownerByPersonId = new Map<UUID, string | null>()
  const protectedRootOwnerByPersonId = new Map<UUID, string>()

  for (const context of startHouseContexts) {
    for (const rootId of context.rootIds) {
      protectedRootOwnerByPersonId.set(rootId, context.house.id)
      ownerByPersonId.set(rootId, context.house.id)
    }
  }

  const sortedFamilies = [...familyGroups].sort((left, right) => {
    const leftRow = Math.min(...left.childIds.map((childId) => rowByPersonId.get(childId) ?? Number.MAX_SAFE_INTEGER))
    const rightRow = Math.min(...right.childIds.map((childId) => rowByPersonId.get(childId) ?? Number.MAX_SAFE_INTEGER))

    if (leftRow !== rightRow) {
      return leftRow - rightRow
    }

    return left.key.localeCompare(right.key)
  })

  for (let pass = 0; pass < 3; pass += 1) {
    for (const personId of orderedPersonIds) {
      if (ownerByPersonId.has(personId)) {
        continue
      }

      const startHouse = getPrimaryStartHouse(personId)
      if (startHouse) {
        ownerByPersonId.set(personId, startHouse.id)
      }
    }

    for (const personId of orderedPersonIds) {
      const parentIds = validation.parentsByChild.get(personId) ?? []
      if (parentIds.length !== 0) {
        continue
      }

      const spouseIds = spouseIdsByPersonId.get(personId)
      if (!spouseIds || spouseIds.size === 0) {
        continue
      }

      const spouseOwnerCandidates = [...spouseIds]
        .filter((spouseId) => (validation.parentsByChild.get(spouseId) ?? []).length > 0)
        .map((spouseId) => ownerByPersonId.get(spouseId))
        .filter((owner): owner is string => Boolean(owner))
        .sort((left, right) => left.localeCompare(right))

      const spouseOwner = spouseOwnerCandidates[0]
      if (!spouseOwner) {
        continue
      }

      ownerByPersonId.set(personId, spouseOwner)
    }

    for (const family of sortedFamilies) {
      const ownerHouseId = resolveFamilyOwnerHouseId({
        family,
        ownerByPersonId,
        personById,
        getPrimaryStartHouse,
      })

      if (!ownerHouseId) {
        continue
      }

      for (const personId of [...family.parentIds, ...family.childIds]) {
        const protectedOwner = protectedRootOwnerByPersonId.get(personId)
        if (protectedOwner && protectedOwner !== ownerHouseId) {
          continue
        }

        if (protectedOwner === ownerHouseId) {
          ownerByPersonId.set(personId, ownerHouseId)
          continue
        }

        ownerByPersonId.set(personId, ownerHouseId)
      }
    }
  }

  for (const personId of orderedPersonIds) {
    if (ownerByPersonId.has(personId)) {
      continue
    }

    const parentIds = validation.parentsByChild.get(personId) ?? []
    const inheritedOwner = resolveInheritedOwnerFromParents(parentIds, ownerByPersonId, personById)
    ownerByPersonId.set(personId, inheritedOwner)
  }

  for (const family of sortedFamilies) {
    const ownerHouseId = resolveFamilyOwnerHouseId({
      family,
      ownerByPersonId,
      personById,
      getPrimaryStartHouse,
    })

    if (!ownerHouseId) {
      continue
    }

    for (const personId of [...family.parentIds, ...family.childIds]) {
      const protectedOwner = protectedRootOwnerByPersonId.get(personId)
      if (protectedOwner && protectedOwner !== ownerHouseId) {
        continue
      }

      ownerByPersonId.set(personId, ownerHouseId)
    }
  }

  return ownerByPersonId
}

function resolveFamilyOwnerHouseId({
  family,
  ownerByPersonId,
  personById,
  getPrimaryStartHouse,
}: {
  family: FamilyGroup
  ownerByPersonId: Map<UUID, string | null>
  personById: Map<UUID, Person>
  getPrimaryStartHouse: (personId: UUID) => HouseDefinition | null
}): string | null {
  const maleParents = family.parentIds.filter((parentId) => normalizeGender(personById.get(parentId)?.gender) === 'male')
  const parentPriority = [...maleParents, ...family.parentIds.filter((parentId) => !maleParents.includes(parentId))]

  for (const parentId of parentPriority) {
    const owner = ownerByPersonId.get(parentId)
    if (owner) {
      return owner
    }
  }

  for (const parentId of parentPriority) {
    const startHouse = getPrimaryStartHouse(parentId)
    if (startHouse) {
      return startHouse.id
    }
  }

  for (const childId of family.childIds) {
    const startHouse = getPrimaryStartHouse(childId)
    if (startHouse) {
      return startHouse.id
    }
  }

  return null
}

function resolveInheritedOwnerFromParents(
  parentIds: UUID[],
  ownerByPersonId: Map<UUID, string | null>,
  personById: Map<UUID, Person>,
): string | null {
  const maleParents = parentIds.filter((parentId) => normalizeGender(personById.get(parentId)?.gender) === 'male')
  const parentPriority = [...maleParents, ...parentIds.filter((parentId) => !maleParents.includes(parentId))]

  for (const parentId of parentPriority) {
    const owner = ownerByPersonId.get(parentId)
    if (owner) {
      return owner
    }
  }

  return null
}

function buildSpouseMap(relations: Relation[], personById: Map<UUID, Person>): Map<UUID, Set<UUID>> {
  const spouseIdsByPersonId = new Map<UUID, Set<UUID>>()

  for (const relation of relations) {
    if (relation.type !== 'marriage' || !personById.has(relation.from) || !personById.has(relation.to)) {
      continue
    }

    const leftSpouses = spouseIdsByPersonId.get(relation.from) ?? new Set<UUID>()
    leftSpouses.add(relation.to)
    spouseIdsByPersonId.set(relation.from, leftSpouses)

    const rightSpouses = spouseIdsByPersonId.get(relation.to) ?? new Set<UUID>()
    rightSpouses.add(relation.from)
    spouseIdsByPersonId.set(relation.to, rightSpouses)
  }

  return spouseIdsByPersonId
}

function buildCoParentMap(familyGroups: FamilyGroup[]): Map<UUID, Set<UUID>> {
  const coParentIdsByPersonId = new Map<UUID, Set<UUID>>()

  for (const family of familyGroups) {
    if (family.parentIds.length !== 2) {
      continue
    }

    const leftId = family.parentIds[0]
    const rightId = family.parentIds[1]

    const leftSet = coParentIdsByPersonId.get(leftId) ?? new Set<UUID>()
    leftSet.add(rightId)
    coParentIdsByPersonId.set(leftId, leftSet)

    const rightSet = coParentIdsByPersonId.get(rightId) ?? new Set<UUID>()
    rightSet.add(leftId)
    coParentIdsByPersonId.set(rightId, rightSet)
  }

  return coParentIdsByPersonId
}

function buildPartnerMap(
  spouseIdsByPersonId: Map<UUID, Set<UUID>>,
  coParentIdsByPersonId: Map<UUID, Set<UUID>>,
): Map<UUID, Set<UUID>> {
  const partnerIdsByPersonId = new Map<UUID, Set<UUID>>()

  const merge = (source: Map<UUID, Set<UUID>>) => {
    for (const [personId, partnerIds] of source) {
      const target = partnerIdsByPersonId.get(personId) ?? new Set<UUID>()
      for (const partnerId of partnerIds) {
        target.add(partnerId)
      }
      partnerIdsByPersonId.set(personId, target)
    }
  }

  merge(spouseIdsByPersonId)
  merge(coParentIdsByPersonId)
  return partnerIdsByPersonId
}

function buildUndirectedComponentKeys(
  validation: ValidationResult,
  orderedPersonIds: UUID[],
  compareIds: (leftId: UUID, rightId: UUID) => number,
): Map<UUID, string> {
  const neighborsByPersonId = new Map<UUID, Set<UUID>>()

  for (const personId of orderedPersonIds) {
    neighborsByPersonId.set(personId, new Set<UUID>())
  }

  for (const relation of validation.validBiologicalRelations) {
    neighborsByPersonId.get(relation.from)?.add(relation.to)
    neighborsByPersonId.get(relation.to)?.add(relation.from)
  }

  const componentKeyByPersonId = new Map<UUID, string>()
  const visited = new Set<UUID>()

  for (const personId of orderedPersonIds) {
    if (visited.has(personId)) {
      continue
    }

    const queue = [personId]
    const members: UUID[] = []
    visited.add(personId)

    while (queue.length > 0) {
      const currentId = queue.shift()
      if (!currentId) {
        continue
      }

      members.push(currentId)
      for (const neighborId of neighborsByPersonId.get(currentId) ?? []) {
        if (visited.has(neighborId)) {
          continue
        }

        visited.add(neighborId)
        queue.push(neighborId)
      }
    }

    members.sort(compareIds)
    const key = members[0] ?? personId
    for (const memberId of members) {
      componentKeyByPersonId.set(memberId, key)
    }
  }

  return componentKeyByPersonId
}

function buildCorridorDefinitions({
  rowIdsByGeneration,
  startHouses,
  orderedPersonIds,
  getCorridorKey,
  spouseIdsByPersonId,
  coParentIdsByPersonId,
  sharedChildPairKeys,
  getGroupWidthSpan,
  compareIds,
}: {
  rowIdsByGeneration: Map<number, UUID[]>
  startHouses: HouseDefinition[]
  orderedPersonIds: UUID[]
  getCorridorKey: (personId: UUID) => string
  spouseIdsByPersonId: Map<UUID, Set<UUID>>
  coParentIdsByPersonId: Map<UUID, Set<UUID>>
  sharedChildPairKeys: Set<string>
  getGroupWidthSpan: (blocks: UUID[][]) => number
  compareIds: (leftId: UUID, rightId: UUID) => number
}): CorridorDefinition[] {
  const rowKeys = [...rowIdsByGeneration.keys()].sort((left, right) => left - right)
  const widthByCorridorKey = new Map<string, number>()
  const sortTokenByCorridorKey = new Map<string, number>()
  const corridorKeys = new Set<string>()

  for (const rowKey of rowKeys) {
    const rowIds = rowIdsByGeneration.get(rowKey) ?? []
    const memberIdsByCorridorKey = new Map<string, UUID[]>()

    for (const personId of rowIds) {
      const corridorKey = getCorridorKey(personId)
      corridorKeys.add(corridorKey)
      const members = memberIdsByCorridorKey.get(corridorKey) ?? []
      members.push(personId)
      memberIdsByCorridorKey.set(corridorKey, members)
    }

    for (const [corridorKey, memberIds] of memberIdsByCorridorKey) {
      const blocks = buildRowBlocks(memberIds, new Set(memberIds), spouseIdsByPersonId, coParentIdsByPersonId, sharedChildPairKeys, compareIds)
      const widthSpan = getGroupWidthSpan(blocks) + 2 * CORRIDOR_PADDING_SPAN
      const currentWidth = widthByCorridorKey.get(corridorKey) ?? 0
      widthByCorridorKey.set(corridorKey, Math.max(currentWidth, widthSpan, 2.5))
    }
  }

  const startHouseOrderById = new Map(startHouses.map((house, index) => [house.id, index]))
  for (const corridorKey of corridorKeys) {
    if (corridorKey.startsWith('house:')) {
      const houseId = corridorKey.slice('house:'.length)
      sortTokenByCorridorKey.set(corridorKey, startHouseOrderById.get(houseId) ?? Number.MAX_SAFE_INTEGER)
      continue
    }

    const componentKey = corridorKey.slice('other:'.length)
    const componentIndex = orderedPersonIds.findIndex((personId) => personId === componentKey)
    sortTokenByCorridorKey.set(corridorKey, 1000 + (componentIndex >= 0 ? componentIndex : Number.MAX_SAFE_INTEGER))
  }

  const orderedCorridorKeys = [...corridorKeys].sort((left, right) => {
    const leftToken = sortTokenByCorridorKey.get(left) ?? Number.MAX_SAFE_INTEGER
    const rightToken = sortTokenByCorridorKey.get(right) ?? Number.MAX_SAFE_INTEGER

    if (leftToken !== rightToken) {
      return leftToken - rightToken
    }

    return left.localeCompare(right)
  })

  let cursor = 0
  return orderedCorridorKeys.map((corridorKey) => {
    const widthSpan = widthByCorridorKey.get(corridorKey) ?? 4
    const leftSpan = cursor
    const centerSpan = leftSpan + widthSpan / 2
    cursor += widthSpan + HOUSE_GAP_SPAN

    return {
      key: corridorKey,
      leftSpan,
      widthSpan,
      centerSpan,
    }
  })
}

function resolveDesiredCenter({
  parentIds,
  corridorCenter,
  centerSpanByPersonId,
}: {
  parentIds: UUID[]
  corridorCenter: number
  centerSpanByPersonId: Map<UUID, number>
}): number {
  if (parentIds.length === 0) {
    return corridorCenter
  }

  const allParentCenters = parentIds
    .map((parentId) => centerSpanByPersonId.get(parentId))
    .filter((value): value is number => value !== undefined)

  return average(allParentCenters) ?? corridorCenter
}

function layoutGroupsWithinCorridor(groups: RowGroup[], corridor: CorridorDefinition): void {
  if (groups.length === 0) {
    return
  }

  let cursor = corridor.leftSpan + CORRIDOR_PADDING_SPAN
  let hasPlacedGroup = false

  for (const group of groups) {
    const desiredLeft = group.desiredCenter - group.widthSpan / 2
    const isParentAnchoredGroup = group.parentIds.length > 0

    if (!hasPlacedGroup) {
      group.leftSpan = isParentAnchoredGroup
        ? desiredLeft
        : Math.max(corridor.leftSpan + CORRIDOR_PADDING_SPAN, desiredLeft)
      cursor = group.leftSpan + group.widthSpan
      hasPlacedGroup = true
      continue
    }

    const flowLeft = cursor + GROUP_GAP_SPAN
    group.leftSpan = Math.max(flowLeft, desiredLeft)
    cursor = group.leftSpan + group.widthSpan
  }

  const corridorRight = corridor.leftSpan + corridor.widthSpan - CORRIDOR_PADDING_SPAN
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index]
    const desiredLeft = group.desiredCenter - group.widthSpan / 2
    const isParentAnchoredGroup = group.parentIds.length > 0
    const maxAllowedLeft = index === groups.length - 1
      ? (isParentAnchoredGroup ? Number.POSITIVE_INFINITY : corridorRight - group.widthSpan)
      : groups[index + 1].leftSpan - GROUP_GAP_SPAN - group.widthSpan
    group.leftSpan = Math.min(group.leftSpan, desiredLeft, maxAllowedLeft)
  }

  for (let index = 0; index < groups.length; index += 1) {
    const minimumLeft = index === 0
      ? (groups[index].parentIds.length > 0 ? Number.NEGATIVE_INFINITY : corridor.leftSpan + CORRIDOR_PADDING_SPAN)
      : groups[index - 1].leftSpan + groups[index - 1].widthSpan + GROUP_GAP_SPAN
    if (groups[index].leftSpan < minimumLeft) {
      groups[index].leftSpan = minimumLeft
    }
  }
}

function buildRowBlocks(
  memberIds: UUID[],
  rowIdSet: Set<UUID>,
  spouseIdsByPersonId: Map<UUID, Set<UUID>>,
  coParentIdsByPersonId: Map<UUID, Set<UUID>>,
  sharedChildPairKeys: Set<string>,
  compareIds: (leftId: UUID, rightId: UUID) => number,
): UUID[][] {
  const sortedMemberIds = [...memberIds].sort(compareIds)
  const orderById = new Map(sortedMemberIds.map((personId, index) => [personId, index]))
  const usedIds = new Set<UUID>()
  const blocks: UUID[][] = []

  for (const personId of sortedMemberIds) {
    if (usedIds.has(personId)) {
      continue
    }

    const candidatePartnerIds = [...new Set([
      ...(spouseIdsByPersonId.get(personId) ?? new Set<UUID>()),
      ...(coParentIdsByPersonId.get(personId) ?? new Set<UUID>()),
    ])]
      .filter((candidateId) => rowIdSet.has(candidateId) && !usedIds.has(candidateId))

    if (candidatePartnerIds.length === 0) {
      usedIds.add(personId)
      blocks.push([personId])
      continue
    }

    candidatePartnerIds.sort((leftId, rightId) => {
      const leftPairKey = [personId, leftId].sort(compareIds).join('|')
      const rightPairKey = [personId, rightId].sort(compareIds).join('|')
      const leftSharedChildScore = sharedChildPairKeys.has(leftPairKey) ? 1 : 0
      const rightSharedChildScore = sharedChildPairKeys.has(rightPairKey) ? 1 : 0

      if (leftSharedChildScore !== rightSharedChildScore) {
        return rightSharedChildScore - leftSharedChildScore
      }

      const leftDistance = Math.abs((orderById.get(leftId) ?? 0) - (orderById.get(personId) ?? 0))
      const rightDistance = Math.abs((orderById.get(rightId) ?? 0) - (orderById.get(personId) ?? 0))

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }

      return compareIds(leftId, rightId)
    })

    const partnerId = candidatePartnerIds[0]
    usedIds.add(personId)
    usedIds.add(partnerId)
    blocks.push([personId, partnerId].sort(compareIds))
  }

  return blocks
}

function buildFamilyBlocksForRow({
  memberIds,
  rowIdSet,
  validation,
  familyByKey,
  spouseIdsByPersonId,
  coParentIdsByPersonId,
  sharedChildPairKeys,
  compareIds,
}: {
  memberIds: UUID[]
  rowIdSet: Set<UUID>
  validation: ValidationResult
  familyByKey: Map<string, FamilyGroup>
  spouseIdsByPersonId: Map<UUID, Set<UUID>>
  coParentIdsByPersonId: Map<UUID, Set<UUID>>
  sharedChildPairKeys: Set<string>
  compareIds: (leftId: UUID, rightId: UUID) => number
}): FamilyBlock[] {
  const coupleBlocks = buildCoupleBlocksForRow({
    memberIds,
    rowIdSet,
    validation,
    familyByKey,
    spouseIdsByPersonId,
    coParentIdsByPersonId,
    sharedChildPairKeys,
    compareIds,
  })
  const usedPersonIds = new Set(coupleBlocks.flatMap((block) => block.memberIds))
  const familyBlocksByKey = new Map<string, FamilyBlock>()

  for (const coupleBlock of coupleBlocks) {
    const familyGrouping = resolveFamilyGroupingForBlock(coupleBlock.memberIds, validation, compareIds)
    const existing = familyBlocksByKey.get(familyGrouping.key)

    if (existing) {
      existing.memberIds = [...new Set([...existing.memberIds, ...coupleBlock.memberIds])].sort(compareIds)
      existing.childIds = [...new Set([...existing.childIds, ...coupleBlock.childIds])].sort(compareIds)
      existing.blocks.push([...coupleBlock.memberIds])
      continue
    }

    familyBlocksByKey.set(familyGrouping.key, {
      key: familyGrouping.key,
      parentIds: familyGrouping.parentIds,
      childIds: coupleBlock.childIds,
      memberIds: [...coupleBlock.memberIds],
      blocks: [[...coupleBlock.memberIds]],
    })
  }

  const singletonIds = memberIds.filter((personId) => !usedPersonIds.has(personId))
  const singletonGroups = new Map<string, FamilyBlock>()

  for (const personId of singletonIds) {
    const familyGrouping = resolveFamilyGroupingForBlock([personId], validation, compareIds)
    const existing = singletonGroups.get(familyGrouping.key)

    if (existing) {
      existing.memberIds.push(personId)
      existing.memberIds.sort(compareIds)
      existing.blocks.push([personId])
      continue
    }

    singletonGroups.set(familyGrouping.key, {
      key: familyGrouping.key,
      parentIds: familyGrouping.parentIds,
      childIds: [],
      memberIds: [personId],
      blocks: [[personId]],
    })
  }

  for (const [key, familyBlock] of singletonGroups) {
    const existing = familyBlocksByKey.get(key)

    if (!existing) {
      familyBlocksByKey.set(key, familyBlock)
      continue
    }

    existing.memberIds = [...new Set([...existing.memberIds, ...familyBlock.memberIds])].sort(compareIds)
    existing.childIds = [...new Set([...existing.childIds, ...familyBlock.childIds])].sort(compareIds)
    existing.blocks.push(...familyBlock.blocks)
  }

  return [...familyBlocksByKey.values()].sort((left, right) => {
    const leftParentKey = left.parentIds.join('|')
    const rightParentKey = right.parentIds.join('|')

    if (leftParentKey !== rightParentKey) {
      return leftParentKey.localeCompare(rightParentKey)
    }

    return compareIds(left.memberIds[0], right.memberIds[0])
  })
}

function buildCoupleBlocksForRow({
  memberIds,
  rowIdSet,
  validation,
  familyByKey,
  spouseIdsByPersonId,
  coParentIdsByPersonId,
  sharedChildPairKeys,
  compareIds,
}: {
  memberIds: UUID[]
  rowIdSet: Set<UUID>
  validation: ValidationResult
  familyByKey: Map<string, FamilyGroup>
  spouseIdsByPersonId: Map<UUID, Set<UUID>>
  coParentIdsByPersonId: Map<UUID, Set<UUID>>
  sharedChildPairKeys: Set<string>
  compareIds: (leftId: UUID, rightId: UUID) => number
}): CoupleBlock[] {
  const blocks = buildRowBlocks(memberIds, rowIdSet, spouseIdsByPersonId, coParentIdsByPersonId, sharedChildPairKeys, compareIds)

  return blocks
    .filter((block): block is [UUID, UUID] => block.length === 2)
    .map((block) => {
      const memberIds = [...block].sort(compareIds) as [UUID, UUID]
      const parentIds = [...new Set(memberIds.flatMap((personId) => validation.parentsByChild.get(personId) ?? []))].sort(compareIds)
      const pairKey = memberIds.join('|')
      const familyGroup = familyByKey.get(pairKey)

      return {
        key: `__pair__${pairKey}`,
        memberIds,
        parentIds,
        childIds: familyGroup?.childIds ?? [],
      }
    })
}

function resolveFamilyGroupingForBlock(
  blockMemberIds: UUID[],
  validation: ValidationResult,
  compareIds: (leftId: UUID, rightId: UUID) => number,
): { key: string; parentIds: UUID[] } {
  const parentKeys = new Map<string, { parentIds: UUID[]; count: number }>()

  for (const personId of blockMemberIds) {
    const parentIds = [...(validation.parentsByChild.get(personId) ?? [])].sort(compareIds)
    const key = parentIds.length > 0 ? parentIds.join('|') : ''
    const existing = parentKeys.get(key)

    if (existing) {
      existing.count += 1
      continue
    }

    parentKeys.set(key, {
      parentIds,
      count: 1,
    })
  }

  const rankedParentKeys = [...parentKeys.entries()].sort((left, right) => {
    const leftIsEmpty = left[0].length === 0 ? 1 : 0
    const rightIsEmpty = right[0].length === 0 ? 1 : 0

    if (leftIsEmpty !== rightIsEmpty) {
      return leftIsEmpty - rightIsEmpty
    }

    if (left[1].count !== right[1].count) {
      return right[1].count - left[1].count
    }

    return left[0].localeCompare(right[0])
  })

  const selected = rankedParentKeys[0]
  if (!selected || selected[1].parentIds.length === 0) {
    return {
      key: blockMemberIds.length === 1 ? `__root__${blockMemberIds[0]}` : `__pair__${[...blockMemberIds].sort(compareIds).join('|')}`,
      parentIds: [],
    }
  }

  return {
    key: selected[0],
    parentIds: selected[1].parentIds,
  }
}

function createHouseHelpers(houseDefinitions: HouseDefinitions, personById: Map<UUID, Person>) {
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

function getBaseGeneration(
  personId: UUID,
  validation: ValidationResult,
  cache: Map<UUID, number>,
  stack: Set<UUID>,
): number {
  const cached = cache.get(personId)
  if (cached !== undefined) {
    return cached
  }

  if (stack.has(personId)) {
    return 0
  }

  stack.add(personId)
  const parentIds = validation.parentsByChild.get(personId) ?? []
  const generation = parentIds.length === 0
    ? 0
    : Math.max(...parentIds.map((parentId) => getBaseGeneration(parentId, validation, cache, stack))) + 1
  stack.delete(personId)
  cache.set(personId, generation)
  return generation
}

function comparePersonIds(leftId: UUID, rightId: UUID, personById: Map<UUID, Person>): number {
  const left = personById.get(leftId)
  const right = personById.get(rightId)

  if (!left || !right) {
    return leftId.localeCompare(rightId)
  }

  return comparePersonsForLayout(left, right)
}

function normalizeHouseKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeGender(value: string | null | undefined): 'male' | 'female' | 'other' {
  if (!value) {
    return 'other'
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'male' || normalized === 'm') {
    return 'male'
  }

  if (normalized === 'female' || normalized === 'f') {
    return 'female'
  }

  return 'other'
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}