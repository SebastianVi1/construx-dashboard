import { Link, useNavigate } from 'react-router'
import { formatMessage, useLocale } from '../../i18n'
import { budgetText } from '../sites/budgetRules'
import type { SiteFinance, SiteFinanceStatus } from './orgFinanceApi'
import { percentText } from './orgFinanceFormat'

const statusTone: Record<SiteFinanceStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  OK: 'success',
  NEAR_LIMIT: 'warning',
  OVER_BUDGET: 'danger',
  NO_BUDGET: 'muted',
}

/** Where a row leads: the site's budget (details tab holds SiteBudget). */
function siteBudgetPath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}?tab=details`
}

type SiteFinanceTableProps = { sites: SiteFinance[] }

/**
 * Every site with its budget health. The whole row opens the site's budget for pointer users;
 * the site name is the keyboard and screen reader route to the same place.
 */
export function SiteFinanceTable({ sites }: SiteFinanceTableProps) {
  const { messages: m, locale } = useLocale()
  const t = m.orgFinance.sites
  const navigate = useNavigate()
  const none = m.orgFinance.noValue

  if (sites.length === 0) return <p className="org-finance__empty">{t.empty}</p>

  return (
    <div className="table-scroll">
      <table className="data-table org-sites">
        <thead>
          <tr>
            <th scope="col">{t.column.site}</th>
            <th scope="col" className="cell-number">{t.column.budget}</th>
            <th scope="col" className="cell-number">{t.column.spent}</th>
            <th scope="col" className="cell-number">{t.column.remaining}</th>
            <th scope="col" className="cell-number">{t.column.usage}</th>
            <th scope="col">{t.column.status}</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.siteId} className="org-sites__row" data-status={site.status} onClick={() => navigate(siteBudgetPath(site.siteId))}>
              <th scope="row">
                <Link
                  className="table-link"
                  to={siteBudgetPath(site.siteId)}
                  aria-label={formatMessage(t.openBudget, { name: site.siteName })}
                  onClick={(event) => event.stopPropagation()}
                >
                  {site.siteName}
                </Link>
              </th>
              <td className="cell-number data-mono">
                {site.allocatedBudget === null ? none : budgetText(site.allocatedBudget, locale)}
              </td>
              <td className="cell-number data-mono">{budgetText(site.spent, locale)}</td>
              <td className="cell-number data-mono org-sites__remaining">
                {site.remaining === null ? none : budgetText(site.remaining, locale)}
              </td>
              <td className="cell-number data-mono">
                {site.executionPct === null ? none : percentText(site.executionPct, locale, m)}
              </td>
              <td>
                <span className="badge" data-tone={statusTone[site.status]}>
                  {t.status[site.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
