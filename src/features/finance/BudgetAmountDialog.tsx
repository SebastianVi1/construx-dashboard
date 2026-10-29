import { useState } from 'react'
import { Form, useForm } from '../../components/form'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { budgetAmount, budgetToInput, makeBudgetSchema } from '../sites/budgetRules'

type BudgetAmountDialogProps = {
  title: string
  description: string
  /** The stored budget; null shows no remove action. */
  current: number | null
  /** Saves the amount, or removes the budget with null. Rejects to keep the dialog open with `errorMessage`. */
  save: (amount: number | null) => Promise<void>
  errorMessage: (error: unknown) => string
  onClose: () => void
}

/** One amount field plus save and remove, shared by the site, phase and task budgets. */
export function BudgetAmountDialog({ title, description, current, save, errorMessage, onClose }: BudgetAmountDialogProps) {
  const { messages: m } = useLocale()
  const t = m.sites.budget
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const form = useForm({
    initialValues: { amount: budgetToInput(current) },
    schema: makeBudgetSchema(t.validation),
    onSubmit: async (values) => {
      setError(null)
      try {
        await save(budgetAmount(values.amount))
      } catch (failure) {
        setError(errorMessage(failure))
        throw failure
      }
    },
    onInvalid: () => document.getElementById('field-amount')?.focus(),
  })

  async function remove() {
    if (removing) return
    setRemoving(true)
    setError(null)
    try {
      await save(null)
    } catch (failure) {
      setError(errorMessage(failure))
      setRemoving(false)
    }
  }

  const busy = removing || form.isSubmitting

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <Form
        controller={form}
        fields={[{ name: 'amount', label: t.amount, placeholder: t.amountPlaceholder, inputMode: 'decimal', autoComplete: 'off' }]}
        submitLabel={t.save}
        pendingLabel={t.saving}
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        {current !== null ? (
          <button type="button" className="button button--danger" onClick={() => void remove()} disabled={busy}>
            {removing ? t.removing : t.remove}
          </button>
        ) : null}
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {t.cancel}
        </button>
      </div>
    </Modal>
  )
}
