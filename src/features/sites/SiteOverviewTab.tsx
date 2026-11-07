import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { SkeletonList, Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { getBudgetSummary } from '../finance/financeApi'
import { BudgetOverview } from './SiteBudget'
import { SitePeople } from './SitePeople'
import { PhasesProgressCard } from './PhasesProgressCard'
import type { Site } from './sitesApi'
import type { RemoteData } from '../../components/data/useRemoteData'
import type { SiteAccess } from './sitesApi'

type Props = {
  organizationId: string
  site: Site
  people: RemoteData<SiteAccess[]>
  myMembershipId: string | null
  canViewBudget: boolean
  canViewGoals: boolean
  canViewPlans: boolean
}

export function SiteOverviewTab({
  organizationId,
  site,
  people,
  myMembershipId,
  canViewBudget,
  canViewGoals,
  canViewPlans,
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
          </div>
          <PhasesProgressCard organizationId={organizationId} siteId={site.id} />
        </section>
      ) : null}

      {canViewPlans ? (
        <section className="page-section" aria-labelledby="overview-plans-heading">
          <div className="page-section__header">
            <h2 id="overview-plans-heading">{m.sites.detail.plans}</h2>
          </div>
          <div className="button-row">
            <Link className="button" to={`/sites/${encodeURIComponent(site.id)}/plans`}>
              {m.sites.detail.plans}
            </Link>
            <Link className="button" to={`/sites/${encodeURIComponent(site.id)}/floor-plans`}>
              {m.sites.detail.floorPlans}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="page-section" aria-labelledby="overview-team-heading">
        <div className="page-section__header">
          <h2 id="overview-team-heading">{t.teamTitle}</h2>
        </div>
        <SitePeople
          organizationId={organizationId}
          siteId={site.id}
          people={people}
          canManage={false}
          myMembershipId={myMembershipId}
        />
      </section>

    </div>
  )
}
