import { useState } from 'react'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { Notice } from '../../components/page'
import { useLocale, type Messages } from '../../i18n'
import { localToday } from '../materials/priceRules'
import { siteErrorKind, type SiteErrorKind } from '../sites/sitesApi'
import { buildExpenseDraft, buildExpensePatch, expenseToValues, makeExpenseSchema } from './expenseForm'
import { createExpense, expenseCategories, updateExpense, type Expense } from './financeApi'

type ExpenseDialogProps = {
  organizationId: string
  siteId: string
  /** Edit this expense; without it the dialog adds a new one. */
  expense?: Expense
  onSaved: () => void
  onClose: () => void
}

function expenseFields(t: Messages['finance']): FieldConfig[] {
  return [
    { name: 'description', label: t.field.description, placeholder: t.field.descriptionPlaceholder, autoComplete: 'off' },
    { name: 'amount', label: t.field.amount, placeholder: t.field.amountPlaceholder, inputMode: 'decimal', autoComplete: 'off' },
    { name: 'spentOn', label: t.field.spentOn, type: 'date' },
    {
      name: 'category',
      label: t.field.category,
      type: 'select',
      options: [
        { value: '', label: t.field.categoryPlaceholder },
        ...expenseCategories.map((category) => ({ value: category, label: t.category[category] })),
      ],
    },
  ]
}

/** Add or edit an expense; on edit only changed fields are sent. */
export function ExpenseDialog({ organizationId, siteId, expense, onSaved, onClose }: ExpenseDialogProps) {
  const { messages: m } = useLocale()
  const t = m.finance
  const [errorKind, setErrorKind] = useState<SiteErrorKind>('generic')
  const [unchanged, setUnchanged] = useState(false)

  const form = useForm({
    initialValues: expense
      ? expenseToValues(expense)
      : { description: '', amount: '', spentOn: localToday(), category: '' },
    schema: makeExpenseSchema(t.validation),
    onSubmit: async (values) => {
      try {
        if (expense) {
          const patch = buildExpensePatch(expense, values)
          if (Object.keys(patch).length === 0) {
            setUnchanged(true)
            return
          }
          await updateExpense(organizationId, siteId, expense.id, patch)
        } else {
          await createExpense(organizationId, siteId, buildExpenseDraft(values))
        }
        onSaved()
      } catch (error) {
        setErrorKind(siteErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['description', 'amount', 'spentOn', 'category'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  return (
    <Modal title={expense ? t.dialog.editTitle : t.dialog.createTitle} description={t.dialog.description} onClose={onClose}>
      <Form
        controller={{
          ...form,
          onChange: (name, value) => {
            setUnchanged(false)
            form.onChange(name, value)
          },
        }}
        fields={expenseFields(t)}
        submitLabel={t.dialog.save}
        pendingLabel={t.dialog.saving}
      >
        {form.submitError ? (
          <p className="form-error" role="alert">
            {t.error[errorKind]}
          </p>
        ) : unchanged ? (
          <Notice>{t.dialog.noChanges}</Notice>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={form.isSubmitting}>
          {t.dialog.cancel}
        </button>
      </div>
    </Modal>
  )
}
