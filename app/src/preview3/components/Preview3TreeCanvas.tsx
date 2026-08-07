import type { ReactElement, RefObject } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import type { CameraView, LayoutResult, UUID, ValidationResult, PositionedNode } from '../../graph'
import { AppSelect, IconButton, Preview3Icon } from '../ui'
import type { ExportScope, FadeMode, ThemePreset, ThemeScope, ThemeState } from '../state'
import { canRenderInlineMarriage, type BiologicalChildGroup, type HouseAnchor, type SpouseProjectionNode } from '../treeCore'

type LcaAnalysis = {
  edgeIds: Set<UUID>
} | null

type Preview3TreeCanvasProps = {
  browserFullscreen: boolean
  contentFullscreen: boolean
  exportMessage: string
  exportState: 'idle' | 'working' | 'error'
  fadeMode: FadeMode
  focusedPersonId: UUID | null
  filteredOutNodeIds: Set<UUID>
  highlightedEdgeIds: Set<UUID>
  houseAnchors: HouseAnchor[]
  cameraView: CameraView
  layout: LayoutResult
  lcaAnalysis: LcaAnalysis
  legendMinimized: boolean
  matchingNodeIds: Set<UUID>
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  panelId: string
  rightPanelShift: number
  selectionA: UUID | null
  selectionB: UUID | null
  selectedSet: Set<UUID>
  shouldDimNode: (personId: UUID) => boolean
  shouldHideNode: (personId: UUID) => boolean
  startCanvasPan: (event: React.PointerEvent<SVGRectElement>) => void
  treeTheme: ThemeState
  validation: ValidationResult
  wideMode: boolean
  canvasViewportRef: RefObject<HTMLDivElement | null>
  svgRef: RefObject<SVGSVGElement | null>
  biologicalChildGroups: BiologicalChildGroup[]
  overlayRelations: ValidationResult['validOverlayRelations']
  spouseProjection: { nodes: SpouseProjectionNode[] }
  renderPrimaryPanel: (side: 'left' | 'right') => ReactElement | null
  renderThemeModeToggle: (scope: ThemeScope, theme: ThemeState) => ReactElement
  onResetView: () => void
  onBrowserFullscreenToggle: () => void
  onContentFullscreenToggle: () => void
  onContentFullscreenClose: () => void
  onExportJson: () => void
  onExportPng: (scope: ExportScope) => void
  onLegendToggle: () => void
  onOpenSpouseContinuation: (relationId: UUID, ownerId: UUID) => void
  onPanelCollapse: (side: 'left' | 'right') => void
  onTreeThemeEditorToggle: () => void
  onTreeThemePresetChange: (preset: ThemePreset) => void
  onWideModeToggle: () => void
  onClearSelection: () => void
  onNodeSelect: (event: React.MouseEvent<SVGGElement>, personId: UUID) => void
}

export function Preview3TreeCanvas({
  browserFullscreen,
  contentFullscreen,
  exportMessage,
  exportState,
  fadeMode,
  focusedPersonId,
  filteredOutNodeIds,
  highlightedEdgeIds,
  houseAnchors,
  cameraView,
  layout,
  lcaAnalysis,
  legendMinimized,
  matchingNodeIds,
  leftPanelCollapsed,
  rightPanelCollapsed,
  panelId,
  rightPanelShift,
  selectionA,
  selectionB,
  selectedSet,
  shouldDimNode,
  shouldHideNode,
  startCanvasPan,
  treeTheme,
  validation,
  wideMode,
  canvasViewportRef,
  svgRef,
  biologicalChildGroups,
  overlayRelations,
  spouseProjection,
  renderPrimaryPanel,
  renderThemeModeToggle,
  onResetView,
  onBrowserFullscreenToggle,
  onContentFullscreenToggle,
  onContentFullscreenClose,
  onExportJson,
  onExportPng,
  onLegendToggle,
  onOpenSpouseContinuation,
  onPanelCollapse,
  onTreeThemeEditorToggle,
  onTreeThemePresetChange,
  onWideModeToggle,
  onClearSelection,
  onNodeSelect,
}: Preview3TreeCanvasProps) {
  const treeThemePresetOptions = [
    { value: 'tolkien', label: 'Tolkien' },
    { value: 'gondor', label: 'Gondor' },
    { value: 'rohan', label: 'Rohan' },
    { value: 'mirkwood', label: 'Mirkwood' },
    { value: 'imladris', label: 'Imladris' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <section className={`preview3-workspace ${contentFullscreen ? 'content-fullscreen' : ''}`}>
      {!contentFullscreen ? null : <button type="button" className="preview3-close-fullscreen preview3-close-fullscreen-compact" title="Close content fullscreen" aria-label="Close content fullscreen" onClick={onContentFullscreenClose}><Preview3Icon name="close" /></button>}
      <div className="preview3-toolbar-row">
        <div className="preview3-toolbar-group">
          <IconButton icon="reset" label="Reset View" onClick={onResetView} />
          <IconButton icon="horizontal" label="Horizontal Space" active={wideMode} onClick={onWideModeToggle} />
          <IconButton icon="content-fullscreen" label="Content Fullscreen" active={contentFullscreen} onClick={onContentFullscreenToggle} />
          <IconButton icon="browser-fullscreen" label="F11" active={browserFullscreen} title="Browser Fullscreen" onClick={onBrowserFullscreenToggle} />
        </div>
        <Preview3Icon name="separator" />
        <div className="preview3-toolbar-group">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="preview3-toolbar-button preview3-toolbar-button icon-only" disabled={exportState === 'working'} aria-label={exportState === 'working' ? 'Exporting PNG' : 'Export PNG'} title={exportState === 'working' ? 'Exporting PNG' : 'Export PNG'}>
                <Preview3Icon name="image" />
                <span className="preview3-sr-only preview3-sr-only">{exportState === 'working' ? 'Exporting PNG' : 'Export PNG'}</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="preview3-menu-panel" align="start" sideOffset={8}>
                <DropdownMenu.Item className="preview3-menu-item" onSelect={() => onExportPng('current')}>Current view</DropdownMenu.Item>
                <DropdownMenu.Item className="preview3-menu-item" onSelect={() => onExportPng('all')}>All filtered</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <IconButton icon="json" label="Export JSON" disabled={exportState === 'working'} onClick={onExportJson} />
        </div>
        <Preview3Icon name="separator" />
        <div className="preview3-toolbar-group align-end">
          {renderThemeModeToggle('tree', treeTheme)}
          <AppSelect
            className="preview3-toolbar-select preview3-toolbar-select"
            value={treeTheme.preset}
            onValueChange={(value) => onTreeThemePresetChange(value as ThemePreset)}
            options={treeThemePresetOptions}
          />
          <IconButton icon="editor" label="Editor" disabled={treeTheme.preset !== 'custom'} onClick={onTreeThemeEditorToggle} />
        </div>
      </div>
      <div ref={canvasViewportRef} className="preview3-canvas-shell">
        {leftPanelCollapsed ? <button type="button" className="preview3-restore-button left" onClick={() => onPanelCollapse('left')}><Preview3Icon name="restore-left" /><span>Restore Filter</span></button> : null}
        {rightPanelCollapsed ? <button type="button" className="preview3-restore-button right" onClick={() => onPanelCollapse('right')}><Preview3Icon name="restore-right" /><span>Restore Inspect</span></button> : null}
        {renderPrimaryPanel('left')}
        {renderPrimaryPanel('right')}
        <svg
          ref={svgRef}
          className="preview3-graph"
          viewBox={`${cameraView.x} ${cameraView.y} ${cameraView.width} ${cameraView.height}`}
          role="img"
          aria-label="Family tree graph"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClearSelection()
            }
          }}
        >
          <defs>
            <pattern id={`${panelId}-grid`} width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="var(--preview3-tree-border)" strokeOpacity="0.18" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x={cameraView.x - 800} y={cameraView.y - 800} width={cameraView.width + 1600} height={cameraView.height + 1600} fill={`url(#${panelId}-grid)`} />
          <rect x={cameraView.x - 800} y={cameraView.y - 800} width={cameraView.width + 1600} height={cameraView.height + 1600} fill="transparent" onPointerDown={startCanvasPan} />
          {houseAnchors.map((anchor) => {
            const rootNodes = anchor.memberIds.map((memberId) => layout.nodes.get(memberId)).filter((node): node is PositionedNode => node !== undefined)

            if (rootNodes.length === 0) {
              return null
            }

            const anchorCenterX = anchor.x + anchor.width / 2
            const anchorBottomY = anchor.y + anchor.height
            const junctionY = anchorBottomY + 18
            const minRootX = Math.min(...rootNodes.map((node) => node.x + node.width / 2))
            const maxRootX = Math.max(...rootNodes.map((node) => node.x + node.width / 2))

            return (
              <g key={anchor.houseId}>
                <line x1={anchorCenterX} y1={anchorBottomY} x2={anchorCenterX} y2={junctionY} stroke="var(--preview3-tree-overlay)" strokeWidth={1.8} strokeOpacity={0.55} />
                {rootNodes.length > 1 ? <line x1={minRootX} y1={junctionY} x2={maxRootX} y2={junctionY} stroke="var(--preview3-tree-overlay)" strokeWidth={1.8} strokeOpacity={0.55} /> : null}
                {rootNodes.map((node) => (
                  <line key={`${anchor.houseId}:${node.id}`} x1={node.x + node.width / 2} y1={junctionY} x2={node.x + node.width / 2} y2={node.y} stroke="var(--preview3-tree-overlay)" strokeWidth={1.8} strokeOpacity={0.55} />
                ))}
                <g transform={`translate(${anchor.x} ${anchor.y})`}>
                  <rect width={anchor.width} height={anchor.height} rx="16" ry="16" fill="color-mix(in srgb, var(--preview3-tree-accent-soft) 68%, transparent)" stroke="var(--preview3-tree-border)" />
                  <text x={anchor.width / 2} y={23} textAnchor="middle" className="preview3-svg-meta">{anchor.displayName}</text>
                </g>
              </g>
            )
          })}

          {overlayRelations.map((relation) => {
            const fromNode = layout.nodes.get(relation.from)
            const toNode = layout.nodes.get(relation.to)
            if (!fromNode || !toNode) {
              return null
            }

            const renderInlineMarriage = relation.type === 'marriage' && canRenderInlineMarriage(fromNode, toNode)
            const leftNode = fromNode.x <= toNode.x ? fromNode : toNode
            const rightNode = leftNode.id === fromNode.id ? toNode : fromNode
            const x1 = renderInlineMarriage ? leftNode.x + leftNode.width : fromNode.x + fromNode.width / 2
            const y1 = renderInlineMarriage ? leftNode.y + leftNode.height / 2 : fromNode.y + fromNode.height / 2
            const x2 = renderInlineMarriage ? rightNode.x : toNode.x + toNode.width / 2
            const y2 = renderInlineMarriage ? rightNode.y + rightNode.height / 2 : toNode.y + toNode.height / 2
            const isDimmed = Boolean(lcaAnalysis && fadeMode === 'dim' && !highlightedEdgeIds.has(relation.id))

            return <line key={relation.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--preview3-tree-overlay)" strokeWidth={1.6} strokeDasharray="7 7" strokeOpacity={isDimmed ? 0.22 : 0.58} />
          })}

          {biologicalChildGroups.map((group) => {
            const highlighted = group.relationIds.some((relationId) => highlightedEdgeIds.has(relationId))
            const groupFiltered = [...group.parentIds, ...group.childIds].some((nodeId) => filteredOutNodeIds.has(nodeId))
            const faded = (lcaAnalysis && fadeMode === 'dim' && !highlighted) || groupFiltered
            const childCenters = group.childNodes.map((node) => node.x + node.width / 2)
            const siblingMinX = Math.min(...childCenters)
            const siblingMaxX = Math.max(...childCenters)
            const isSingleChildGroup = group.childNodes.length === 1
            const singleChildNode = isSingleChildGroup ? group.childNodes[0] : null

            return (
              <g key={group.key}>
                {group.parentNodes.map((node) => {
                  const parentCenterX = node.x + node.width / 2
                  const parentBottomY = node.y + node.height
                  const targetX = singleChildNode ? singleChildNode.x + singleChildNode.width / 2 : group.junctionX
                  const targetY = singleChildNode ? singleChildNode.y : group.junctionY
                  const controlY = singleChildNode ? parentBottomY + Math.max((targetY - parentBottomY) * 0.45, 18) : parentBottomY + Math.max((group.junctionY - parentBottomY) * 0.7, 16)

                  return (
                    <path
                      key={`${group.key}:${node.id}:parent`}
                      d={`M ${parentCenterX} ${parentBottomY} Q ${parentCenterX} ${controlY} ${targetX} ${targetY}`}
                      fill="none"
                      stroke={highlighted ? 'var(--preview3-tree-accent)' : 'var(--preview3-tree-edge)'}
                      strokeWidth={highlighted ? 3.6 : 2.2}
                      strokeOpacity={faded ? 0.22 : 0.82}
                    />
                  )
                })}

                {!isSingleChildGroup && group.siblingY > group.junctionY ? <line x1={group.junctionX} y1={group.junctionY} x2={group.junctionX} y2={group.siblingY} stroke={highlighted ? 'var(--preview3-tree-accent)' : 'var(--preview3-tree-edge)'} strokeWidth={highlighted ? 3.6 : 2.2} strokeOpacity={faded ? 0.22 : 0.82} /> : null}

                {group.childNodes.length > 1 ? <line x1={siblingMinX} y1={group.siblingY} x2={siblingMaxX} y2={group.siblingY} stroke={highlighted ? 'var(--preview3-tree-accent)' : 'var(--preview3-tree-edge)'} strokeWidth={highlighted ? 3.6 : 2.2} strokeOpacity={faded ? 0.22 : 0.82} /> : null}

                {!isSingleChildGroup ? group.childNodes.map((node) => {
                  const childCenterX = node.x + node.width / 2
                  const childTopY = node.y
                  return <line key={`${group.key}:${node.id}:child`} x1={childCenterX} y1={group.childNodes.length > 1 ? group.siblingY : group.junctionY} x2={childCenterX} y2={childTopY} stroke={highlighted ? 'var(--preview3-tree-accent)' : 'var(--preview3-tree-edge)'} strokeWidth={highlighted ? 3.6 : 2.2} strokeOpacity={faded ? 0.22 : 0.82} />
                }) : null}
              </g>
            )
          })}

          {spouseProjection.nodes.map((projection) => {
            const ownerNode = layout.nodes.get(projection.ownerId)
            const companionPerson = validation.personById.get(projection.companionId)

            if (!ownerNode || !companionPerson) {
              return null
            }

            const isSelected = selectedSet.has(projection.companionId)
            const isHighlighted = highlightedEdgeIds.has(projection.ownerId) || highlightedEdgeIds.has(projection.companionId)
            const isFaded = (lcaAnalysis && fadeMode === 'dim' && !isHighlighted) || filteredOutNodeIds.has(projection.ownerId) || filteredOutNodeIds.has(projection.companionId)
            const linkStartX = projection.side === 'right' ? ownerNode.x + ownerNode.width : ownerNode.x
            const linkEndX = projection.side === 'right' ? projection.x : projection.x + projection.width
            const linkY = ownerNode.y + ownerNode.height / 2

            return (
              <g key={`${projection.relationId}:${projection.ownerId}:${projection.companionId}`} opacity={isFaded ? 0.28 : 1}>
                <line x1={linkStartX} y1={linkY} x2={linkEndX} y2={projection.y + projection.height / 2} stroke="var(--preview3-tree-overlay)" strokeDasharray="6 6" strokeOpacity={0.82} />
                <g transform={`translate(${projection.x} ${projection.y})`} onClick={() => onOpenSpouseContinuation(projection.relationId, projection.companionId)}>
                  <rect width={projection.width} height={projection.height} rx="16" ry="16" fill="var(--preview3-tree-surface-strong)" stroke={isSelected ? 'var(--preview3-tree-accent)' : 'var(--preview3-tree-border)'} strokeWidth={isSelected ? 2.6 : 1.6} />
                  <text x={14} y={22} className="preview3-svg-name">{companionPerson.name}</text>
                  <text x={14} y={40} className="preview3-svg-meta">{companionPerson.species ?? companionPerson.houses?.[0] ?? 'Spouse branch'}</text>
                </g>
              </g>
            )
          })}

          {validation.persons.map((person) => {
            const node = layout.nodes.get(person.id)
            if (!node || shouldHideNode(person.id)) {
              return null
            }

            const isSelected = selectionA === person.id || selectionB === person.id
            const isFocused = focusedPersonId === person.id
            const isDimmed = shouldDimNode(person.id)
            const isMatched = matchingNodeIds.has(person.id)
            const warningCount = validation.warnings.filter((warning) => warning.personId === person.id).length
            const hasSources = (person.sourceLinks?.length ?? 0) > 0

            return (
              <g key={person.id} onClick={(event) => onNodeSelect(event, person.id)} className="preview3-node-group">
                {isMatched ? <rect x={node.x - 4} y={node.y - 4} rx={22} ry={22} width={node.width + 8} height={node.height + 8} fill="none" stroke="var(--preview3-tree-accent)" strokeOpacity={0.65} strokeWidth={2.4} /> : null}
                <rect x={node.x} y={node.y} rx={18} ry={18} width={node.width} height={node.height} fill="var(--preview3-tree-node-fill)" stroke={isSelected ? 'var(--preview3-tree-accent)' : 'var(--preview3-tree-border)'} strokeWidth={isFocused || isSelected ? 3.5 : 1.6} opacity={isDimmed ? 0.28 : 1} />
                <text x={node.x + 14} y={node.y + 24} className="preview3-svg-name">{person.name}</text>
                <text x={node.x + 14} y={node.y + 44} className="preview3-svg-meta">{[person.species ?? 'unknown', (person.houses ?? [])[0] ?? 'no house'].join(' • ')}</text>
                {warningCount > 0 ? <circle cx={node.x + node.width - 18} cy={node.y + 18} r={6} fill="#cc7a2f" opacity={isDimmed ? 0.4 : 1} /> : null}
                {hasSources ? <circle cx={node.x + node.width - 34} cy={node.y + 18} r={5} fill="#4975a0" opacity={isDimmed ? 0.4 : 1} /> : null}
              </g>
            )
          })}
        </svg>
        <section className={`preview3-legend ${legendMinimized ? 'minimized' : ''}`} style={{ right: `${16 + rightPanelShift}px` }}>
          <div className="preview3-section-heading compact">
            <h3>Legend</h3>
            <button type="button" className="preview3-text-button" onClick={onLegendToggle}>{legendMinimized ? 'Open' : 'Min'}</button>
          </div>
          {legendMinimized ? null : (
            <div className="preview3-legend-grid">
              <p><span className="preview3-legend-swatch node" />Person node</p>
              <p><span className="preview3-legend-swatch bio" />Biological parent edge</p>
              <p><span className="preview3-legend-swatch overlay" />Social overlay edge</p>
              <p><span className="preview3-legend-swatch warning" />Warning marker</p>
              <p><span className="preview3-legend-swatch source" />Source available</p>
              <p><span className="preview3-legend-swatch selected" />Selected or focused</p>
            </div>
          )}
        </section>
      </div>
      {exportState === 'error' ? <p className="preview3-export-error">{exportMessage}</p> : null}
    </section>
  )
}

