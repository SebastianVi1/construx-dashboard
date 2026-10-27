import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { FilterTabs, filterCounts, type FilterOption } from '../../components/filter'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale, type Locale, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { CreateSiteDialog } from './CreateSiteDialog'
import { ProgressMeter, SiteStatusBadge } from './SiteBits'
import { scheduleText } from './siteDisplay'
import { siteProgress } from './siteHelpers'
import { listSites, siteErrorKind, siteStatuses, type Site, type SiteStatus } from './sitesApi'
import './sites.css'

/**
 * Sites of the selected company. Open sites load once and the status tabs filter them
 * here; archived sites are fetched only when their tab is chosen.
 */
export function SitesPage() {
  const { messages: m, locale } = useLocale()
  const t = m.sites
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<SiteStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const open = useRemoteData(`${organization.id}:sites`, () => listSites(organization.id))
  const archived = useRemoteData(filter === 'ARCHIVED' ? `${organization.id}:sites:ARCHIVED` : null, () =>
    listSites(organization.id, 'ARCHIVED'),
  )
  const sites = filter === 'ARCHIVED' ? archived : open
  const openStatuses = siteStatuses.filter((status) => status !== 'ARCHIVED')
  const { counts, visible } = filterCounts(open.data ?? [], (site) => site.status, openStatuses, filter === 'ARCHIVED' ? '' : filter)
  const shown = filter === 'ARCHIVED' ? archived.data : open.data ? visible : undefined
  const filters: FilterOption<SiteStatus | ''>[] = [
    { value: '', label: t.filterAll, count: open.data ? counts.all : undefined },
    ...openStatuses.map((status) => ({ value: status, label: t.status[status], count: open.data ? counts[status] : undefined })),
    { value: 'ARCHIVED', label: t.status.ARCHIVED, count: archived.data?.length },
  ]
  const canCreate = can('MANAGE_PROJECT')

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
        {canCreate ? (
          <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
            {t.add}
          </button>
        ) : null}
      </header>

      <section className="page-section" aria-label={t.title}>
        <FilterTabs label={t.filterLabel} options={filters} value={filter} onChange={setFilter} />

        {shown ? (
          shown.length > 0 ? (
            <SitesTable sites={shown} t={t} locale={locale} />
          ) : filter ? (
            <div className="empty-state">
              <p>{t.noResults}</p>
            </div>
          ) : (
            <div className="empty-state">
              <h2>{t.emptyTitle}</h2>
              <p>{canCreate ? t.emptyManager : t.emptyViewer}</p>
              {canCreate ? (
                <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
                  {t.addFirst}
                </button>
              ) : null}
            </div>
          )
        ) : sites.status === 'error' ? (
          <Notice tone="error" action={{ label: t.load.retry, onClick: sites.reload }}>
            {loadMessage(t.load, siteErrorKind(sites.error))}
          </Notice>
        ) : (
          <LoadingState label={t.loading} />
        )}
      </section>

      {creating ? <CreateSiteDialog organizationId={organization.id} onClose={() => setCreating(false)} /> : null}
    </div>
  )
}

function SitesTable({ sites, t, locale }: { sites: Site[]; t: Messages['sites']; locale: Locale }) {
  const showProgress = sites.some((site) => siteProgress(site) !== null)

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{t.column.name}</th>
            <th scope="col">{t.column.status}</th>
            <th scope="col">{t.column.address}</th>
            <th scope="col">{t.column.schedule}</th>
            {showProgress ? <th scope="col">{t.column.progress}</th> : null}
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => {
            const progress = siteProgress(site)
            return (
              <tr key={site.id}>
                <td>
                  <Link className="table-link" to={`/sites/${encodeURIComponent(site.id)}`}>
                    {site.name}
                  </Link>
                </td>
                <td>
                  <SiteStatusBadge status={site.status} labels={t.status} />
                </td>
                <td className={site.address ? undefined : 'cell-muted'}>{site.address || t.noAddress}</td>
                <td className="data-mono">{scheduleText(site, t, locale)}</td>
                {showProgress ? (
                  <td>
                    {progress && progress.total > 0 ? (
                      <ProgressMeter
                        progress={progress}
                        label={formatMessage(t.progress, { done: progress.done, total: progress.total })}
                      />
                    ) : progress ? (
                      <span className="cell-muted">{t.noTasks}</span>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function loadMessage(t: { forbidden: string; notFound: string; session: string; generic: string }, kind: string) {
  if (kind === 'forbidden') return t.forbidden
  if (kind === 'session') return t.session
  if (kind === 'notFound') return t.notFound
  return t.generic
}
