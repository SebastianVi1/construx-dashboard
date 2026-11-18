import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale } from '../../i18n'
import type { Resource } from './pricesApi'
import { ResourceBadges } from './ResourceBadges'
import { formatInstant, moneyText } from './resourceDisplay'
import type { ResourceSort, SortField } from './resourceQuery'

type ResourcesTableProps = {
  resources: Resource[]
  sort: ResourceSort
  onSort: (field: SortField) => void
  /** Where a row's link goes (the drawer route, keeping the list's URL state). */
  linkTo: (resourceId: string) => string
  onOpen: (resourceId: string) => void
  /** A new page or filter is loading; the rows shown are the previous answer. */
  busy: boolean
}

/** One page of Resources; the whole row opens the detail, the name is its keyboard and new-tab target. */
export function ResourcesTable({ resources, sort, onSort, linkTo, onOpen, busy }: ResourcesTableProps) {
  const { messages: m, locale } = useLocale()
  const t = m.prices
  const { money } = useCurrency()

  function openRow(event: MouseEvent<HTMLTableRowElement>, resourceId: string) {
    // The name link navigates on its own; a click elsewhere on the row does the same.
    if ((event.target as HTMLElement).closest('a')) return
    onOpen(resourceId)
  }

  return (
    <div className="table-scroll prices-table-wrap" aria-busy={busy || undefined}>
      <table className="data-table prices-table">
        <thead>
          <tr>
            <SortableHeader field="code" label={t.column.code} sortBy={t.sortBy} sort={sort} onSort={onSort} />
            <SortableHeader field="name" label={t.column.name} sortBy={t.sortBy} sort={sort} onSort={onSort} />
            <th scope="col">{t.column.unit}</th>
            <th scope="col">{t.column.family}</th>
            <th scope="col">{t.column.supplier}</th>
            <SortableHeader field="currentCost" label={t.column.currentCost} sortBy={t.sortBy} sort={sort} onSort={onSort} numeric />
            <SortableHeader field="costUpdatedAt" label={t.column.costUpdatedAt} sortBy={t.sortBy} sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr
              key={resource.id}
              className="prices-table__row"
              data-archived={resource.archivedAt ? true : undefined}
              onClick={(event) => openRow(event, resource.id)}
            >
              <td className="data-mono prices-table__code">{resource.code}</td>
              <td className="prices-table__name">
                <Link className="table-link" to={linkTo(resource.id)}>
                  {resource.name}
                </Link>
                <ResourceBadges resource={resource} />
              </td>
              <td className="data-mono">{resource.unit.code}</td>
              <td className={resource.family ? undefined : 'cell-muted'}>{resource.family?.name ?? t.none}</td>
              <td className={resource.supplier ? undefined : 'cell-muted'}>{resource.supplier?.name ?? t.none}</td>
              <td className="prices-table__cost">
                {resource.currentCost === null ? (
                  <span className="cell-muted">{t.noCost}</span>
                ) : (
                  <span className="data-mono">{moneyText(money, resource.currentCost)}</span>
                )}
              </td>
              <td className={resource.costUpdatedAt ? 'prices-table__date' : 'prices-table__date cell-muted'}>
                {resource.costUpdatedAt ? formatInstant(resource.costUpdatedAt, locale) : t.none}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="visually-hidden" aria-live="polite">
        {busy ? m.workspace.loading : ''}
      </span>
    </div>
  )
}

type SortableHeaderProps = {
  field: SortField
  label: string
  /** "Sort by {column}". */
  sortBy: string
  sort: ResourceSort
  onSort: (field: SortField) => void
  numeric?: boolean
}

function SortableHeader({ field, label, sortBy, sort, onSort, numeric = false }: SortableHeaderProps) {
  const current = sort.field === field
  const sortLabel = formatMessage(sortBy, { column: label })
  return (
    <th scope="col" aria-sort={current ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={numeric ? 'prices-table__numeric' : undefined}>
      <button type="button" className="prices-sort" title={sortLabel} data-active={current || undefined} onClick={() => onSort(field)}>
        {label}
        <svg className="prices-sort__arrow" data-dir={current ? sort.dir : undefined} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 2.5v7M3 6.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </th>
  )
}
