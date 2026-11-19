import { useEffect, useId, useState } from 'react'
import { useCurrency } from '../../currency'
import { useLocale } from '../../i18n'
import { pickerQuery, unpickableReason } from '../finance/catalogExpense'
import { listResources, type Resource, type ResourceType } from './pricesApi'
import './resource-picker.css'

type ResourcePickerProps = {
  organizationId: string
  /** The types offered, in order; one type hides the type choice. */
  types: readonly ResourceType[]
  /** Labels of the type choice; defaults to the catalog type names. */
  typeLabels?: Partial<Record<ResourceType, string>>
  value: Resource | null
  onChange: (resource: Resource | null) => void
  label: string
  error?: string
}

type Search = { status: 'idle' | 'loading' | 'error' } | { status: 'done'; results: Resource[] }

const SEARCH_DELAY_MS = 250

/**
 * Searches the organization's Catalog by type and text and picks one Resource. Archived Resources are not listed;
 * those without a cost or that cannot be charged are shown disabled.
 */
export function ResourcePicker({ organizationId, types, typeLabels, value, onChange, label, error }: ResourcePickerProps) {
  const { messages: m } = useLocale()
  const t = m.prices.picker
  const { money } = useCurrency()
  const id = useId()
  const [type, setType] = useState<ResourceType>(types[0])
  const [text, setText] = useState('')
  const [search, setSearch] = useState<Search>({ status: 'idle' })

  useEffect(() => {
    if (value) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearch({ status: 'loading' })
      listResources(organizationId, pickerQuery(type, text))
        .then((page) => {
          if (!cancelled) setSearch({ status: 'done', results: page.content })
        })
        .catch(() => {
          if (!cancelled) setSearch({ status: 'error' })
        })
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [organizationId, type, text, value])

  if (value) {
    return (
      <div className="resource-picker" role="group" aria-label={label}>
        <span className="resource-picker__label">{label}</span>
        <div className="resource-picker__selected">
          <span>
            <span className="data-mono">{value.code}</span> {value.name}
            <span className="resource-picker__meta">
              {' · '}
              {value.unit.code}
              {value.currentCost != null ? ` · ${money(Number(value.currentCost))}` : ''}
            </span>
          </span>
          <button type="button" className="button button--small" onClick={() => onChange(null)}>
            {t.change}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="resource-picker" role="group" aria-label={label}>
      <span className="resource-picker__label">{label}</span>
      <div className="resource-picker__controls">
        {types.length > 1 ? (
          <label className="resource-picker__field">
            <span>{t.type}</span>
            <select className="prices-input" value={type} onChange={(event) => setType(event.target.value as ResourceType)}>
              {types.map((option) => (
                <option key={option} value={option}>
                  {typeLabels?.[option] ?? m.prices.type[option]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="resource-picker__field resource-picker__field--wide">
          <span>{t.search}</span>
          <input
            type="search"
            className="prices-input"
            placeholder={t.searchPlaceholder}
            value={text}
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={Boolean(error)}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p className="form-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
      <div className="resource-picker__results" aria-label={t.results} aria-live="polite">
        {search.status === 'loading' ? (
          <p className="resource-picker__note">{t.searching}</p>
        ) : search.status === 'error' ? (
          <p className="resource-picker__note">{t.searchError}</p>
        ) : search.status === 'done' && search.results.length === 0 ? (
          <p className="resource-picker__note">{t.noResults}</p>
        ) : search.status === 'done' ? (
          <ul className="resource-picker__list">
            {search.results.map((resource) => {
              const reason = unpickableReason(resource)
              return (
                <li key={resource.id}>
                  <button
                    type="button"
                    className="resource-picker__option"
                    disabled={reason !== null}
                    onClick={() => onChange(resource)}
                  >
                    <span className="data-mono">{resource.code}</span>
                    <span className="resource-picker__name">{resource.name}</span>
                    <span className="resource-picker__meta">
                      {resource.unit.code} · {resource.currentCost != null ? money(Number(resource.currentCost)) : t.noCost}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
