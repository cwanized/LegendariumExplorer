import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactElement } from 'react'

import { AppSelect, Preview3Icon } from '../ui'
import type { ThemePreset, ThemeScope, ThemeState } from '../state'

type Preview3HeaderProps = {
  activePage: 'family-tree' | 'impressum' | 'disclaimer'
  menuOpen: boolean
  pageTheme: ThemeState
  themeEditorScope: ThemeScope | null
  onMenuOpenChange: (open: boolean) => void
  onPageChange: (page: 'family-tree' | 'impressum' | 'disclaimer') => void
  onPageThemePresetChange: (preset: ThemePreset) => void
  onPageThemeEditorToggle: () => void
  renderThemeModeToggle: (scope: ThemeScope, theme: ThemeState) => ReactElement
}

export function Preview3Header({ activePage, menuOpen, pageTheme, themeEditorScope, onMenuOpenChange, onPageChange, onPageThemePresetChange, onPageThemeEditorToggle, renderThemeModeToggle }: Preview3HeaderProps) {
  return (
    <header className="preview3-header">
      <div className="preview3-brand-row">
        <DropdownMenu.Root open={menuOpen} onOpenChange={onMenuOpenChange}>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="preview3-hamburger preview3-hamburger-icon" title={menuOpen ? 'Close menu' : 'Open menu'} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              <Preview3Icon name="menu" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="preview3-menu-panel" align="start" sideOffset={8}>
              <DropdownMenu.Item className={`preview3-menu-item ${activePage === 'family-tree' ? 'active' : ''}`} onSelect={() => onPageChange('family-tree')}>Family Tree</DropdownMenu.Item>
              <DropdownMenu.Item className="preview3-menu-item disabled" disabled>Timeline</DropdownMenu.Item>
              <DropdownMenu.Item className="preview3-menu-item disabled" disabled>Map View</DropdownMenu.Item>
              <div className="preview3-menu-divider" />
              <DropdownMenu.Item className={`preview3-menu-item ${activePage === 'impressum' ? 'active' : ''}`} onSelect={() => onPageChange('impressum')}>Impressum</DropdownMenu.Item>
              <DropdownMenu.Item className={`preview3-menu-item ${activePage === 'disclaimer' ? 'active' : ''}`} onSelect={() => onPageChange('disclaimer')}>Disclaimer</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <div>
          <p className="preview3-kicker">Legendarium Explorer</p>
          <strong className="preview3-brand-title">Legendarium Explorer</strong>
        </div>
      </div>
      <div className="preview3-header-controls">
        {renderThemeModeToggle('page', pageTheme)}
        <AppSelect
          className="preview3-toolbar-select"
          value={pageTheme.preset}
          onValueChange={(value) => onPageThemePresetChange(value as ThemePreset)}
          options={[
            { value: 'tolkien', label: 'Tolkien' },
            { value: 'gondor', label: 'Gondor' },
            { value: 'rohan', label: 'Rohan' },
            { value: 'mirkwood', label: 'Mirkwood' },
            { value: 'imladris', label: 'Imladris' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
          <button type="button" className="preview3-toolbar-button" disabled={pageTheme.preset !== 'custom'} onClick={onPageThemeEditorToggle}>
          <Preview3Icon name="editor" />
          <span>{themeEditorScope === 'page' ? 'Close Editor' : 'Editor'}</span>
        </button>
      </div>
    </header>
  )
}
