import { TaskSpendingSkeleton } from './TaskSkeletons'
import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { DeleteExpenseDialog } from '../finance/DeleteExpenseDialog'
import { ExpenseDialog } from '../finance/ExpenseDialog'
import { ExpenseTable } from '../finance/ExpenseTable'
import type { Expense } from '../finance/financeApi'
import type { MyAccess } from '../permissions/can'
import { createTaskExpense, getTaskBudget, listTaskExpenses } from './taskExpensesApi'
import { taskMoneyActions } from './taskMoney'
import type { PhaseRef, Task } from './tasksApi'
import '../finance/finance.css'
import { useCurrency } from '../../currency'

type Dialog = { kind: 'edit'; expense?: Expense } | { kind: 'delete'; expense: Expense } | null

/** Mounted only when the current caller may see task money. Allocation is deliberately read-only. */
export function TaskSpending({ at, task, access }: { at: PhaseRef; task: Task; access: MyAccess | null }) {
  const { messages: m } = useLocale()
  const { money: moneyText } = useCurrency()
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
  const allocated = budget?.allocatedBudget ?? null
  const used = budget !== undefined && allocated !== null && allocated > 0
    ? Math.round((budget.spent / allocated) * 100)
    : null

  return (
    <section className="page-section site-budget task-spending" aria-labelledby="task-spending-title">
      <div className="page-section__header">
        <div><h2 id="task-spending-title">{t.title}</h2><p>{t.description}</p></div>
        {actions.record ? <button className="button button--primary" type="button" onClick={() => setDialog({ kind: 'edit' })}>{t.record}</button> : null}
      </div>
      {actions.lead ? <p>{t.leadNote}</p> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {money.status === 'error' ? (
        <Notice tone="error" action={{ label: m.tasks.retry, onClick: money.reload }}>{t.loadError}</Notice>
      ) : !money.data || !budget ? <TaskSpendingSkeleton canManage={actions.record} /> : (
        <>
          <dl className="task-money">
            <div className="task-money__figure">
              <dt>{t.allocated}</dt>
              <dd className="data-mono">{allocated === null ? <span className="task-money__missing">{t.noBudget}</span> : moneyText(allocated)}</dd>
            </div>
            <div className="task-money__figure">
              <dt>{t.spent}</dt>
              <dd className="data-mono">{moneyText(budget.spent)}</dd>
            </div>
            <div className="task-money__figure" data-tone={overrun ? 'danger' : undefined}>
              <dt>{overrun ? t.overrun : t.remaining}</dt>
              <dd className="data-mono">{overrun ? moneyText(Math.abs(budget.remaining ?? budget.spent)) : budget.remaining === null ? '—' : moneyText(budget.remaining)}</dd>
            </div>
          </dl>
          {used !== null ? <div className="task-money__meter" data-over={overrun || undefined}>
            <div className="task-money__track" aria-hidden="true">
              <span className="task-money__fill" style={{ width: `${Math.min(used, 100)}%` }} />
            </div>
            <p className="task-money__caption">{formatMessage(t.used, { percent: used })}</p>
          </div> : null}
          {money.data.expenses.length === 0 ? <p className="task-money__empty">{t.empty}</p> : <ExpenseTable
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
