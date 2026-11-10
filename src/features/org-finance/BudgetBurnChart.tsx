import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { SkeletonList, Notice } from '../../components/page'
import '../../components/switcher/segmented-switch.css'
import { formatMessage, useLocale } from '../../i18n'
import { getMonthlyExpenses } from './orgFinanceApi'
import { burnChartLayout, financePeriod, financeRanges, type FinanceRange } from './orgFinanceCharts'
import { monthLongText, monthShortText } from './orgFinanceFormat'
import { useCurrency } from '../../currency'

type BudgetBurnChartProps = { organizationId: string }

/** Percent string for inline geometry, rounded to keep the DOM small. */
function pct(share: number): string {
  return `${Math.round(share * 10000) / 100}%`
}

/**
 * Monthly spend as bars, its running total as a line and the company budget as a flat ceiling,
 * for the last 3 or 6 months or the year in progress (default). A visually hidden table carries
 * the same numbers for screen readers.
 */
export function BudgetBurnChart({ organizationId }: BudgetBurnChartProps) {
  const { messages: m, locale } = useLocale()
  const { money } = useCurrency()
  const t = m.orgFinance.burn
  const [range, setRange] = useState<FinanceRange>('1Y')
  const monthly = useRemoteData(`${organizationId}:finance-monthly:${range}`, () =>
    getMonthlyExpenses(organizationId, financePeriod(range, new Date())),
  )

  const layout = monthly.data ? burnChartLayout(monthly.data.months, monthly.data.totalBudget) : null
  const hasSpend = layout?.points.some((point) => point.spent > 0) ?? false
  const count = layout?.points.length ?? 0
  const linePoints = layout?.points
    .map((point, index) => `${((index + 0.5) / count) * 100},${100 - point.line * 100}`)
    .join(' ')

  return (
    <section className="page-section org-panel org-burn" aria-labelledby="org-burn-heading">
      <div className="page-section__header">
        <div>
          <h2 id="org-burn-heading">{t.title}</h2>
          <p>{t.description}</p>
        </div>
        <div className="segmented-switch" role="group" aria-label={t.rangeLabel}>
          {financeRanges.map((option) => (
            <button
              key={option}
              type="button"
              className={option === range ? 'is-active' : undefined}
              aria-pressed={option === range}
              aria-label={t.rangeName[option]}
              title={t.rangeName[option]}
              onClick={() => setRange(option)}
            >
              {t.range[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="org-burn__body">
        {monthly.status === 'error' ? (
          <Notice tone="error" action={{ label: m.orgFinance.retry, onClick: monthly.reload }}>
            {t.loadError}
          </Notice>
        ) : !layout || !monthly.data ? (
          <SkeletonList />
        ) : !hasSpend ? (
          <p className="org-finance__empty">{t.empty}</p>
        ) : (
          <>
            <ul className="org-burn__legend">
              <li>
                <span className="org-burn__key org-burn__key--bar" aria-hidden="true" />
                {t.monthly}
              </li>
              <li>
                <span className="org-burn__key org-burn__key--line" aria-hidden="true" />
                {t.cumulative}
              </li>
              {layout.ceiling !== null ? (
                <li>
                  <span className="org-burn__key org-burn__key--ceiling" aria-hidden="true" />
                  {formatMessage(t.ceilingValue, { amount: money(monthly.data.totalBudget) })}
                </li>
              ) : null}
            </ul>

            <div
              className="org-burn__plot"
              role="img"
              aria-label={formatMessage(t.chartLabel, { period: t.rangeName[range] })}
            >
              {layout.ceiling !== null ? (
                <div className="org-burn__ceiling" style={{ bottom: pct(layout.ceiling) }} aria-hidden="true" />
              ) : null}
              <svg className="org-burn__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={linePoints} vectorEffect="non-scaling-stroke" />
              </svg>
              <ol className="org-burn__bars" aria-hidden="true">
                {layout.points.map((point) => (
                  <li key={point.month} className="org-burn__column">
                    <span className="org-burn__tip data-mono">
                      {monthLongText(point.month, locale)}
                      <br />
                      {formatMessage(t.tipLine, { label: t.monthly, amount: money(point.spent) })}
                      <br />
                      {formatMessage(t.tipLine, { label: t.cumulative, amount: money(point.cumulative) })}
                    </span>
                    <span
                      className="org-burn__bar"
                      data-over={layout.ceiling !== null && point.line > layout.ceiling ? 'true' : undefined}
                      style={{ height: pct(point.bar) }}
                    />
                  </li>
                ))}
              </ol>
            </div>
            <ol className="org-burn__axis" aria-hidden="true">
              {layout.points.map((point) => (
                <li key={point.month}>{monthShortText(point.month, locale)}</li>
              ))}
            </ol>

            {layout.overBudgetFrom ? (
              <p className="org-burn__overrun">
                {formatMessage(t.overrunFrom, { month: monthLongText(layout.overBudgetFrom, locale) })}
              </p>
            ) : null}

            <table className="visually-hidden">
              <caption>{t.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.column.month}</th>
                  <th scope="col">{t.column.spent}</th>
                  <th scope="col">{t.column.cumulative}</th>
                </tr>
              </thead>
              <tbody>
                {layout.points.map((point) => (
                  <tr key={point.month}>
                    <th scope="row">{monthLongText(point.month, locale)}</th>
                    <td>{money(point.spent)}</td>
                    <td>{money(point.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  )
}
