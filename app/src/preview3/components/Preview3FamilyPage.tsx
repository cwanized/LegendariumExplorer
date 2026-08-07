import type { ReactElement } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'

type Preview3FamilyPageProps = {
  wideMode: boolean
  contentFullscreen: boolean
  compactLayout: boolean
  statsHidden: boolean
  renderTreeCanvas: () => ReactElement
  statsPanel: ReactElement
}

export function Preview3FamilyPage({ wideMode, contentFullscreen, compactLayout, statsHidden, renderTreeCanvas, statsPanel }: Preview3FamilyPageProps) {
  if (statsHidden) {
    return (
      <div className={`preview3-family-layout preview3-family-shell ${wideMode ? 'wide-mode' : ''} ${contentFullscreen ? 'content-fullscreen' : ''} ${compactLayout ? 'compact-layout' : ''}`}>
        {renderTreeCanvas()}
      </div>
    )
  }

  return (
    <div className={`preview3-family-layout preview3-family-shell ${wideMode ? 'wide-mode' : ''} ${contentFullscreen ? 'content-fullscreen' : ''} ${compactLayout ? 'compact-layout' : ''}`}>
      <Group orientation="horizontal" className="preview3-panel-group">
        <Panel defaultSize="72%" minSize="58%">
          {renderTreeCanvas()}
        </Panel>
        <Separator className="preview3-panel-resize" />
        <Panel defaultSize="28%" minSize="22%" maxSize="42%">
          {statsPanel}
        </Panel>
      </Group>
    </div>
  )
}
