import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { filterCounts, type FilterOption } from '../../components/filter'
import { SkeletonList, Notice } from '../../components/page'
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
    <div className="page sites-page">
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
          <span className="sites-toolbar__label">{t.filterLabel}</span>
          <div className="filter-select">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as SiteStatus | '')}
              aria-label={t.filterLabel}
            >
              {filters.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.count !== undefined ? `${opt.label} (${opt.count})` : opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {shown ? (
          shown.length > 0 ? (
            <SitesGrid sites={shown} t={t} locale={locale} />
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
          <SkeletonList />
        )}
      </section>

      {creating ? <CreateSiteDialog organizationId={organization.id} onClose={() => setCreating(false)} /> : null}
    </div>
  )
}

function SitesGrid({ sites, t, locale }: { sites: Site[]; t: Messages['sites']; locale: Locale }) {
  return (
    <div className="sites-grid">
      {sites.map((site) => {
        const progress = siteProgress(site)
        return (
          <Link key={site.id} className="site-card" to={`/sites/${encodeURIComponent(site.id)}`}>
            <div className="site-card__header">
              <SiteStatusBadge status={site.status} labels={t.status} />
              <svg className="site-card__open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
                <path d="M5 19 19 5M5 5h14v14" />
              </svg>
            </div>
            <h2 className="site-card__name">{site.name}</h2>
            <div className={`site-card__address${site.address ? '' : ' cell-muted'}`}>
              {site.address || t.noAddress}
            </div>
            <div className="site-card__footer">
              <div className="site-card__schedule data-mono">{scheduleText(site, t, locale)}</div>
              {progress && progress.total > 0 ? (
                <div className="site-card__progress">
                  <ProgressMeter
                    progress={progress}
                    label={formatMessage(t.progress, { done: progress.done, total: progress.total })}
                  />
                </div>
              ) : null}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function loadMessage(t: { forbidden: string; notFound: string; session: string; generic: string }, kind: string) {
  if (kind === 'forbidden') return t.forbidden
  if (kind === 'session') return t.session
  if (kind === 'notFound') return t.notFound
  return t.generic
}
