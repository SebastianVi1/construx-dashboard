import { formatMessage, useLocale } from '../../i18n'
import type { OrgFinanceSummary } from './orgFinanceApi'
import { percentText } from './orgFinanceFormat'
import { useCurrency } from '../../currency'

type OrgFinanceKPIRowProps = { summary: OrgFinanceSummary }

/**
 * The four company totals in one band. The balance turns into a labelled overrun when it goes
 * negative, so the state never rests on color alone. Without any site budget, the budget-based
 * figures read as missing data rather than a fabricated zero.
 */
export function OrgFinanceKPIRow({ summary }: OrgFinanceKPIRowProps) {
  const { messages: m, locale } = useLocale()
  const { money } = useCurrency()
  const t = m.orgFinance.kpi
  const withBudget = summary.sites.filter((site) => site.allocatedBudget !== null).length
  const hasBudget = withBudget > 0
  const overrun = summary.totalRemaining < 0

  return (
    <dl className="org-kpis" aria-label={t.label}>
      <div className="org-kpis__item">
        <dt>{t.budget}</dt>
        <dd className="org-kpis__value data-mono">{hasBudget ? money(summary.totalBudget) : m.orgFinance.noValue}</dd>
        <dd className="org-kpis__hint">
          {hasBudget ? formatMessage(t.budgetHint, { count: withBudget, total: summary.sites.length }) : t.noBudget}
        </dd>
      </div>
      <div className="org-kpis__item">
        <dt>{t.spent}</dt>
        <dd className="org-kpis__value data-mono">{money(summary.totalSpent)}</dd>
        <dd className="org-kpis__hint">{t.spentHint}</dd>
      </div>
      <div className="org-kpis__item" data-tone={overrun ? 'danger' : undefined}>
        <dt>{t.balance}</dt>
        <dd className="org-kpis__value data-mono">
          {hasBudget ? money(summary.totalRemaining) : m.orgFinance.noValue}
        </dd>
        <dd className="org-kpis__hint">{hasBudget ? (overrun ? t.balanceOverrun : t.balanceLeft) : t.noBudget}</dd>
      </div>
      <div className="org-kpis__item">
        <dt>{t.execution}</dt>
        <dd className="org-kpis__value data-mono">
          {summary.executionPct === null ? m.orgFinance.noValue : percentText(summary.executionPct, locale, m)}
        </dd>
        <dd className="org-kpis__hint">{summary.executionPct === null ? t.noBudget : t.executionHint}</dd>
      </div>
    </dl>
  )
}
