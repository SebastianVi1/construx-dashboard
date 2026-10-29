import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { BudgetAmountDialog } from '../finance/BudgetAmountDialog'
import { BudgetChart } from '../finance/BudgetChart'
import { budgetChart } from '../finance/budgetLayout'
import { DeleteExpenseDialog } from '../finance/DeleteExpenseDialog'
import { ExpenseDialog } from '../finance/ExpenseDialog'
import { ExpenseTable } from '../finance/ExpenseTable'
import { getBudgetSummary, listExpenses, type BudgetSummary, type Expense } from '../finance/financeApi'
import '../finance/finance.css'
import { allocationIssue, budgetText } from './budgetRules'
import { setSiteBudget, siteErrorKind, type Site } from './sitesApi'

type SiteBudgetProps = {
  organizationId: string
  site: Site
  /** MANAGE_BUDGET: budget and expense actions. Render this section only with VIEW_BUDGET. */
  canManage: boolean
  onSaved: (site: Site, notice: string) => void
  onNotice: (notice: string) => void
}

type Dialog = { kind: 'budget' } | { kind: 'expense'; expense?: Expense } | { kind: 'delete'; expense: Expense } | null

/** The site's budget: what was assigned, spent and is left, a quick chart, and the expenses behind it. */
export function SiteBudget({ organizationId, site, canManage, onSaved, onNotice }: SiteBudgetProps) {
  const { messages: m } = useLocale()
  const t = m.finance
  const key = `${organizationId}:${site.id}`
  const summary = useRemoteData(`${key}:budget`, () => getBudgetSummary(organizationId, site.id))
  const expenses = useRemoteData(`${key}:expenses`, () => listExpenses(organizationId, site.id))
  const [dialog, setDialog] = useState<Dialog>(null)

  function changed(notice: string) {
    setDialog(null)
    summary.reload()
    expenses.reload()
    onNotice(notice)
  }

  const failed = summary.status === 'error' || expenses.status === 'error'
  const budget = summary.data?.allocatedBudget ?? site.allocatedBudget

  return (
    <section className="page-section site-budget" aria-labelledby="site-budget-heading">
      <div className="page-section__header">
        <div>
          <h2 id="site-budget-heading">{t.title}</h2>
          <p>{t.currencyNote}</p>
        </div>
        {canManage ? (
          <div className="button-row">
            <button type="button" className="button" onClick={() => setDialog({ kind: 'budget' })}>
              {budget === null ? m.sites.budget.set : m.sites.budget.edit}
            </button>
            <button type="button" className="button button--primary" onClick={() => setDialog({ kind: 'expense' })}>
              {t.addExpense}
            </button>
          </div>
        ) : null}
      </div>

      {failed ? (
        <Notice
          tone="error"
          action={{
            label: t.retry,
            onClick: () => {
              summary.reload()
              expenses.reload()
            },
          }}
        >
          {t.loadError}
        </Notice>
      ) : !summary.data || !expenses.data ? (
        <LoadingState label={t.loading} />
      ) : (
        <>
          <BudgetOverview summary={summary.data} />
          <div className="site-budget__expenses">
            <h3>{t.expenses}</h3>
            {expenses.data.length === 0 ? (
              <p className="site-budget__empty">{t.noExpenses}</p>
            ) : (
              <ExpenseTable
                expenses={expenses.data}
                canManage={canManage}
                onEdit={(expense) => setDialog({ kind: 'expense', expense })}
                onDelete={(expense) => setDialog({ kind: 'delete', expense })}
              />
            )}
          </div>
        </>
      )}

      {dialog?.kind === 'budget' ? (
        <BudgetAmountDialog
          title={m.sites.budget.dialogTitle}
          description={m.sites.budget.dialogBody}
          current={budget}
          save={async (amount) => {
            const updated = await setSiteBudget(organizationId, site.id, amount)
            setDialog(null)
            summary.reload()
            onSaved(updated, amount === null ? m.sites.budget.removed : m.sites.budget.saved)
          }}
          errorMessage={(error) => m.sites.budget.error[allocationIssue(error) ?? siteErrorKind(error)]}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'expense' ? (
        <ExpenseDialog
          organizationId={organizationId}
          siteId={site.id}
          expense={dialog.expense}
          onClose={() => setDialog(null)}
          onSaved={() => changed(t.saved)}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <DeleteExpenseDialog
          organizationId={organizationId}
          siteId={site.id}
          expense={dialog.expense}
          onClose={() => setDialog(null)}
          onDeleted={() => changed(t.deleted)}
        />
      ) : null}
    </section>
  )
}

/** Figures on the left, the chart beside them; they stack on narrow screens. */
function BudgetOverview({ summary }: { summary: BudgetSummary }) {
  const { messages: m, locale } = useLocale()
  const t = m.finance
  const chart = budgetChart(summary)
  const overrun = chart.status === 'overrun'
  const percent = chart.usedOfBudget === null ? null : Math.round(chart.usedOfBudget * 100)

  return (
    <div className="budget-overview">
      <div className="budget-figures">
        <dl>
          <div>
            <dt>{t.allocated}</dt>
            <dd className="budget-figures__value">
              {summary.allocatedBudget === null ? t.noBudget : budgetText(summary.allocatedBudget, locale)}
            </dd>
          </div>
          <div>
            <dt>{t.spent}</dt>
            <dd className="budget-figures__value">{budgetText(summary.spent, locale)}</dd>
          </div>
          {summary.allocatedBudget !== null ? (
            <>
              <div>
                <dt>{t.allocatedToPhases}</dt>
                <dd className="budget-figures__value">{budgetText(summary.allocatedToPhases, locale)}</dd>
              </div>
              <div>
                <dt>{t.unallocated}</dt>
                <dd className="budget-figures__value">{budgetText(summary.unallocated ?? 0, locale)}</dd>
              </div>
            </>
          ) : null}
          <div data-status={chart.status}>
            <dt>{overrun ? t.overrun : t.remaining}</dt>
            <dd className="budget-figures__value budget-figures__value--lead">
              {summary.remaining === null ? '—' : budgetText(Math.abs(summary.remaining), locale)}
            </dd>
          </div>
        </dl>
        <p className="budget-figures__note">
          {percent === null
            ? summary.allocatedBudget === null
              ? t.noBudgetHint
              : null
            : formatMessage(t.used, { percent })}
        </p>
      </div>
      <BudgetChart chart={chart} summary={summary} />
    </div>
  )
}
