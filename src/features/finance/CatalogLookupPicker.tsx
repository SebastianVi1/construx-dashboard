import { useEffect, useId, useState } from 'react'
import { useLocale } from '../../i18n'
import { lookupCatalog, type CatalogLookupItem } from '../sites/catalogLookup'
import type { ResourceType } from '../prices/pricesApi'
import '../prices/resource-picker.css'

type CatalogLookupPickerProps = {
  organizationId: string
  siteId: string
  /** Labels of the Resource types listed. */
  typeLabels: Partial<Record<ResourceType, string>>
  value: CatalogLookupItem | null
  onChange: (item: CatalogLookupItem | null) => void
  label: string
  error?: string
}

type Search = { status: 'idle' | 'loading' | 'error' } | { status: 'done'; results: CatalogLookupItem[] }

const SEARCH_DELAY_MS = 250

/**
 * Picks a Resource to charge as an expense through the site's catalog lookup (docs/pricing.md §6.7), so a task
 * Lead without VIEW_PRICES can use it. It lists only Resources that can be charged, by code and name, never costs.
 */
export function CatalogLookupPicker({ organizationId, siteId, typeLabels, value, onChange, label, error }: CatalogLookupPickerProps) {
  const { messages: m } = useLocale()
  const t = m.prices.picker
  const id = useId()
  const [text, setText] = useState('')
  const [search, setSearch] = useState<Search>({ status: 'idle' })

  useEffect(() => {
    if (value) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearch({ status: 'loading' })
      lookupCatalog(organizationId, siteId, 'EXPENSE', text)
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
  }, [organizationId, siteId, text, value])

  if (value) {
    return (
      <div className="resource-picker" role="group" aria-label={label}>
        <span className="resource-picker__label">{label}</span>
        <div className="resource-picker__selected">
          <span>
            <span className="data-mono">{value.code}</span> {value.name}
            <span className="resource-picker__meta">
              {' · '}
              {value.unitCode}
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
            {search.results.map((item) => (
              <li key={item.id}>
                <button type="button" className="resource-picker__option" onClick={() => onChange(item)}>
                  <span className="data-mono">{item.code}</span>
                  <span className="resource-picker__name">{item.name}</span>
                  <span className="resource-picker__meta">
                    {typeLabels[item.type] ?? m.prices.type[item.type]} · {item.unitCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
