import { useLocale } from '../../i18n'
import type { ExpenseCategory } from '../finance/financeApi'
import '../finance/finance.css'
import { budgetText } from '../sites/budgetRules'
import { donutSlices } from './orgFinanceCharts'
import { percentText } from './orgFinanceFormat'

type OrgCategoryChartProps = {
  byCategory: { category: ExpenseCategory; amount: number }[]
}

/** Circumference 100 so dash lengths read directly as percentages. */
const RADIUS = 15.9155

/**
 * Company spend per category as a donut. Colors come from the same `data-category` series
 * tokens as the site budget chart; the legend carries every amount and share.
 */
export function OrgCategoryChart({ byCategory }: OrgCategoryChartProps) {
  const { messages: m, locale } = useLocale()
  const t = m.orgFinance.category
  const slices = donutSlices(byCategory)
  const spent = slices.reduce((sum, slice) => sum + slice.amount, 0)

  return (
    <section className="page-section org-panel org-category" aria-labelledby="org-category-heading">
      <div className="page-section__header">
        <div>
          <h2 id="org-category-heading">{t.title}</h2>
          <p>{t.description}</p>
        </div>
      </div>

      {slices.length === 0 ? (
        <p className="org-finance__empty">{t.empty}</p>
      ) : (
        <div className="org-category__body">
          <figure className="org-category__donut">
            <svg viewBox="0 0 42 42" role="img" aria-label={t.chartLabel}>
              <circle className="org-category__track" cx="21" cy="21" r={RADIUS} />
              {slices.map((slice) => (
                <circle
                  key={slice.category}
                  className="org-category__slice"
                  data-category={slice.category}
                  cx="21"
                  cy="21"
                  r={RADIUS}
                  strokeDasharray={`${slice.share * 100} ${100 - slice.share * 100}`}
                  strokeDashoffset={25 - slice.offset * 100}
                />
              ))}
            </svg>
            <figcaption className="org-category__center">
              <span>{t.total}</span>
              <strong className="data-mono">{budgetText(spent, locale)}</strong>
            </figcaption>
          </figure>
          <ul className="org-category__legend">
            {slices.map((slice) => (
              <li key={slice.category}>
                <span className="budget-chart__swatch" data-category={slice.category} aria-hidden="true" />
                <span className="org-category__name">{m.finance.category[slice.category]}</span>
                <span className="data-mono">{budgetText(slice.amount, locale)}</span>
                <span className="org-category__share data-mono">{percentText(slice.share * 100, locale, m)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
