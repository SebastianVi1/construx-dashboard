import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
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

/** Sites of the selected company. Archived sites appear only through the status filter. */
export function SitesPage() {
  const { messages: m, locale } = useLocale()
  const t = m.sites
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const filterId = useId()
  const [filter, setFilter] = useState<SiteStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const sites = useRemoteData(`${organization.id}:${filter}`, () => listSites(organization.id, filter || undefined))
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
        <div className="sites-toolbar">
          <label className="sites-toolbar__label" htmlFor={filterId}>
            {t.filterLabel}
          </label>
          <span className="filter-select">
            <select
              id={filterId}
              value={filter}
              onChange={(event) => setFilter(event.target.value as SiteStatus | '')}
            >
              <option value="">{t.filterOpen}</option>
              {siteStatuses.map((status) => (
                <option key={status} value={status}>
                  {t.status[status]}
                </option>
              ))}
            </select>
          </span>
        </div>

        {sites.data ? (
          sites.data.length > 0 ? (
            <SitesTable sites={sites.data} t={t} locale={locale} />
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
