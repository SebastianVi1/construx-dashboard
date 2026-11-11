import { Navigate } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { SkeletonList, Notice } from '../../components/page'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { useCurrency } from '../../currency'
import { ApiError } from '../../lib/http'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { landingPath } from '../permissions/landing'
import { BudgetBurnChart } from './BudgetBurnChart'
import { OrgCategoryChart } from './OrgCategoryChart'
import { seesOrgFinance } from './orgFinanceAccess'
import { getOrgFinanceSummary } from './orgFinanceApi'
import { OrgFinanceKPIRow } from './OrgFinanceKPIRow'
import { SiteFinanceTable } from './SiteFinanceTable'
import './org-finance.css'

/**
 * `/finance`, the company landing for finance roles: totals, every site's budget health, spend
 * over time and by category. Roles without company-wide VIEW_BUDGET go to their landing screen
 * (the site list, or My tasks for a Worker).
 */
export function OrgFinancePage() {
  const { access } = usePermissions()
  if (!seesOrgFinance(access)) return <Navigate to={landingPath(access)} replace />
  return <OrgFinanceDashboard />
}

function OrgFinanceDashboard() {
  const organization = useCurrentOrganization()
  const { messages: m, locale } = useLocale()
  const { currency } = useCurrency()
  const t = m.orgFinance
  const summary = useRemoteData(`${organization.id}:finance-summary`, () => getOrgFinanceSummary(organization.id))
  const forbidden = summary.error instanceof ApiError && summary.error.status === 403
  const overBudget = summary.data?.sites.filter((site) => site.status === 'OVER_BUDGET') ?? []
  const listFormat = new Intl.ListFormat(intlLocales[locale], { type: 'conjunction' })

  return (
    <div className="page org-finance">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <p className="org-finance__scope">{formatMessage(t.currencyNote, { currency })}</p>
      </header>

      {summary.status === 'error' ? (
        forbidden ? (
          <Notice tone="error">{m.workspace.forbidden}</Notice>
        ) : (
          <Notice tone="error" action={{ label: t.retry, onClick: summary.reload }}>
            {t.loadError}
          </Notice>
        )
      ) : !summary.data ? (
        <SkeletonList />
      ) : (
        <>
          {overBudget.length > 0 ? (
            <div className="org-finance__alert" role="alert">
              <strong>{t.alert.title}</strong>
              <p>{formatMessage(t.alert.body, { sites: listFormat.format(overBudget.map((site) => site.siteName)) })}</p>
            </div>
          ) : null}

          <OrgFinanceKPIRow summary={summary.data} />

          <section className="page-section" aria-labelledby="org-sites-heading">
            <div className="page-section__header">
              <div>
                <h2 id="org-sites-heading">{t.sites.title}</h2>
                <p>{t.sites.description}</p>
              </div>
            </div>
            <SiteFinanceTable sites={summary.data.sites} />
          </section>

          <div className="org-finance__charts">
            <BudgetBurnChart organizationId={organization.id} />
            <OrgCategoryChart byCategory={summary.data.byCategory} />
          </div>
        </>
      )}
    </div>
  )
}
