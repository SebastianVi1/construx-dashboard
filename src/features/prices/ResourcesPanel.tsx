import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonTable } from '../../components/page'
import { useLocale } from '../../i18n'
import { listResources, type Page, type Resource } from './pricesApi'
import { pricesLoadKind } from './pricesErrors'
import { ResourceFiltersBar } from './ResourceFiltersBar'
import { ResourcesPager } from './ResourcesPager'
import { ResourcesTable } from './ResourcesTable'
import {
  hasFilters,
  pricesSearchString,
  resourcesQueryString,
  tabResourceType,
  toggleSort,
  withFilters,
  type PricesTab,
  type PricesView,
} from './resourceQuery'

type ResourcesPanelProps = {
  organizationId: string
  view: PricesView
  onChange: (view: PricesView, options?: { replace?: boolean }) => void
  onOpen: (resourceId: string) => void
}

type Shown = { tab: PricesTab; page: Page<Resource> }

/** The server-paged table of one resource type, with its filters, sort and pager. */
export function ResourcesPanel({ organizationId, view, onChange, onOpen }: ResourcesPanelProps) {
  const { messages: m } = useLocale()
  const t = m.prices
  const type = tabResourceType(view.tab)
  const request = { types: type ? [type] : [], filters: view.filters, sort: view.sort, page: view.page }
  const [shown, setShown] = useState<Shown | null>(null)
  // After the first answer, a new page or filter keeps the old rows (dimmed) instead of a skeleton.
  const resources = useRemoteData(
    `${organizationId}:resources${resourcesQueryString(request)}`,
    () => listResources(organizationId, request),
    { immediate: shown !== null },
  )

  if (resources.data && resources.data !== shown?.page) setShown({ tab: view.tab, page: resources.data })

  const current = resources.data ?? (shown?.tab === view.tab ? shown.page : undefined)
  const busy = resources.status === 'loading'
  const search = pricesSearchString(view)

  let body
  if (resources.status === 'error') {
    const kind = pricesLoadKind(resources.error)
    body = (
      <Notice tone="error" action={{ label: t.load.retry, onClick: resources.reload }}>
        {kind === 'notFound' ? t.load.generic : t.load[kind]}
      </Notice>
    )
  } else if (!current) {
    body = <SkeletonTable columns={7} label={m.workspace.loading} />
  } else if (current.totalElements === 0) {
    body = (
      <div className="empty-state" aria-busy={busy || undefined}>
        <p>{hasFilters(view.filters) ? t.empty.noResults : view.tab === 'equipment' ? t.empty.equipment : t.empty.materials}</p>
      </div>
    )
  } else {
    body = (
      <>
        <ResourcesTable
          resources={current.content}
          sort={view.sort}
          busy={busy}
          onSort={(field) => onChange({ ...view, sort: toggleSort(view.sort, field), page: 0 })}
          linkTo={(id) => `/prices/${encodeURIComponent(id)}${search}`}
          onOpen={onOpen}
        />
        <ResourcesPager
          page={current.page}
          size={current.size}
          totalElements={current.totalElements}
          totalPages={current.totalPages}
          onPage={(page) => onChange({ ...view, page })}
        />
      </>
    )
  }

  return (
    <section className="page-section prices-resources" aria-label={t.tab[view.tab]}>
      <ResourceFiltersBar
        organizationId={organizationId}
        filters={view.filters}
        onChange={(change, options) => onChange(withFilters(view, change), options)}
      />
      {body}
    </section>
  )
}
