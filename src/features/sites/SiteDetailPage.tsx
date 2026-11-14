import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { BackLink, Notice } from '../../components/page'
import { SiteDetailSkeleton } from './SiteSkeletons'
import { formatMessage, useLocale } from '../../i18n'
import { PhaseSchedule } from '../goals/PhasesPage'
import { SitePhases } from '../goals/SitePhases'
import { SiteAttendanceBar } from '../attendance/SiteAttendanceBar'
import { SiteFloorPlans } from '../floor-plans/SiteFloorPlansPage'
import { SiteReportsSection } from '../reports/SiteReportsSection'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { ArchiveSiteDialog } from './ArchiveSiteDialog'
import { SiteBudget } from './SiteBudget'
import { ProgressMeter, SiteStatusBadge } from './SiteBits'
import { SiteDetailsForm } from './SiteDetailsForm'
import { SiteOverviewTab } from './SiteOverviewTab'
import { SitePeople } from './SitePeople'
import { dateText, scheduleText } from './siteDisplay'
import { siteProgress } from './siteHelpers'
import { siteTab, siteTabSearch, siteSectionUrl, type SiteTab } from './siteNavigation'
import { getSite, listSiteAccess, siteErrorKind, type Site } from './sitesApi'
import '../../components/filter/filter-tabs.css'
import './sites.css'

/** One site: its details (editable with MANAGE_PROJECT), budget (finance roles), progress, people, plans and its phases. */
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
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const tab = siteTab(searchParams)
  function setTab(next: SiteTab) {
    setSearchParams(siteTabSearch(searchParams, next))
  }
  let anchor = ''
  try { anchor = decodeURIComponent(location.hash.slice(1)) } catch { /* Ignore malformed anchors. */ }

  // Jump to a linked section once per arrival, not again when the site reloads after a save.
  const jumpedTo = useRef('')
  const hasSite = site.data !== undefined
  useEffect(() => {
    if (tab !== 'details' || !hasSite || !['site-team', 'site-budget'].includes(anchor)) return
    if (jumpedTo.current === location.key) return
    jumpedTo.current = location.key
    const section = document.getElementById(anchor)
    section?.focus()
    section?.scrollIntoView({ block: 'start' })
  }, [tab, anchor, hasSite, location.key])

  const myMembershipId = access?.membershipId ?? null
  const onSite = people.data ? people.data.some((person) => person.membershipId === myMembershipId) : undefined
  const canManage = can('MANAGE_PROJECT', siteId, { onSite })
  const canViewPlans = can('VIEW_PLAN') ?? false
  const siteName = site.data?.name

  useEffect(() => {
    document.title = `${siteName ?? t.title} | Construx`
  }, [siteName, t.title])

  if (!site.data) {
    return (
      <div className="page">
        <BackLink to="/sites">{t.detail.back}</BackLink>
        {site.status === 'error' ? (
          <Notice tone="error" action={{ label: t.load.retry, onClick: site.reload }}>
            {loadMessage(t.load, siteErrorKind(site.error))}
          </Notice>
        ) : (
          <SiteDetailSkeleton />
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
      <BackLink to="/sites">{t.detail.back}</BackLink>

      <header className="site-sheet">
        <div className="page-header">
          <div className="page-header__text">
            <div className="site-sheet__status">
              <SiteStatusBadge status={current.status} labels={t.status} />
            </div>
            <h1>{current.name}</h1>
            <p>{current.address || t.noAddress}</p>
          </div>
          {tab !== 'list' && can('VIEW_GOAL', current.id, { onSite }) ? (
            <Link className="button button--primary" to={siteSectionUrl(current.id, 'list')}>
              {t.overview.viewPhases}
            </Link>
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
        <SiteAttendanceBar organizationId={organization.id} siteId={current.id} />
      </header>

      {savedNotice ? <Notice tone="success">{savedNotice}</Notice> : null}

      <nav className="filter-tabs" aria-label={t.detail.tabs.overview}>
        <button type="button" className="filter-tabs__tab" onClick={() => setTab('overview')} aria-pressed={tab === 'overview'}>
          {t.detail.tabs.overview}
        </button>
        <button type="button" className="filter-tabs__tab" onClick={() => setTab('details')} aria-pressed={tab === 'details'}>
          {t.detail.tabs.details}
        </button>
        <button type="button" className="filter-tabs__tab" onClick={() => setTab('list')} aria-pressed={tab === 'list'}>
          {t.detail.tabs.list}
        </button>
        <button type="button" className="filter-tabs__tab" onClick={() => setTab('gantt')} aria-pressed={tab === 'gantt'}>
          {t.detail.tabs.gantt}
        </button>
        {canViewPlans ? (
          <button type="button" className="filter-tabs__tab" onClick={() => setTab('plans')} aria-pressed={tab === 'plans'}>
            {t.detail.tabs.plans}
          </button>
        ) : null}
        <button type="button" className="filter-tabs__tab" onClick={() => setTab('reports')} aria-pressed={tab === 'reports'}>
          {m.reports.title}
        </button>
      </nav>

      {tab === 'overview' ? (
        <SiteOverviewTab
          organizationId={organization.id}
          site={current}
          people={people}
          myMembershipId={myMembershipId}
          canManageTeam={canManage}
          canManageBudget={can('MANAGE_BUDGET')}
          canViewBudget={can('VIEW_BUDGET')}
          canViewGoals={can('VIEW_GOAL', current.id, { onSite }) ?? false}
        />
      ) : tab === 'details' ? (
        <>
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

            <div id="site-team" className="site-section-target" tabIndex={-1}>
              <SitePeople
                organizationId={organization.id}
                siteId={current.id}
                people={people}
                canManage={canManage}
                myMembershipId={myMembershipId}
              />
            </div>
          </div>

          {can('VIEW_BUDGET') ? (
            <div id="site-budget" className="site-section-target" tabIndex={-1}>
              <SiteBudget
                organizationId={organization.id}
                site={current}
                canManage={can('MANAGE_BUDGET')}
                onSaved={saved}
                onNotice={setSavedNotice}
              />
            </div>
          ) : null}
          {canManage && current.status !== 'ARCHIVED' ? (
            <section className="page-section site-secondary-actions" aria-label={t.detail.archive}>
              <button type="button" className="button button--danger" onClick={() => setArchiveOpen(true)}>
                {t.detail.archive}
              </button>
            </section>
          ) : null}
        </>
      ) : tab === 'plans' ? (
        canViewPlans ? <SiteFloorPlans siteId={current.id} /> : <Notice tone="error">{m.workspace.forbidden}</Notice>
      ) : tab === 'reports' ? (
        <SiteReportsSection organizationId={organization.id} siteId={current.id} canGenerate={canManage} />
      ) : !can('VIEW_GOAL', current.id, { onSite }) ? (
        <Notice tone="error">{m.phasesPage.forbidden}</Notice>
      ) : tab === 'list' ? (
        <SitePhases
          organizationId={organization.id}
          siteId={current.id}
          people={people.data}
          onSite={onSite}
          targetPhase={anchor.startsWith('phase-') ? anchor : undefined}
          onProgressChanged={site.reload}
        />
      ) : (
        <PhaseSchedule organizationId={organization.id} site={current} people={people} onSite={onSite} />
      )}

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
