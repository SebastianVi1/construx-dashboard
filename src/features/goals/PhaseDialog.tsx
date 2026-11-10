import { useState } from 'react'
import { Form, TEXT_LIMITS, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale } from '../../i18n'
import { instantToLocalInput, localInputToInstant } from './dueAt'
import { buildGoalPatch, makeGoalSchema } from './goalForm'
import { createGoal, goalErrorKind, setGoalBudget, updateGoal, type Goal, type GoalErrorKind } from './goalsApi'
import { budgetChanged, budgetToInput, optionalBudgetAmount } from '../sites/budgetRules'
import { BarColorPicker } from '../gantt/BarColorPicker'

type PhaseDialogProps = {
  organizationId: string
  siteId: string
  /** The phase to edit; absent to add a new one. */
  goal?: Goal
  /** MANAGE_BUDGET: the dialog also sets the phase budget. */
  canManageBudget: boolean
  onSaved: (goal: Goal, created: boolean) => void
  onClose: () => void
}

/**
 * Add a phase, or rename and reschedule one (a 400 means the dates cut through a task). With MANAGE_BUDGET it
 * also sets the budget, through the budget endpoint after the phase is saved. If only the budget fails, the
 * created phase is kept so a retry does not add it twice.
 */
export function PhaseDialog({ organizationId, siteId, goal, canManageBudget, onSaved, onClose }: PhaseDialogProps) {
  const { messages: m } = useLocale()
  const money = useCurrency()
  const t = m.goals
  const copy = goal ? t.editDialog : t.create
  const [errorKind, setErrorKind] = useState<GoalErrorKind>('generic')
  const [created, setCreated] = useState<Goal | null>(null)

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const notBefore = goal
    ? undefined
    : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()

  const form = useForm({
    initialValues: {
      color: goal?.color ?? '',
      name: goal?.name ?? '',
      startAt: goal ? instantToLocalInput(goal.startAt) : '',
      dueAt: goal ? instantToLocalInput(goal.dueAt) : '',
      budget: budgetToInput(goal?.allocatedBudget ?? null, money),
    },
    schema: makeGoalSchema(t.validation, m.gantt.invalidColor, canManageBudget ? m.sites.budget.validation : undefined, notBefore, money),
    onSubmit: async (values) => {
      try {
        let saved = goal ?? created
        if (!saved) {
          const startAt = localInputToInstant(values.startAt) ?? ''
          const dueAt = localInputToInstant(values.dueAt) ?? ''
          saved = await createGoal(organizationId, siteId, { name: values.name, startAt, dueAt, color: values.color })
          setCreated(saved)
        } else {
          const patch = buildGoalPatch(saved, values)
          if (Object.keys(patch).length > 0) saved = await updateGoal(organizationId, siteId, saved.id, patch)
        }
        const budget = values.budget ?? ''
        if (canManageBudget && budgetChanged(saved.allocatedBudget, budget, money)) {
          saved = await setGoalBudget(organizationId, siteId, saved.id, optionalBudgetAmount(budget, money))
        }
        onSaved(saved, !goal)
      } catch (error) {
        setErrorKind(goalErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['name', 'startAt', 'dueAt', 'budget', 'color'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  const fields: FieldConfig[] = [
    { name: 'name', label: t.field.name, placeholder: t.field.namePlaceholder, autoComplete: 'off', maxLength: TEXT_LIMITS.phaseName },
    { name: 'startAt', label: t.field.startAt, type: 'date', hint: t.field.startHint, min: goal ? undefined : todayStr },
    { name: 'dueAt', label: t.field.dueAt, type: 'date', hint: t.field.dueHint, min: goal ? undefined : todayStr },
    ...(canManageBudget
      ? [
          {
            name: 'budget',
            label: formatMessage(t.field.budget, { currency: money.currency }),
            type: 'money',
            placeholder: t.field.budgetPlaceholder,
            hint: t.field.budgetHint,
          } satisfies FieldConfig,
        ]
      : []),
  ]

  /** A phase created before its budget failed still reaches the list. */
  function close() {
    if (created) onSaved(created, true)
    else onClose()
  }

  return (
    <Modal title={copy.title} description={copy.description} onClose={close}>
      <Form controller={form} fields={fields} submitLabel={copy.submit} pendingLabel={copy.pending}>
        <BarColorPicker
          value={form.values.color}
          disabled={form.isSubmitting}
          error={form.errors.color}
          simple
          onChange={(color) => form.onChange('color', color)}
          onBlur={() => form.onBlur('color')}
        />
        {form.submitError ? (
          <p className="form-error" role="alert">
            {t.error[errorKind]}
          </p>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={close}>
          {t.cancel}
        </button>
      </div>
    </Modal>
  )
}
