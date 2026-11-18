import { useState } from 'react'
import { Form, TEXT_LIMITS, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { Notice } from '../../components/page'
import { useCurrency, type Currency } from '../../currency'
import { formatMessage, useLocale, type Messages } from '../../i18n'
import { localToday } from '../../lib/localDate'
import { getResource } from '../prices/pricesApi'
import type { CatalogLookupItem } from '../sites/catalogLookup'
import { CatalogLookupPicker } from './CatalogLookupPicker'
import {
  buildCatalogExpenseDraft,
  buildCatalogExpensePatch,
  catalogExpenseToValues,
  catalogPreview,
  expenseErrorKind,
  isFromCatalog,
  makeCatalogExpenseSchema,
  type ExpenseErrorKind,
} from './catalogExpense'
import { buildExpenseDraft, buildExpensePatch, expenseToValues, makeExpenseSchema } from './expenseForm'
import { createExpense, expenseCategories, updateExpense, type Expense, type NewExpense } from './financeApi'

type ExpenseDialogProps = {
  organizationId: string
  siteId: string
  /** Edit this expense; without it the dialog adds a new one. */
  expense?: Expense
  /** The caller may record this expense, so may also charge it from the Catalog (docs/pricing.md §6.5). */
  canUseCatalog: boolean
  /** The caller holds VIEW_PRICES: show unit costs and preview the amount. */
  seePrices: boolean
  create?: (draft: NewExpense) => Promise<Expense>
  onSaved: () => void
  onClose: () => void
}

type Mode = 'typed' | 'catalog'

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

/**
 * Add or edit an expense; on edit only changed fields are sent. A new expense is typed or picked from the Catalog;
 * an expense from the Catalog only changes its date and concept (docs/pricing.md §6.5).
 */
export function ExpenseDialog(props: ExpenseDialogProps) {
  const { messages: m } = useLocale()
  const t = m.finance
  const [mode, setMode] = useState<Mode>('typed')
  const catalog = props.expense ? isFromCatalog(props.expense) : props.canUseCatalog && mode === 'catalog'

  return (
    <Modal title={props.expense ? t.dialog.editTitle : t.dialog.createTitle} description={t.dialog.description} onClose={props.onClose}>
      {props.expense || !props.canUseCatalog ? null : (
        <div className="expense-mode" role="group" aria-label={t.catalog.mode}>
          {(['typed', 'catalog'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="expense-mode__option"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
            >
              {option === 'typed' ? t.catalog.typed : t.catalog.fromCatalog}
            </button>
          ))}
        </div>
      )}
      {catalog ? <CatalogExpenseForm key="catalog" {...props} /> : <TypedExpenseForm key="typed" {...props} />}
    </Modal>
  )
}

function SubmitFeedback({ failed, errorKind, unchanged }: { failed: boolean; errorKind: ExpenseErrorKind; unchanged: boolean }) {
  const { messages: m } = useLocale()
  const t = m.finance
  if (failed) {
    return (
      <p className="form-error" role="alert">
        {t.error[errorKind]}
      </p>
    )
  }
  return unchanged ? <Notice>{t.dialog.noChanges}</Notice> : null
}

function CancelRow({ onClose, disabled }: { onClose: () => void; disabled: boolean }) {
  const { messages: m } = useLocale()
  return (
    <div className="button-row button-row--end modal-actions">
      <button type="button" className="button" onClick={onClose} disabled={disabled}>
        {m.finance.dialog.cancel}
      </button>
    </div>
  )
}

function TypedExpenseForm({ organizationId, siteId, expense, create, onSaved, onClose }: ExpenseDialogProps) {
  const { messages: m } = useLocale()
  const t = m.finance
  const money = useCurrency()
  const [errorKind, setErrorKind] = useState<ExpenseErrorKind>('generic')
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
        setErrorKind(expenseErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['description', 'amount', 'spentOn', 'category'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  return (
    <>
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
        <SubmitFeedback failed={form.submitError} errorKind={errorKind} unchanged={unchanged} />
      </Form>
      <CancelRow onClose={onClose} disabled={form.isSubmitting} />
    </>
  )
}

function CatalogExpenseForm({ organizationId, siteId, expense, seePrices, create, onSaved, onClose }: ExpenseDialogProps) {
  const { messages: m } = useLocale()
  const t = m.finance
  const { money } = useCurrency()
  const [resource, setResource] = useState<CatalogLookupItem | null>(null)
  /** The picked Resource's current cost, read from the Catalog only for callers who see prices. */
  const [pickedCost, setPickedCost] = useState<{ id: string; cost: string | null } | null>(null)
  const [errorKind, setErrorKind] = useState<ExpenseErrorKind>('generic')
  const [unchanged, setUnchanged] = useState(false)

  const form = useForm({
    initialValues: expense
      ? catalogExpenseToValues(expense)
      : { resourceId: '', quantity: '', spentOn: localToday(), description: '' },
    schema: makeCatalogExpenseSchema(t.validation),
    onSubmit: async (values) => {
      try {
        if (expense) {
          const patch = buildCatalogExpensePatch(expense, values)
          if (Object.keys(patch).length === 0) {
            setUnchanged(true)
            return
          }
          await updateExpense(organizationId, siteId, expense.id, patch)
        } else {
          const draft = buildCatalogExpenseDraft(values)
          await (create ? create(draft) : createExpense(organizationId, siteId, draft))
        }
        onSaved()
      } catch (error) {
        setErrorKind(expenseErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['quantity', 'spentOn', 'description'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  function change(name: string, value: string) {
    setUnchanged(false)
    form.onChange(name, value)
  }

  function pick(picked: CatalogLookupItem | null) {
    setResource(picked)
    setPickedCost(null)
    change('resourceId', picked?.id ?? '')
    if (!picked || !seePrices) return
    getResource(organizationId, picked.id)
      .then((detail) => setPickedCost({ id: picked.id, cost: detail.currentCost }))
      .catch(() => setPickedCost(null))
  }

  const unit = expense?.resource?.unitCode ?? resource?.unitCode ?? ''
  const unitCost = pickedCost && pickedCost.id === resource?.id ? pickedCost.cost : null
  const preview = catalogPreview(form.values.quantity, unitCost, seePrices)
  const fields: FieldConfig[] = [
    ...(expense
      ? []
      : [
          {
            name: 'quantity',
            label: formatMessage(t.catalog.quantity, { unit }),
            type: 'number' as const,
            decimals: 6,
            maxDigits: 12,
            placeholder: t.catalog.quantityPlaceholder,
          },
        ]),
    { name: 'spentOn', label: t.field.spentOn, type: 'date' },
    {
      name: 'description',
      label: t.field.description,
      placeholder: resource?.name ?? t.field.descriptionPlaceholder,
      hint: expense ? undefined : t.catalog.descriptionHint,
      autoComplete: 'off',
      maxLength: TEXT_LIMITS.expenseDescription,
    },
  ]

  return (
    <>
      {expense ? (
        <Notice>
          {expense.unitCost != null
            ? formatMessage(t.catalog.locked, {
                quantity: expense.quantity ?? '',
                unit,
                unitCost: money(Number(expense.unitCost)),
              })
            : formatMessage(t.catalog.lockedWithoutCost, { quantity: expense.quantity ?? '', unit })}
        </Notice>
      ) : (
        <CatalogLookupPicker
          organizationId={organizationId}
          siteId={siteId}
          typeLabels={{ MATERIAL: t.category.MATERIALS, EQUIPMENT: t.category.EQUIPMENT, LABOR: t.category.LABOR }}
          value={resource}
          label={t.catalog.resource}
          error={form.errors.resourceId}
          onChange={pick}
        />
      )}
      <Form
        controller={{ ...form, onChange: change }}
        fields={fields}
        submitLabel={t.dialog.save}
        pendingLabel={t.dialog.saving}
      >
        {expense ? null : (
          <p className="form-field__hint" aria-live="polite">
            {t.catalog.amount}:{' '}
            {preview.kind === 'onSave'
              ? t.catalog.amountOnSave
              : preview.kind === 'pending' || unitCost == null
                ? t.catalog.amountPending
                : formatMessage(t.catalog.amountPreview, {
                    quantity: form.values.quantity.trim(),
                    unitCost: money(Number(unitCost)),
                    amount: money(preview.amount),
                  })}
          </p>
        )}
        <SubmitFeedback failed={form.submitError} errorKind={errorKind} unchanged={unchanged} />
      </Form>
      <CancelRow onClose={onClose} disabled={form.isSubmitting} />
    </>
  )
}
