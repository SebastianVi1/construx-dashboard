import { useEffect, useEffectEvent, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Field, selectedOptionValues, type FieldOption } from '../../components/form'
import { useLocale } from '../../i18n'
import { listFamilies, listSuppliers, listUnits } from './pricesApi'
import { discontinuedChoices, hasFilters, noFilters, type DiscontinuedChoice, type ResourceFilters } from './resourceQuery'

/** Wait after the last keystroke before searching, so typing a code is one request. */
const SEARCH_DELAY_MS = 300

/** Longest search sent; the longest Resource name is 160 characters. */
const SEARCH_MAX_LENGTH = 160

type ResourceFiltersBarProps = {
  organizationId: string
  filters: ResourceFilters
  onChange: (change: Partial<ResourceFilters>, options?: { replace?: boolean }) => void
}

/** Search and filters of the resources table, next to it. Every change goes back to page one. */
export function ResourceFiltersBar({ organizationId, filters, onChange }: ResourceFiltersBarProps) {
  const { messages: m } = useLocale()
  const t = m.prices.filters
  const units = useRemoteData(`${organizationId}:units`, () => listUnits(organizationId), { immediate: true })
  const families = useRemoteData(`${organizationId}:families`, () => listFamilies(organizationId), { immediate: true })
  const suppliers = useRemoteData(`${organizationId}:suppliers`, () => listSuppliers(organizationId), { immediate: true })
  const [draft, setDraft] = useState(filters.query)
  const [committed, setCommitted] = useState(filters.query)

  // The URL is the source of truth for the search: after a commit, the back button or "Clear filters"
  // the field shows what it says.
  if (filters.query !== committed) {
    setCommitted(filters.query)
    setDraft(filters.query)
  }

  const commitSearch = useEffectEvent((query: string) => onChange({ query }, { replace: true }))

  useEffect(() => {
    if (draft === committed) return
    const timer = setTimeout(() => commitSearch(draft), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, committed])

  const any: FieldOption = { value: '', label: t.any }
  const familyOptions = [any, ...(families.data ?? []).map((family) => ({ value: family.id, label: `${family.name} (${family.code})` }))]
  const unitOptions = [
    any,
    ...(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.description ? `${unit.code} (${unit.description})` : unit.code })),
  ]
  const supplierOptions = [
    any,
    ...(suppliers.data ?? []).map((supplier) => ({ value: supplier.id, label: supplier.branch ? `${supplier.name} (${supplier.branch})` : supplier.name })),
  ]
  const discontinuedOptions = discontinuedChoices.map((value) => ({ value, label: t.discontinuedChoice[value] }))

  return (
    <div className="prices-filters" role="search" aria-label={t.label}>
      <div className="prices-filters__search">
        <Field
          config={{
            name: 'prices-search',
            label: t.search,
            type: 'search',
            placeholder: t.searchPlaceholder,
            maxLength: SEARCH_MAX_LENGTH,
            autoComplete: 'off',
            spellCheck: false,
          }}
          value={draft}
          onChange={setDraft}
        />
      </div>
      <Field
        config={{ name: 'prices-family', label: t.family, type: 'select', options: familyOptions }}
        value={filters.familyId}
        disabled={!families.data}
        onChange={(familyId) => onChange({ familyId })}
      />
      <Field
        config={{ name: 'prices-unit', label: t.unit, type: 'select', options: unitOptions }}
        value={filters.unitId}
        disabled={!units.data}
        onChange={(unitId) => onChange({ unitId })}
      />
      <Field
        config={{ name: 'prices-supplier', label: t.supplier, type: 'select', options: supplierOptions }}
        value={filters.supplierId}
        disabled={!suppliers.data}
        onChange={(supplierId) => onChange({ supplierId })}
      />
      <Field
        config={{ name: 'prices-discontinued', label: t.discontinued, type: 'select', options: discontinuedOptions }}
        value={filters.discontinued}
        onChange={(value) => onChange({ discontinued: value as DiscontinuedChoice })}
      />
      <div className="prices-filters__end">
        <Field
          config={{
            name: 'prices-archived',
            label: t.archived,
            type: 'checkboxes',
            options: [{ value: 'archived', label: t.includeArchived }],
            groupClassName: 'prices-filters__check',
            groupLabelClassName: 'visually-hidden',
            optionClassName: 'prices-filters__check-option',
          }}
          value={filters.includeArchived ? '["archived"]' : '[]'}
          onChange={(value) => onChange({ includeArchived: selectedOptionValues(value).includes('archived') })}
        />
        {hasFilters(filters) ? (
          <button type="button" className="button button--small prices-filters__clear" onClick={() => onChange(noFilters)}>
            {t.clear}
          </button>
        ) : null}
      </div>
    </div>
  )
}
