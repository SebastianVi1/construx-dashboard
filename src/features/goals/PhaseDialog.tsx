import { useState } from 'react'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { instantToLocalInput, localInputToInstant } from './dueAt'
import { buildGoalPatch, makeGoalSchema } from './goalForm'
import { createGoal, goalErrorKind, updateGoal, type Goal, type GoalErrorKind } from './goalsApi'

type PhaseDialogProps = {
  organizationId: string
  siteId: string
  /** The phase to edit; absent to add a new one. */
  goal?: Goal
  onSaved: (goal: Goal, created: boolean) => void
  onClose: () => void
}

/** Add a phase, or rename and reschedule one (a 400 means the dates cut through a task). */
export function PhaseDialog({ organizationId, siteId, goal, onSaved, onClose }: PhaseDialogProps) {
  const { messages: m } = useLocale()
  const t = m.goals
  const copy = goal ? t.editDialog : t.create
  const [errorKind, setErrorKind] = useState<GoalErrorKind>('generic')

  const form = useForm({
    initialValues: {
      name: goal?.name ?? '',
      startAt: goal ? instantToLocalInput(goal.startAt) : '',
      dueAt: goal ? instantToLocalInput(goal.dueAt) : '',
    },
    schema: makeGoalSchema(t.validation),
    onSubmit: async (values) => {
      try {
        if (!goal) {
          const startAt = localInputToInstant(values.startAt) ?? ''
          const dueAt = localInputToInstant(values.dueAt) ?? ''
          onSaved(await createGoal(organizationId, siteId, { name: values.name, startAt, dueAt }), true)
          return
        }
        const patch = buildGoalPatch(goal, values)
        onSaved(Object.keys(patch).length > 0 ? await updateGoal(organizationId, siteId, goal.id, patch) : goal, false)
      } catch (error) {
        setErrorKind(goalErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['name', 'startAt', 'dueAt'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  const fields: FieldConfig[] = [
    { name: 'name', label: t.field.name, placeholder: t.field.namePlaceholder, autoComplete: 'off' },
    { name: 'startAt', label: t.field.startAt, type: 'datetime-local', hint: t.field.startHint },
    { name: 'dueAt', label: t.field.dueAt, type: 'datetime-local', hint: t.field.dueHint },
  ]

  return (
    <Modal title={copy.title} description={copy.description} onClose={onClose}>
      <Form controller={form} fields={fields} submitLabel={copy.submit} pendingLabel={copy.pending}>
        {form.submitError ? (
          <p className="form-error" role="alert">
            {t.error[errorKind]}
          </p>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {t.cancel}
        </button>
      </div>
    </Modal>
  )
}
