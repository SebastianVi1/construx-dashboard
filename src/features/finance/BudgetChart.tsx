import { useState } from 'react'
import { formatMessage, useLocale } from '../../i18n'
import { budgetText } from '../sites/budgetRules'
import type { BudgetChart as Chart } from './budgetLayout'
import type { BudgetSummary, ExpenseCategory } from './financeApi'

type BudgetChartProps = {
  chart: Chart
  summary: BudgetSummary
}

function percent(share: number): number {
  return Math.round(share * 100)
}

/**
 * One stacked bar: spend per category, then the remaining budget as a neutral track.
 * On an overrun a tick marks where the budget ends. The legend carries every amount,
 * so the chart never relies on color alone.
 */
export function BudgetChart({ chart, summary }: BudgetChartProps) {
  const { messages: m, locale } = useLocale()
  const t = m.finance
  const [active, setActive] = useState<ExpenseCategory | 'remaining' | null>(null)
  const spent = summary.spent
  const remaining = Math.max(summary.remaining ?? 0, 0)
  const hasBar = chart.segments.length > 0 || chart.remainingShare > 0
  const activeSegment = chart.segments.find((segment) => segment.category === active)
  // Center of each bar part as a share of the bar, so the tooltip sits over the hovered part.
  const parts = [
    ...chart.segments.map((segment) => ({ key: segment.category as string, share: segment.share })),
    { key: 'remaining', share: chart.remainingShare },
  ]
  const total = parts.reduce((sum, part) => sum + part.share, 0) || 1
  let offset = 0
  const centers: Record<string, number> = {}
  for (const part of parts) {
    centers[part.key] = (offset + part.share / 2) / total
    offset += part.share
  }
  const tooltipLeft = active ? Math.min(Math.max(centers[active] ?? 0.5, 0.12), 0.88) : 0.5
  const tooltip =
    active === 'remaining'
      ? `${t.remainingLegend} · ${budgetText(remaining, locale)}`
      : activeSegment
        ? `${t.category[activeSegment.category]} · ${budgetText(activeSegment.amount, locale)}`
        : null

  return (
    <figure className="budget-chart">
      <figcaption className="budget-chart__caption">{t.chartLabel}</figcaption>
      {hasBar ? (
        <div className="budget-chart__plot" onMouseLeave={() => setActive(null)}>
          <div
            className="budget-chart__tooltip"
            aria-hidden="true"
            data-visible={tooltip ? 'true' : 'false'}
            style={{ left: `${tooltipLeft * 100}%` }}
          >
            {tooltip}
          </div>
          <div className="budget-chart__bar" role="img" aria-label={t.chartLabel}>
            {chart.segments.map((segment) => (
              <div
                key={segment.category}
                className="budget-chart__segment"
                data-category={segment.category}
                data-dim={active && active !== segment.category ? 'true' : 'false'}
                style={{ flexGrow: segment.share }}
                onMouseEnter={() => setActive(segment.category)}
              />
            ))}
            {chart.remainingShare > 0 ? (
              <div
                className="budget-chart__segment budget-chart__segment--remaining"
                data-dim={active && active !== 'remaining' ? 'true' : 'false'}
                style={{ flexGrow: chart.remainingShare }}
                onMouseEnter={() => setActive('remaining')}
              />
            ) : null}
            {chart.budgetMarker !== null ? (
              <div className="budget-chart__marker" style={{ left: `${chart.budgetMarker * 100}%` }}>
                <span>{t.budgetEnds}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <ul className="budget-chart__legend">
        {chart.segments.map((segment) => (
          <li
            key={segment.category}
            data-active={active === segment.category ? 'true' : 'false'}
            onMouseEnter={() => setActive(segment.category)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="budget-chart__swatch" data-category={segment.category} aria-hidden="true" />
            <span className="budget-chart__name">{t.category[segment.category]}</span>
            <span className="budget-chart__value data-mono">{budgetText(segment.amount, locale)}</span>
            <span className="budget-chart__share">
              {formatMessage(t.shareOfSpend, { percent: percent(spent > 0 ? segment.amount / spent : 0) })}
            </span>
          </li>
        ))}
        {chart.remainingShare > 0 ? (
          <li
            data-active={active === 'remaining' ? 'true' : 'false'}
            onMouseEnter={() => setActive('remaining')}
            onMouseLeave={() => setActive(null)}
          >
            <span className="budget-chart__swatch budget-chart__swatch--remaining" aria-hidden="true" />
            <span className="budget-chart__name">{t.remainingLegend}</span>
            <span className="budget-chart__value data-mono">{budgetText(remaining, locale)}</span>
            <span className="budget-chart__share" />
          </li>
        ) : null}
      </ul>
    </figure>
  )
}
