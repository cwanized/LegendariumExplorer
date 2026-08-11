import type { UUID } from '../../graph'
import type { BiologicalChildGroup } from '../treeCore'

export type R3ConnectorAnchor = {
  key: string
  parentId: UUID
  x: number
  y: number
  width: number
  height: number
  isProjection: boolean
}

export type R3ConnectorSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type R3ChildConnectorModel = {
  childId: UUID
  segments: R3ConnectorSegment[]
}

export type R3ConnectorGroupModel = {
  renderedJunctionX: number
  parentSegments: R3ConnectorSegment[]
  trunkSegment: R3ConnectorSegment | null
  siblingSegment: R3ConnectorSegment | null
  childConnectors: R3ChildConnectorModel[]
}

const ORTHOGONAL_EPSILON = 0.5

export function buildModeR3ConnectorModel(
  biologicalChildGroups: BiologicalChildGroup[],
  groupParentAnchorsByKey: Map<string, R3ConnectorAnchor[]>,
): Map<string, R3ConnectorGroupModel> {
  const modelsByGroupKey = new Map<string, R3ConnectorGroupModel>()

  for (const group of biologicalChildGroups) {
    const parentAnchors = groupParentAnchorsByKey.get(group.key) ?? []
    if (parentAnchors.length === 0) {
      continue
    }

    const childCenters = group.childNodes.map((node) => node.x + node.width / 2)
    const siblingMinX = Math.min(...childCenters)
    const siblingMaxX = Math.max(...childCenters)
    const parentCenters = parentAnchors.map((anchor) => anchor.x + anchor.width / 2)
    const renderedJunctionX = parentCenters.length === 1
      ? parentCenters[0]
      : (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2

    const parentSegments = parentAnchors.flatMap((anchor) => {
      const parentCenterX = anchor.x + anchor.width / 2
      const parentBottomY = anchor.y + anchor.height
      const segments: R3ConnectorSegment[] = [
        {
          x1: parentCenterX,
          y1: parentBottomY,
          x2: parentCenterX,
          y2: group.junctionY,
        },
      ]

      if (Math.abs(parentCenterX - renderedJunctionX) > ORTHOGONAL_EPSILON) {
        segments.push({
          x1: parentCenterX,
          y1: group.junctionY,
          x2: renderedJunctionX,
          y2: group.junctionY,
        })
      }

      return segments
    })

    const hasMultipleChildren = group.childNodes.length > 1
    const trunkSegment = hasMultipleChildren && group.siblingY > group.junctionY
      ? {
          x1: renderedJunctionX,
          y1: group.junctionY,
          x2: renderedJunctionX,
          y2: group.siblingY,
        }
      : null

    const siblingSegment = hasMultipleChildren
      ? {
          x1: siblingMinX,
          y1: group.siblingY,
          x2: siblingMaxX,
          y2: group.siblingY,
        }
      : null

    const childConnectors = group.childNodes.map((node) => {
      const childCenterX = node.x + node.width / 2
      const childTopY = node.y

      if (hasMultipleChildren) {
        return {
          childId: node.id,
          segments: [
            {
              x1: childCenterX,
              y1: group.siblingY,
              x2: childCenterX,
              y2: childTopY,
            },
          ],
        }
      }

      const segments: R3ConnectorSegment[] = [
        {
          x1: renderedJunctionX,
          y1: group.junctionY,
          x2: renderedJunctionX,
          y2: childTopY,
        },
      ]

      if (Math.abs(childCenterX - renderedJunctionX) > ORTHOGONAL_EPSILON) {
        segments.push({
          x1: renderedJunctionX,
          y1: childTopY,
          x2: childCenterX,
          y2: childTopY,
        })
      }

      return {
        childId: node.id,
        segments,
      }
    })

    modelsByGroupKey.set(group.key, {
      renderedJunctionX,
      parentSegments,
      trunkSegment,
      siblingSegment,
      childConnectors,
    })
  }

  return modelsByGroupKey
}
