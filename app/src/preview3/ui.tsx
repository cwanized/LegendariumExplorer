import * as Select from '@radix-ui/react-select'

export type IconName =
  | 'menu'
  | 'reset'
  | 'horizontal'
  | 'content-fullscreen'
  | 'browser-fullscreen'
  | 'separator'
  | 'image'
  | 'json'
  | 'theme'
  | 'editor'
  | 'float'
  | 'dock'
  | 'minimize'
  | 'restore-left'
  | 'restore-right'
  | 'close'
  | 'add-a'
  | 'add-b'
  | 'remove-a'
  | 'remove-b'
  | 'sun'
  | 'moon'
  | 'sparkle'

export function Preview3Icon({ name }: { name: IconName }) {
  const commonProps = {
    className: 'preview3-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'menu':
      return <svg {...commonProps}><path d="M5 7h14" /><path d="M5 12h14" /><path d="M5 17h14" /></svg>
    case 'reset':
      return <svg {...commonProps}><path d="M6 8a8 8 0 1 1 0 8" /><path d="M6 8v4h4" /></svg>
    case 'horizontal':
      return <svg {...commonProps}><path d="M4 12h16" /><path d="M12 4v16" /></svg>
    case 'content-fullscreen':
      return <svg {...commonProps}><path d="M5 9V5h4" /><path d="M19 9V5h-4" /><path d="M5 15v4h4" /><path d="M19 15v4h-4" /></svg>
    case 'browser-fullscreen':
      return <svg {...commonProps}><path d="M4 9V5h4" /><path d="M20 9V5h-4" /><path d="M4 15v4h4" /><path d="M20 15v4h-4" /></svg>
    case 'separator':
      return <svg {...commonProps}><path d="M12 4v16" /></svg>
    case 'image':
      return <svg {...commonProps}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m8 13 2-2 3 3 2-2 3 3" /><circle cx="9" cy="9" r="1.2" /></svg>
    case 'json':
      return <svg {...commonProps}><path d="M8 7c-1.2 0-2 .8-2 2v2c0 1.2-.8 2-2 2 1.2 0 2 .8 2 2v2c0 1.2.8 2 2 2" /><path d="M16 7c1.2 0 2 .8 2 2v2c0 1.2.8 2 2 2-1.2 0-2 .8-2 2v2c0 1.2-.8 2-2 2" /></svg>
    case 'theme':
      return <svg {...commonProps}><path d="M12 4a8 8 0 1 0 8 8c0-.7-.1-1.4-.3-2A6.5 6.5 0 0 1 12 4Z" /></svg>
    case 'editor':
      return <svg {...commonProps}><path d="m4 20 4.5-1 8.8-8.8a1.8 1.8 0 0 0 0-2.5l-1-1a1.8 1.8 0 0 0-2.5 0L5 15.5 4 20Z" /><path d="M12 6l6 6" /></svg>
    case 'float':
      return <svg {...commonProps}><rect x="5" y="7" width="12" height="10" rx="2" /><path d="M9 5h10v10" /></svg>
    case 'dock':
      return <svg {...commonProps}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 5v14" /></svg>
    case 'minimize':
      return <svg {...commonProps}><path d="M5 12h14" /></svg>
    case 'restore-left':
      return <svg {...commonProps}><path d="M7 7h10v10H7z" /><path d="M11 5 7 9" /></svg>
    case 'restore-right':
      return <svg {...commonProps}><path d="M7 7h10v10H7z" /><path d="m13 5 4 4" /></svg>
    case 'close':
      return <svg {...commonProps}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
    case 'add-a':
      return <svg {...commonProps}><circle cx="9" cy="10" r="3" /><path d="M15 8h5" /><path d="M17.5 5.5v5" /><path d="M4 19c1.5-2.4 3.1-3.6 5-3.6 1.9 0 3.5 1.2 5 3.6" /></svg>
    case 'add-b':
      return <svg {...commonProps}><circle cx="9" cy="10" r="3" /><path d="M15 7.5c.8-.6 1.6-.9 2.5-.9 1.8 0 3 1.2 3 2.8S19.3 12 17.5 12c-.9 0-1.7-.3-2.5-.9" /><path d="M4 19c1.5-2.4 3.1-3.6 5-3.6 1.9 0 3.5 1.2 5 3.6" /></svg>
    case 'remove-a':
      return <svg {...commonProps}><circle cx="9" cy="10" r="3" /><path d="M15 8h5" /><path d="M4 19c1.5-2.4 3.1-3.6 5-3.6 1.9 0 3.5 1.2 5 3.6" /></svg>
    case 'remove-b':
      return <svg {...commonProps}><circle cx="9" cy="10" r="3" /><path d="M15 9.5h5" /><path d="M4 19c1.5-2.4 3.1-3.6 5-3.6 1.9 0 3.5 1.2 5 3.6" /></svg>
    case 'sun':
      return <svg {...commonProps}><circle cx="12" cy="12" r="4" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="m4.9 4.9 2.1 2.1" /><path d="m17 17 2.1 2.1" /><path d="M2 12h3" /><path d="M19 12h3" /><path d="m4.9 19.1 2.1-2.1" /><path d="m17 7 2.1-2.1" /></svg>
    case 'moon':
      return <svg {...commonProps}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" /></svg>
    case 'sparkle':
      return <svg {...commonProps}><path d="M12 3 13.7 8.3 19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z" /><path d="M19 3v3" /><path d="M20.5 4.5h-3" /></svg>
  }
}

export function IconButton({ icon, label, active, onClick, title, subtle = false, className = '', iconOnly = true, disabled = false }: { icon: IconName, label: string, active?: boolean, onClick?: () => void, title?: string, subtle?: boolean, className?: string, iconOnly?: boolean, disabled?: boolean }) {
  return (
    <button type="button" className={`preview3-toolbar-button ${subtle ? 'subtle' : ''} ${active ? 'active' : ''} ${iconOnly ? 'icon-only' : ''} ${className}`.trim()} onClick={onClick} title={title ?? label} aria-label={title ?? label} disabled={disabled}>
      <Preview3Icon name={icon} />
      {iconOnly ? <span className="preview3-sr-only">{label}</span> : <span>{label}</span>}
    </button>
  )
}

export type SelectOption = { value: string; label: string }

export function AppSelect({ value, onValueChange, options, className = 'preview3-toolbar-select' }: { value: string; onValueChange: (value: string) => void; options: SelectOption[]; className?: string }) {
  const selectedOption = options.find((option) => option.value === value)

  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger className={className} aria-label={selectedOption?.label ?? value}>
        <Select.Value>{selectedOption?.label ?? value}</Select.Value>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="preview3-menu-panel" position="popper" sideOffset={6}>
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} className="preview3-menu-item">
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
