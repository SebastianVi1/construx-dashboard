import { z } from 'zod'
import { localInputToInstant } from '../goals/dueAt'
import { nameSchema, sameInstant } from '../goals/goalForm'
import type { Task, TaskInput } from './tasksApi'

export type TaskValidationMessages = {
  nameRequired: string
  nameMax: string
  dueRequired: string
  afterPhase: string
  assigneeRequired: string
}

export type TaskValues = { name: string; dueAt: string; assigneeAccessId: string }

/**
 * Task form rules: a name, a complete due date and time that is not after the
 * phase's due instant (the server rejects it with 400 too), and an assignee.
 */
export function makeTaskSchema(messages: TaskValidationMessages, phaseDueAt?: string) {
  return z.object({
    name: nameSchema(messages),
    dueAt: z.string().superRefine((value, context) => {
      const instant = localInputToInstant(value)
      if (!instant) context.addIssue({ code: 'custom', message: messages.dueRequired })
      else if (phaseDueAt && Date.parse(instant) > Date.parse(phaseDueAt)) {
        context.addIssue({ code: 'custom', message: messages.afterPhase })
      }
    }),
    assigneeAccessId: z.string().min(1, messages.assigneeRequired),
  })
}

export type TaskChanges = {
  patch: Partial<Pick<TaskInput, 'name' | 'dueAt'>>
  /** New assignee, or null when unchanged. */
  assigneeAccessId: string | null
}

/** An edit becomes `PATCH {name?, dueAt?}` plus, if needed, `PUT .../assignee`. */
export function buildTaskChanges(task: Task, values: TaskValues): TaskChanges {
  const patch: TaskChanges['patch'] = {}
  const name = values.name.trim()
  const dueAt = localInputToInstant(values.dueAt)
  if (name !== task.name) patch.name = name
  if (dueAt && !sameInstant(dueAt, task.dueAt)) patch.dueAt = dueAt
  const assignee = values.assigneeAccessId
  return { patch, assigneeAccessId: assignee && assignee !== task.assignee.accessId ? assignee : null }
}
