import { Link } from 'react-router'
import { useRemoteData, type RemoteData } from '../../components/data/useRemoteData'
import { SkeletonList, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { getBudgetSummary } from '../finance/financeApi'
import { roleLabel } from '../permissions'
import { Avatar } from '../profile/Avatar'
import { PhasesProgressCard } from './PhasesProgressCard'
import { BudgetOverview } from './SiteBudget'
import { siteSectionUrl } from './siteNavigation'
import type { Site, SiteAccess } from './sitesApi'
import { teamPreview } from './teamPreview'
import '../profile/profile.css'

/** People shown before the roster collapses into a "+N more" link to the full team. */
const ROSTER_LIMIT = 8

type Props = {
  organizationId: string
  site: Site
  people: RemoteData<SiteAccess[]>
  myMembershipId: string | null
  canManageTeam: boolean
  canManageBudget: boolean
  canViewBudget: boolean
  canViewGoals: boolean
}

export function SiteOverviewTab({
  organizationId,
  site,
  people,
  myMembershipId,
  canManageTeam,
  canManageBudget,
  canViewBudget,
  canViewGoals,
}: Props) {
  const { messages: m } = useLocale()
  const t = m.sites.overview
  const budgetKey = canViewBudget ? `${organizationId}:${site.id}:budget-overview` : null
  const budget = useRemoteData(budgetKey, () => getBudgetSummary(organizationId, site.id))
  const teamUrl = siteSectionUrl(site.id, 'details', 'site-team')

  return (
    <div className="site-overview">
      {canViewBudget ? (
        <section className="page-section" aria-labelledby="overview-budget-heading">
          <div className="page-section__header">
            <h2 id="overview-budget-heading">{t.budgetTitle}</h2>
            <Link to={siteSectionUrl(site.id, 'details', 'site-budget')}>
              {canManageBudget ? t.manageBudget : t.viewBudget}
            </Link>
          </div>
          {budget.status === 'loading' ? (
            <SkeletonList />
          ) : budget.status === 'error' ? (
            <Notice tone="error" action={{ label: m.sites.load.retry, onClick: budget.reload }}>
              {m.finance.loadError}
            </Notice>
          ) : budget.data ? (
            <BudgetOverview summary={budget.data} />
          ) : null}
        </section>
      ) : null}

      {canViewGoals ? (
        <section className="page-section" aria-labelledby="overview-phases-heading">
          <div className="page-section__header">
            <h2 id="overview-phases-heading">{t.phasesTitle}</h2>
            <Link to={siteSectionUrl(site.id, 'list')}>{t.viewPhases}</Link>
          </div>
          <PhasesProgressCard organizationId={organizationId} siteId={site.id} />
        </section>
      ) : null}

      <section className="page-section site-team" aria-labelledby="overview-team-heading">
        <div className="page-section__header">
          <div>
            <h2 id="overview-team-heading">{t.teamTitle}</h2>
            {people.data ? <p>{formatMessage(t.teamCount, { count: people.data.length })}</p> : null}
          </div>
          <Link to={teamUrl}>{canManageTeam ? t.manageTeam : t.viewTeam}</Link>
        </div>
        {people.data ? (
          people.data.length ? (
            <TeamRoster people={people.data} myMembershipId={myMembershipId} moreUrl={teamUrl} />
          ) : (
            <div className="empty-state">
              <p>{m.sites.people.empty}</p>
            </div>
          )
        ) : people.status === 'error' ? (
          <Notice tone="error" action={{ label: m.sites.load.retry, onClick: people.reload }}>{m.sites.people.loadError}</Notice>
        ) : <SkeletonList />}
      </section>
    </div>
  )
}

/** Who is on the site at a glance: head count per role, then the people with leadership first. */
function TeamRoster({ people, myMembershipId, moreUrl }: { people: SiteAccess[]; myMembershipId: string | null; moreUrl: string }) {
  const { messages: m } = useLocale()
  const t = m.sites.overview
  // When the team overflows, the last slot becomes the "see all" tile so the grid keeps its rows.
  const limit = people.length > ROSTER_LIMIT ? ROSTER_LIMIT - 1 : ROSTER_LIMIT
  const { shown, hidden, roles } = teamPreview(people, myMembershipId, limit)

  return (
    <>
      <ul className="site-team__roles" aria-label={t.teamRoles}>
        {roles.map(({ role, count }) => (
          <li key={role.code}>
            {roleLabel(role, m.roles)}
            <span className="site-team__role-count data-mono">{count}</span>
          </li>
        ))}
      </ul>
      <ul className="site-team__roster">
        {shown.map((person) => (
          <li key={person.accessId} className="site-team__person">
            <Avatar fullName={person.fullName} email="?" decorative />
            <div className="site-team__who">
              <span className="site-team__line">
                <span className={person.fullName ? 'site-team__name' : 'site-team__name cell-muted'}>
                  {person.fullName || m.sites.people.unnamed}
                </span>
                {person.membershipId === myMembershipId ? <span className="person-you">{m.sites.people.you}</span> : null}
              </span>
              <span className="site-team__role">{roleLabel(person.role, m.roles)}</span>
            </div>
          </li>
        ))}
        {hidden > 0 ? (
          <li>
            <Link className="site-team__more" to={moreUrl}>
              <span className="site-team__more-count data-mono" aria-hidden="true">+{hidden}</span>
              <span className="site-team__more-label">{formatMessage(t.teamMore, { total: people.length })}</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </>
  )
}
