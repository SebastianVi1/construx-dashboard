import { useState } from 'react'
import { Form, TEXT_LIMITS, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { Notice } from '../../components/page'
import { useCurrency, type Currency } from '../../currency'
import { formatMessage, useLocale, type Messages } from '../../i18n'
import { localToday } from '../materials/priceRules'
import { siteErrorKind, type SiteErrorKind } from '../sites/sitesApi'
import { buildExpenseDraft, buildExpensePatch, expenseToValues, makeExpenseSchema } from './expenseForm'
import { createExpense, expenseCategories, updateExpense, type Expense, type ExpenseDraft } from './financeApi'

type ExpenseDialogProps = {
  organizationId: string
  siteId: string
  /** Edit this expense; without it the dialog adds a new one. */
  expense?: Expense
  create?: (draft: ExpenseDraft) => Promise<Expense>
  onSaved: () => void
  onClose: () => void
}

function expenseFields(t: Messages['finance'], currency: Currency): FieldConfig[] {
  return [
    {
      name: 'description',
      label: t.field.description,
      placeholder: t.field.descriptionPlaceholder,
      autoComplete: 'off',
      maxLength: TEXT_LIMITS.expenseDescription,
    },
    { name: 'amount', label: formatMessage(t.field.amount, { currency }), type: 'money', placeholder: t.field.amountPlaceholder },
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
export function ExpenseDialog({ organizationId, siteId, expense, create, onSaved, onClose }: ExpenseDialogProps) {
  const { messages: m } = useLocale()
  const t = m.finance
  const money = useCurrency()
  const [errorKind, setErrorKind] = useState<SiteErrorKind>('generic')
  const [unchanged, setUnchanged] = useState(false)

  const form = useForm({
    initialValues: expense
      ? expenseToValues(expense, money)
      : { description: '', amount: '', spentOn: localToday(), category: '' },
    schema: makeExpenseSchema(t.validation, money),
    onSubmit: async (values) => {
      try {
        if (expense) {
          const patch = buildExpensePatch(expense, values, money)
          if (Object.keys(patch).length === 0) {
            setUnchanged(true)
            return
          }
          await updateExpense(organizationId, siteId, expense.id, patch)
        } else {
          const draft = buildExpenseDraft(values, money)
          await (create ? create(draft) : createExpense(organizationId, siteId, draft))
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
        fields={expenseFields(t, money.currency)}
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
