import { useState } from 'react'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { dueText, instantToLocalInput, localInputToInstant } from '../goals/dueAt'
import type { Goal } from '../goals/goalsApi'
import type { SiteAccess } from '../sites/sitesApi'
import { buildTaskChanges, makeTaskSchema } from './taskForm'
import {
  createTask,
  reassignTask,
  taskErrorKind,
  updateTask,
  type PhaseRef,
  type Task,
  type TaskErrorKind,
} from './tasksApi'

type TaskDialogProps = {
  at: PhaseRef
  goal: Goal
  /** People on the site: the only valid assignees. */
  people: SiteAccess[]
  /** The task to edit; absent to add one. */
  task?: Task
  /** Dates a new task starts with; default to the whole phase. */
  initialStartAt?: string
  initialDueAt?: string
  /** On edit: which parts the role may change. Creating needs both. */
  canEdit?: boolean
  canReassign?: boolean
  onSaved: (task: Task, created: boolean) => void
  /** A rename went through but the reassignment after it failed; the dialog stays open. */
  onUpdated?: (task: Task) => void
  onClose: () => void
}

/**
 * Add a task (name, start, due, assignee) or edit one: name and dates go to
 * PATCH, a new assignee to PUT `.../assignee`.
 */
export function TaskDialog({
  at,
  goal,
  people,
  task,
  initialStartAt,
  initialDueAt,
  canEdit = true,
  canReassign = true,
  onSaved,
  onUpdated,
  onClose,
}: TaskDialogProps) {
  const { messages: m, locale } = useLocale()
  const t = m.tasks
  const copy = task ? t.editDialog : t.create
  const [errorKind, setErrorKind] = useState<TaskErrorKind>('generic')

  const form = useForm({
    initialValues: {
      name: task?.name ?? '',
      startAt: instantToLocalInput(task?.startAt ?? initialStartAt ?? goal.startAt),
      dueAt: instantToLocalInput(task?.dueAt ?? initialDueAt ?? goal.dueAt),
      assigneeAccessId: task?.assignee.accessId ?? '',
    },
    schema: makeTaskSchema(t.validation, goal),
    onSubmit: async (values) => {
      let latest = task
      try {
        if (!task) {
          const startAt = localInputToInstant(values.startAt) ?? ''
          const dueAt = localInputToInstant(values.dueAt) ?? ''
          onSaved(await createTask(at, { ...values, startAt, dueAt }), true)
          return
        }
        const changes = buildTaskChanges(task, values)
        if (Object.keys(changes.patch).length > 0) latest = await updateTask(at, task.id, changes.patch)
        if (changes.assigneeAccessId) latest = await reassignTask(at, task.id, changes.assigneeAccessId)
        onSaved(latest ?? task, false)
      } catch (error) {
        // A rename can succeed before a failed reassignment; keep the list truthful.
        if (task && latest && latest !== task) onUpdated?.(latest)
        setErrorKind(taskErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['name', 'startAt', 'dueAt', 'assigneeAccessId'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  const assigneeOptions = [
    { value: '', label: t.field.assigneePlaceholder },
    ...people.map((person) => ({ value: person.accessId, label: person.fullName || t.unnamed })),
  ]
  const fields: FieldConfig[] = [
    ...(canEdit
      ? ([
          { name: 'name', label: t.field.name, placeholder: t.field.namePlaceholder, autoComplete: 'off' },
          {
            name: 'startAt',
            label: t.field.startAt,
            type: 'datetime-local',
            hint: formatMessage(t.field.startHint, { date: dueText(goal.startAt, intlLocales[locale]) }),
          },
          {
            name: 'dueAt',
            label: t.field.dueAt,
            type: 'datetime-local',
            hint: formatMessage(t.field.dueHint, { date: dueText(goal.dueAt, intlLocales[locale]) }),
          },
        ] satisfies FieldConfig[])
      : []),
    ...(canReassign
      ? ([{ name: 'assigneeAccessId', label: t.field.assignee, type: 'select', options: assigneeOptions }] satisfies FieldConfig[])
      : []),
  ]

  return (
    <Modal
      title={copy.title}
      description={task ? copy.description : formatMessage(t.create.description, { phase: goal.name })}
      onClose={onClose}
    >
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
