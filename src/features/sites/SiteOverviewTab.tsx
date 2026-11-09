import { useRemoteData } from '../../components/data/useRemoteData'
import { SkeletonList, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { getBudgetSummary } from '../finance/financeApi'
import { BudgetOverview } from './SiteBudget'
import { Link } from 'react-router'
import { roleLabel } from '../permissions'
import { siteSectionUrl } from './siteNavigation'
import { PhasesProgressCard } from './PhasesProgressCard'
import type { Site } from './sitesApi'
import type { RemoteData } from '../../components/data/useRemoteData'
import type { SiteAccess } from './sitesApi'

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

      <section className="page-section" aria-labelledby="overview-team-heading">
        <div className="page-section__header">
          <div>
            <h2 id="overview-team-heading">{t.teamTitle}</h2>
            {people.data ? <p>{formatMessage(t.teamCount, { count: people.data.length })}</p> : null}
          </div>
          <Link to={siteSectionUrl(site.id, 'details', 'site-team')}>
            {canManageTeam ? t.manageTeam : t.viewTeam}
          </Link>
        </div>
        {people.data ? (
          people.data.length ? (
            <>
              <ul className="site-team-preview">
                {people.data.slice(0, 5).map((person) => (
                  <li key={person.accessId}>
                    <span>{person.fullName || m.sites.people.unnamed}
                      {person.membershipId === myMembershipId ? <span className="person-you">{m.sites.people.you}</span> : null}
                    </span>
                    <span className="cell-muted">{roleLabel(person.role, m.roles)}</span>
                  </li>
                ))}
              </ul>
              {people.data.length > 5 ? <p className="cell-muted">{formatMessage(t.teamPreview, { shown: 5, total: people.data.length })}</p> : null}
            </>
          ) : <p>{m.sites.people.empty}</p>
        ) : people.status === 'error' ? (
          <Notice tone="error" action={{ label: m.sites.load.retry, onClick: people.reload }}>{m.sites.people.loadError}</Notice>
        ) : <SkeletonList />}
      </section>

    </div>
  )
}
