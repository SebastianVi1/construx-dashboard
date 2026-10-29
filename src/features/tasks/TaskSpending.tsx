import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { DeleteExpenseDialog } from '../finance/DeleteExpenseDialog'
import { ExpenseDialog } from '../finance/ExpenseDialog'
import { ExpenseTable } from '../finance/ExpenseTable'
import type { Expense } from '../finance/financeApi'
import type { MyAccess } from '../permissions/can'
import { budgetText } from '../sites/budgetRules'
import { createTaskExpense, getTaskBudget, listTaskExpenses } from './taskExpensesApi'
import { taskMoneyActions } from './taskMoney'
import type { PhaseRef, Task } from './tasksApi'
import '../finance/finance.css'

type Dialog = { kind: 'edit'; expense?: Expense } | { kind: 'delete'; expense: Expense } | null

/** Mounted only when the current caller may see task money. Allocation is deliberately read-only. */
export function TaskSpending({ at, task, access }: { at: PhaseRef; task: Task; access: MyAccess | null }) {
  const { messages: m, locale } = useLocale()
  const t = m.tasks.money
  const actions = taskMoneyActions(access, task)
  const key = `${at.organizationId}:${at.siteId}:${at.goalId}:${task.id}:${access?.membershipId}`
  const money = useRemoteData(actions.view ? key : null, async () => {
    const [budget, expenses] = await Promise.all([getTaskBudget(at, task.id), listTaskExpenses(at, task.id)])
    return { budget, expenses }
  })
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const canManage = (expense: Expense) => actions.manage(
    money.data?.expenses.find((item) => item.id === expense.id)?.createdByMembershipId,
  )
  function changed(message: string) {
    setDialog(null)
    setNotice(message)
    money.reload()
  }
  const budget = money.data?.budget
  const overrun = budget && (budget.remaining !== null ? budget.remaining < 0 : budget.spent > 0)

  return (
    <section className="page-section site-budget" aria-labelledby="task-spending-title">
      <div className="page-section__header">
        <div><h2 id="task-spending-title">{t.title}</h2><p>{t.description}</p></div>
        {actions.record ? <button className="button button--primary" type="button" onClick={() => setDialog({ kind: 'edit' })}>{t.record}</button> : null}
      </div>
      {actions.lead ? <p>{t.leadNote}</p> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {money.status === 'error' ? (
        <Notice tone="error" action={{ label: m.tasks.retry, onClick: money.reload }}>{t.loadError}</Notice>
      ) : !money.data || !budget ? <LoadingState label={t.loading} /> : (
        <>
          <dl className="task-detail__facts">
            <div><dt>{t.allocated}</dt><dd>{budget.allocatedBudget === null ? t.noBudget : budgetText(budget.allocatedBudget, locale)}</dd></div>
            <div><dt>{t.spent}</dt><dd>{budgetText(budget.spent, locale)}</dd></div>
            <div><dt>{overrun ? t.overrun : t.remaining}</dt><dd>{overrun ? budgetText(Math.abs(budget.remaining ?? budget.spent), locale) : budget.remaining === null ? '—' : budgetText(budget.remaining, locale)}</dd></div>
          </dl>
          {money.data.expenses.length === 0 ? <p>{t.empty}</p> : <ExpenseTable
            expenses={money.data.expenses}
            canManage={money.data.expenses.some(canManage)}
            canManageExpense={canManage}
            onEdit={(expense) => setDialog({ kind: 'edit', expense })}
            onDelete={(expense) => setDialog({ kind: 'delete', expense })}
          />}
        </>
      )}
      {dialog?.kind === 'edit' && actions.record && (!dialog.expense || canManage(dialog.expense)) ? (
        <ExpenseDialog organizationId={at.organizationId} siteId={at.siteId} expense={dialog.expense}
          create={(draft) => createTaskExpense(at, task.id, draft)}
          onSaved={() => changed(t.saved)} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'delete' && canManage(dialog.expense) ? (
        <DeleteExpenseDialog organizationId={at.organizationId} siteId={at.siteId} expense={dialog.expense}
          onDeleted={() => changed(t.deleted)} onClose={() => setDialog(null)} />
      ) : null}
    </section>
  )
}
