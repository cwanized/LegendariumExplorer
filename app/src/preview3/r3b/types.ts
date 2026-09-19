import type { R3ConnectorAnchor, R3ConnectorGroupModel } from '../r3/connectorModel'
import type { R3LayoutArtifacts } from '../r3/types'
import type { UUID } from '../../graph'

export type R3BConnectorAnchor = R3ConnectorAnchor
export type R3BConnectorGroupModel = R3ConnectorGroupModel

export type R3BVisibleParentSlot = {
	key: string
	familyKey: string
	personId: UUID
	role: 'owner' | 'companion'
	kind: 'real' | 'projection'
	x: number
	y: number
	width: number
	height: number
}

export type R3BLayoutArtifacts = R3LayoutArtifacts & {
	visibleParentSlotsByFamily: Map<string, R3BVisibleParentSlot[]>
}

export type R3BProjectionResolutionMode = 'primary-slot' | 'shifted-local-branch' | 'outward-same-side-fallback'

export type R3BProjectionShiftEligibility = 'ineligible' | 'single-child-continuation'

export type R3BProjectionPlacementDecision = {
	relationId: UUID
	ownerId: UUID
	companionId: UUID
	sharedChildren: UUID[]
	preferredSide: 'left' | 'right'
	resolvedSide: 'left' | 'right'
	resolutionMode: R3BProjectionResolutionMode
	blockingNodeId?: UUID
	shiftEligibility?: R3BProjectionShiftEligibility
	shiftedBranchRootId?: UUID
	x: number
	y: number
	width: number
	height: number
}