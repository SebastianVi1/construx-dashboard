import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonTable } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, intlLocales, useLocale, type Locale, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { ResourceBadges } from './ResourceBadges'
import { ResourceDrawer } from './ResourceDrawer'
import { SuppliersTab } from './SuppliersTab'
import {
  listFamilies,
  listResources,
  listSuppliers,
  listUnits,
  pricesErrorKind,
  type Resource,
  type ResourceSort,
  type ResourceSortField,
  type ResourceType,
} from './pricesApi'
import { effectiveSort, emptyFilters, nextSort, pageRange, priceTabs, resourceQueryFor, type PriceFilters, type PriceTabKey } from './pricesView'
import './prices.css'

type PricesMessages = Messages['prices']

/**
 * The company's cost catalog, replacing the former Materials screen. Each active tab is a
 * server-paged table of one Resource type; a row opens the detail drawer with the cost history.
 */
export function PricesPage() {
  const { messages: m } = useLocale()
  const t = m.prices
  const { can } = usePermissions()
  const canView = can('VIEW_PRICES')
  const [tab, setTab] = useState<PriceTabKey>('materials')

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  if (!canView) {
    return (
      <div className="page">
        <Notice>{m.workspace.forbidden}</Notice>
      </div>
    )
  }

  const active = priceTabs.find((candidate) => candidate.key === tab)
  return (
    <div className="page">
      <PricesHeader t={t} />
      <div className="prices-tabs" role="tablist" aria-label={t.tabsLabel}>
        {priceTabs.map((candidate) => (
          <button
            key={candidate.key}
            type="button"
            role="tab"
            className="prices-tabs__tab"
            aria-selected={candidate.key === tab}
            disabled={!candidate.enabled}
            title={candidate.enabled ? undefined : t.comingSoon}
            onClick={() => setTab(candidate.key)}
          >
            {t.tab[candidate.key]}
            {candidate.enabled ? null : <span className="prices-tabs__soon">{t.comingSoon}</span>}
          </button>
        ))}
      </div>
      {active?.type ? <ResourceCatalog key={active.key} tab={active.key} type={active.type} t={t} /> : null}
      {active?.key === 'suppliers' ? <SuppliersTab t={t} /> : null}
    </div>
  )
}

function PricesHeader({ t }: { t: PricesMessages }) {
  const { currency } = useCurrency()
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1>{t.title}</h1>
        <p>{formatMessage(t.description, { currency })}</p>
      </div>
      <div className="page-header__actions">
        <Link className="button" to="/prices/units">
          {t.manageLists}
        </Link>
      </div>
    </header>
  )
}

function ResourceCatalog({ tab, type, t }: { tab: PriceTabKey; type: ResourceType; t: PricesMessages }) {
  const { locale } = useLocale()
  const { money } = useCurrency()
  const organization = useCurrentOrganization()
  const [filters, setFilters] = useState<PriceFilters>(emptyFilters)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<ResourceSort | undefined>(undefined)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  // The search box applies after the person pauses typing, so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.query === search ? current : { ...current, query: search }))
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const query = resourceQueryFor(type, filters, sort, page)
  const key = `${organization.id}:resources:${JSON.stringify(query)}`
  const resources = useRemoteData(key, () => listResources(organization.id, query), { remember: false })
  const units = useRemoteData(`${organization.id}:units`, () => listUnits(organization.id))
  const families = useRemoteData(`${organization.id}:families`, () => listFamilies(organization.id))
  const suppliers = useRemoteData(`${organization.id}:suppliers`, () => listSuppliers(organization.id))

  function change(next: Partial<PriceFilters>) {
    setFilters((current) => ({ ...current, ...next }))
    setPage(0)
  }

  function clear() {
    setSearch('')
    setFilters(emptyFilters)
    setPage(0)
  }

  const data = resources.data
  const filtered = filters.query !== '' || JSON.stringify({ ...filters, query: '' }) !== JSON.stringify(emptyFilters)
  const range = data ? pageRange(data) : null

  return (
    <section className="page-section" aria-label={t.tab[tab]}>
      <div className="prices-filters" role="group" aria-label={t.filters.label}>
        <label className="prices-filters__field prices-filters__field--wide">
          <span>{t.filters.search}</span>
          <input
            type="search"
            className="prices-input"
            placeholder={t.filters.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="prices-filters__field">
          <span>{t.filters.family}</span>
          <select className="prices-input" value={filters.familyId} onChange={(event) => change({ familyId: event.target.value })}>
            <option value="">{t.filters.any}</option>
            {(families.data ?? []).map((family) => (
              <option key={family.id} value={family.id}>
                {family.code} · {family.name}
              </option>
            ))}
          </select>
        </label>
        <label className="prices-filters__field">
          <span>{t.filters.unit}</span>
          <select className="prices-input" value={filters.unitId} onChange={(event) => change({ unitId: event.target.value })}>
            <option value="">{t.filters.any}</option>
            {(units.data ?? []).map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.description ? `${unit.code} · ${unit.description}` : unit.code}
              </option>
            ))}
          </select>
        </label>
        <label className="prices-filters__field">
          <span>{t.filters.supplier}</span>
          <select className="prices-input" value={filters.supplierId} onChange={(event) => change({ supplierId: event.target.value })}>
            <option value="">{t.filters.any}</option>
            {(suppliers.data ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.branch ? `${supplier.name} · ${supplier.branch}` : supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="prices-filters__field">
          <span>{t.filters.discontinued}</span>
          <select
            className="prices-input"
            value={filters.discontinued}
            onChange={(event) => change({ discontinued: event.target.value as PriceFilters['discontinued'] })}
          >
            <option value="">{t.filters.any}</option>
            <option value="yes">{t.filters.discontinuedYes}</option>
            <option value="no">{t.filters.discontinuedNo}</option>
          </select>
        </label>
        <label className="prices-filters__check">
          <input type="checkbox" checked={filters.includeArchived} onChange={(event) => change({ includeArchived: event.target.checked })} />
          <span>{t.filters.archived}</span>
        </label>
        {filtered || search ? (
          <button type="button" className="button button--small" onClick={clear}>
            {t.filters.clear}
          </button>
        ) : null}
      </div>

      {resources.status === 'error' && !data ? (
        <Notice tone="error" action={{ label: t.load.retry, onClick: resources.reload }}>
          {t.load[pricesErrorKind(resources.error)]}
        </Notice>
      ) : !data ? (
        <SkeletonTable columns={6} />
      ) : data.totalElements === 0 ? (
        <div className="empty-state">
          {filtered ? (
            <p>{t.noResults}</p>
          ) : (
            <>
              <h2>{t.emptyTitle}</h2>
              <p>{t.empty}</p>
            </>
          )}
        </div>
      ) : (
        <>
          <ResourceTable
            rows={data.content}
            sort={sort}
            onSort={(field) => {
              setSort((current) => nextSort(current, field))
              setPage(0)
            }}
            onOpen={setOpenId}
            t={t}
            locale={locale}
            money={money}
          />
          {range ? (
            <nav className="prices-pager" aria-label={t.filters.label}>
              <span>{formatMessage(t.range, { from: range.from, to: range.to, total: range.total })}</span>
              <button type="button" className="button button--small" disabled={!range.hasPrevious} onClick={() => setPage(page - 1)}>
                {t.previous}
              </button>
              <button type="button" className="button button--small" disabled={!range.hasNext} onClick={() => setPage(page + 1)}>
                {t.next}
              </button>
            </nav>
          ) : null}
        </>
      )}

      {openId ? <ResourceDrawer organizationId={organization.id} resourceId={openId} onClose={() => setOpenId(null)} /> : null}
    </section>
  )
}

type ResourceTableProps = {
  rows: Resource[]
  sort: ResourceSort | undefined
  onSort: (field: ResourceSortField) => void
  onOpen: (id: string) => void
  t: PricesMessages
  locale: Locale
  money: (amountMxn: number | string) => string
}

function ResourceTable({ rows, sort, onSort, onOpen, t, locale, money }: ResourceTableProps) {
  const active = effectiveSort(sort)
  const date = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium' })

  function header(field: ResourceSortField, label: string, className?: string) {
    const direction = active.field === field ? active.direction : null
    return (
      <th scope="col" className={className} aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
        <button type="button" className="prices-sort" aria-label={formatMessage(t.sortBy, { column: label })} onClick={() => onSort(field)}>
          {label}
          <span className="prices-sort__arrow" aria-hidden="true">
            {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : ''}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="table-scroll">
      <table className="data-table prices-table">
        <thead>
          <tr>
            {header('code', t.column.code)}
            {header('name', t.column.name)}
            <th scope="col">{t.column.unit}</th>
            <th scope="col">{t.column.family}</th>
            <th scope="col">{t.column.supplier}</th>
            {header('currentCost', t.column.currentCost, 'prices-table__number')}
            {header('costUpdatedAt', t.column.costUpdatedAt)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="prices-table__row" onClick={() => onOpen(row.id)}>
              <td className="data-mono">
                <button type="button" className="table-link prices-table__open" onClick={() => onOpen(row.id)}>
                  {row.code}
                </button>
              </td>
              <td>
                {row.name}
                <ResourceBadges resource={row} t={t} />
              </td>
              <td className="data-mono">{row.unit.code}</td>
              <td>{row.family ? row.family.name : <span className="cell-muted">—</span>}</td>
              <td>{row.supplier ? row.supplier.name : <span className="cell-muted">—</span>}</td>
              <td className="data-mono prices-table__number">
                {row.currentCost === null ? <span className="cell-muted">{t.noCost}</span> : money(row.currentCost)}
              </td>
              <td className="data-mono">{row.costUpdatedAt ? date.format(new Date(row.costUpdatedAt)) : <span className="cell-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
