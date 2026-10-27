import { z } from 'zod'
import { localInputToInstant } from '../goals/dueAt'
import { nameSchema, sameInstant, startNotAfterDue } from '../goals/goalForm'
import type { Goal } from '../goals/goalsApi'
import type { Task, TaskInput } from './tasksApi'

export type TaskValidationMessages = {
  nameRequired: string
  nameMax: string
  startRequired: string
  dueRequired: string
  startAfterDue: string
  beforePhase: string
  afterPhase: string
  assigneeRequired: string
}

export type TaskValues = { name: string; startAt: string; dueAt: string; assigneeAccessId: string }

/** A complete `datetime-local` value that `outside` does not reject. */
function instantField(required: string, outsideMessage: string, outside: (instant: number) => boolean) {
  return z.string().superRefine((value, context) => {
    const instant = localInputToInstant(value)
    if (!instant) context.addIssue({ code: 'custom', message: required })
    else if (outside(Date.parse(instant))) context.addIssue({ code: 'custom', message: outsideMessage })
  })
}

/**
 * Task form rules, like the server's 400s: a name, a start and a due that lie
 * inside the phase with the start not after the due, and an assignee.
 */
export function makeTaskSchema(messages: TaskValidationMessages, phase?: Pick<Goal, 'startAt' | 'dueAt'>) {
  return z
    .object({
      name: nameSchema(messages),
      startAt: instantField(messages.startRequired, messages.beforePhase, (start) =>
        phase ? start < Date.parse(phase.startAt) : false,
      ),
      dueAt: instantField(messages.dueRequired, messages.afterPhase, (due) =>
        phase ? due > Date.parse(phase.dueAt) : false,
      ),
      assigneeAccessId: z.string().min(1, messages.assigneeRequired),
    })
    .refine(startNotAfterDue, { message: messages.startAfterDue, path: ['startAt'] })
}

export type TaskChanges = {
  patch: Partial<Pick<TaskInput, 'name' | 'startAt' | 'dueAt'>>
  /** New assignee, or null when unchanged. */
  assigneeAccessId: string | null
}

/** An edit becomes `PATCH {name?, startAt?, dueAt?}` plus, if needed, `PUT .../assignee`. */
export function buildTaskChanges(task: Task, values: TaskValues): TaskChanges {
  const patch: TaskChanges['patch'] = {}
  const name = values.name.trim()
  const startAt = localInputToInstant(values.startAt)
  const dueAt = localInputToInstant(values.dueAt)
  if (name !== task.name) patch.name = name
  if (startAt && !sameInstant(startAt, task.startAt)) patch.startAt = startAt
  if (dueAt && !sameInstant(dueAt, task.dueAt)) patch.dueAt = dueAt
  const assignee = values.assigneeAccessId
  return { patch, assigneeAccessId: assignee && assignee !== task.assignee.accessId ? assignee : null }
}
