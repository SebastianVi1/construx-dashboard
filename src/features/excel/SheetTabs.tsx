import type { KeyboardEvent } from 'react'

type SheetTabsProps = {
  names: string[]
  active: number
  label: string
  onSelect: (index: number) => void
}

/** Bottom sheet tabs; arrow keys, Home and End move between them. Sheets can't be added or renamed. */
export function SheetTabs({ names, active, label, onSelect }: SheetTabsProps) {
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = names.length - 1
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    onSelect(next)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div className="sheet-tabs" role="tablist" aria-label={label}>
      {names.map((name, index) => (
        <button
          key={`${index}-${name}`}
          type="button"
          role="tab"
          className="sheet-tabs__tab"
          aria-selected={index === active}
          tabIndex={index === active ? 0 : -1}
          onClick={() => onSelect(index)}
          onKeyDown={(event) => keyDown(event, index)}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
