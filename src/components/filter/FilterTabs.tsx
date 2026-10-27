import './filter-tabs.css'

export type FilterOption<V extends string> = {
  value: V
  label: string
  /** Shown beside the label; omit it while unknown (for example, not loaded yet). */
  count?: number
}

type FilterTabsProps<V extends string> = {
  /** Accessible name of the group, e.g. "Status". */
  label: string
  options: FilterOption<V>[]
  value: V
  onChange: (value: V) => void
}

/** A row of underlined text tabs that filter a dataset; any number of options, left aligned. */
export function FilterTabs<V extends string>({ label, options, value, onChange }: FilterTabsProps<V>) {
  return (
    <div className="filter-tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value || 'all'}
          type="button"
          className="filter-tabs__tab"
          aria-pressed={option.value === value}
          onClick={() => {
            if (option.value !== value) onChange(option.value)
          }}
        >
          {option.label}
          {option.count === undefined ? null : <span className="filter-tabs__count">{option.count}</span>}
        </button>
      ))}
    </div>
  )
}
