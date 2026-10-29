import { formatMessage, useLocale } from '../../i18n'
import { budgetText } from '../sites/budgetRules'
import { dateText } from '../sites/siteDisplay'
import type { Expense } from './financeApi'

type ExpenseTableProps = {
  expenses: Expense[]
  canManage: boolean
  canManageExpense?: (expense: Expense) => boolean
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
}

/** The site's expenses, newest first; also the text equivalent of the chart. */
export function ExpenseTable({ expenses, canManage, canManageExpense, onEdit, onDelete }: ExpenseTableProps) {
  const { messages: m, locale } = useLocale()
  const t = m.finance

  return (
    <div className="table-scroll">
      <table className="data-table data-table--compact expense-table">
        <thead>
          <tr>
            <th scope="col">{t.column.date}</th>
            <th scope="col">{t.column.description}</th>
            <th scope="col">{t.column.category}</th>
            <th scope="col" className="expense-table__amount">
              {t.column.amount}
            </th>
            {canManage ? (
              <th scope="col" className="cell-actions">
                <span className="visually-hidden">{t.column.actions}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td className="data-mono cell-muted">{dateText(expense.spentOn, locale)}</td>
              <td>{expense.description}</td>
              <td>
                <span className="expense-category">
                  <span className="budget-chart__swatch" data-category={expense.category} aria-hidden="true" />
                  {t.category[expense.category]}
                </span>
              </td>
              <td className="data-mono expense-table__amount">{budgetText(expense.amount, locale)}</td>
              {canManage ? (
                <td className="cell-actions">
                  {(!canManageExpense || canManageExpense(expense)) ? <div className="button-row button-row--end">
                    <button
                      type="button"
                      className="button button--small"
                      aria-label={formatMessage(t.editLabel, { description: expense.description })}
                      onClick={() => onEdit(expense)}
                    >
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      className="button button--small button--danger"
                      aria-label={formatMessage(t.deleteLabel, { description: expense.description })}
                      onClick={() => onDelete(expense)}
                    >
                      {t.delete}
                    </button>
                  </div> : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
