import { useState } from 'react'
import { Modal } from '../../components/modal'
import { formatMessage, useLocale } from '../../i18n'
import { budgetText } from '../sites/budgetRules'
import { siteErrorKind, type SiteErrorKind } from '../sites/sitesApi'
import { deleteExpense, type Expense } from './financeApi'

type DeleteExpenseDialogProps = {
  organizationId: string
  siteId: string
  expense: Expense
  onDeleted: () => void
  onClose: () => void
}

export function DeleteExpenseDialog({ organizationId, siteId, expense, onDeleted, onClose }: DeleteExpenseDialogProps) {
  const { messages: m, locale } = useLocale()
  const t = m.finance
  const [busy, setBusy] = useState(false)
  const [errorKind, setErrorKind] = useState<SiteErrorKind | null>(null)

  async function remove() {
    if (busy) return
    setBusy(true)
    setErrorKind(null)
    try {
      await deleteExpense(organizationId, siteId, expense.id)
      onDeleted()
    } catch (error) {
      setErrorKind(siteErrorKind(error))
      setBusy(false)
    }
  }

  const body = formatMessage(t.deleteDialog.body, {
    description: expense.description,
    amount: budgetText(expense.amount, locale),
  })

  return (
    <Modal title={t.deleteDialog.title} description={body} onClose={onClose}>
      {errorKind ? (
        <p className="form-error" role="alert">
          {t.error[errorKind]}
        </p>
      ) : null}
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {t.deleteDialog.cancel}
        </button>
        <button type="button" className="button button--danger" onClick={() => void remove()} disabled={busy}>
          {busy ? t.deleteDialog.deleting : t.deleteDialog.confirm}
        </button>
      </div>
    </Modal>
  )
}
