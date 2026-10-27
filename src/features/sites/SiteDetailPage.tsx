import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { ArchiveSiteDialog } from './ArchiveSiteDialog'
import { ProgressMeter, SiteStatusBadge } from './SiteBits'
import { SiteDetailsForm } from './SiteDetailsForm'
import { SitePeople } from './SitePeople'
import { dateText, scheduleText } from './siteDisplay'
import { siteProgress } from './siteHelpers'
import { getSite, listSiteAccess, siteErrorKind, type Site } from './sitesApi'
import './sites.css'

/** One site: its details (editable with MANAGE_PROJECT), progress, people, and the way to its phases. */
export function SiteDetailPage() {
  const { siteId = '' } = useParams()
  const { messages: m, locale } = useLocale()
  const t = m.sites
  const organization = useCurrentOrganization()
  const { access, can } = usePermissions()
  // Both requests start together; the people list does not wait for the site.
  const site = useRemoteData(`${organization.id}:${siteId}`, () => getSite(organization.id, siteId))
  const people = useRemoteData(`${organization.id}:${siteId}:access`, () => listSiteAccess(organization.id, siteId))
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [formVersion, setFormVersion] = useState(0)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

  const myMembershipId = access?.membershipId ?? null
  const onSite = people.data ? people.data.some((person) => person.membershipId === myMembershipId) : undefined
  const canManage = can('MANAGE_PROJECT', siteId, { onSite })
  const siteName = site.data?.name

  useEffect(() => {
    document.title = `${siteName ?? t.title} | Construx`
  }, [siteName, t.title])

  if (!site.data) {
    return (
      <div className="page">
        <Link className="page-back" to="/sites">
          {t.detail.back}
        </Link>
        {site.status === 'error' ? (
          <Notice tone="error" action={{ label: t.load.retry, onClick: site.reload }}>
            {loadMessage(t.load, siteErrorKind(site.error))}
          </Notice>
        ) : (
          <LoadingState label={t.loading} />
        )}
      </div>
    )
  }

  const current = site.data
  const progress = siteProgress(current)

  function saved(updated: Site, notice: string) {
    site.update(() => updated)
    setFormVersion((version) => version + 1)
    setSavedNotice(notice)
  }

  return (
    <div className="page">
      <Link className="page-back" to="/sites">
        {t.detail.back}
      </Link>

      <header className="site-sheet">
        <div className="page-header">
          <div className="page-header__text">
            <div className="site-sheet__status">
              <SiteStatusBadge status={current.status} labels={t.status} />
            </div>
            <h1>{current.name}</h1>
            <p>{current.address || t.noAddress}</p>
          </div>
          {canManage && current.status !== 'ARCHIVED' ? (
            <button type="button" className="button button--danger" onClick={() => setArchiveOpen(true)}>
              {t.detail.archive}
            </button>
          ) : null}
        </div>
        <dl className="site-sheet__facts">
          <div>
            <dt>{t.column.schedule}</dt>
            <dd className="data-mono">{scheduleText(current, t, locale)}</dd>
          </div>
          {progress ? (
            <div>
              <dt>{t.detail.progressTitle}</dt>
              <dd>
                {progress.total > 0 ? (
                  <ProgressMeter
                    progress={progress}
                    label={formatMessage(t.detail.progress, { done: progress.done, total: progress.total })}
                  />
                ) : (
                  t.noTasks
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      {savedNotice ? <Notice tone="success">{savedNotice}</Notice> : null}

      <div className="site-columns">
        <section className="page-section" aria-labelledby="site-details-heading">
          <div className="page-section__header">
            <h2 id="site-details-heading">{t.detail.details}</h2>
          </div>
          {canManage ? (
            <SiteDetailsForm
              key={formVersion}
              organizationId={organization.id}
              site={current}
              onSaved={(updated) => saved(updated, t.detail.saved)}
            />
          ) : (
            <dl className="site-facts">
              <div>
                <dt>{t.field.name}</dt>
                <dd>{current.name}</dd>
              </div>
              <div>
                <dt>{t.field.address}</dt>
                <dd>{current.address || t.noAddress}</dd>
              </div>
              <div>
                <dt>{t.field.startDate}</dt>
                <dd className="data-mono">{current.startDate ? dateText(current.startDate, locale) : t.detail.notScheduled}</dd>
              </div>
              <div>
                <dt>{t.field.expectedEndDate}</dt>
                <dd className="data-mono">
                  {current.expectedEndDate ? dateText(current.expectedEndDate, locale) : t.detail.notScheduled}
                </dd>
              </div>
              <div>
                <dt>{t.field.status}</dt>
                <dd>{t.status[current.status]}</dd>
              </div>
            </dl>
          )}
        </section>

        <SitePeople
          organizationId={organization.id}
          siteId={current.id}
          people={people}
          canManage={canManage}
          myMembershipId={myMembershipId}
        />
      </div>

      {can('VIEW_GOAL', current.id, { onSite }) ? (
        <section className="page-section site-phases-link" aria-labelledby="site-phases-heading">
          <div className="page-section__header">
            <div>
              <h2 id="site-phases-heading">{m.phasesPage.open}</h2>
              <p>{m.phasesPage.openHint}</p>
            </div>
            <Link className="button" to={`/sites/${encodeURIComponent(current.id)}/phases`}>
              {m.phasesPage.open}
            </Link>
          </div>
        </section>
      ) : null}

      {archiveOpen ? (
        <ArchiveSiteDialog
          organizationId={organization.id}
          site={current}
          onClose={() => setArchiveOpen(false)}
          onArchived={(updated) => {
            setArchiveOpen(false)
            saved(updated, t.detail.archived)
          }}
        />
      ) : null}
    </div>
  )
}

function loadMessage(t: { forbidden: string; notFound: string; session: string; generic: string }, kind: string) {
  if (kind === 'forbidden' || kind === 'notFound') return t.notFound
  if (kind === 'session') return t.session
  return t.generic
}
