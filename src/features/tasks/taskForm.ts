import { z } from 'zod'
import { localInputToInstant } from '../goals/dueAt'
import { nameSchema, sameInstant, startNotAfterDue } from '../goals/goalForm'
import type { Goal } from '../goals/goalsApi'
import type { Task, TaskInput, TeamPlace } from './tasksApi'
import { sameTeam } from './teamRules'
import { colorSchema } from '../gantt/barColor'

export type TaskValidationMessages = {
  nameRequired: string
  nameMax: string
  startRequired: string
  dueRequired: string
  startAfterDue: string
  beforePhase: string
  afterPhase: string
}

/** The form's text fields; the team is edited beside them and checked with `teamIssue`. */
export type TaskValues = { color?: string; name: string; startAt: string; dueAt: string }

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
 * inside the phase with the start not after the due.
 */
export function makeTaskSchema(messages: TaskValidationMessages, phase?: Pick<Goal, 'startAt' | 'dueAt'>, invalidColor = 'Invalid color') {
  return z
    .object({
      color: colorSchema(invalidColor),
      name: nameSchema(messages),
      startAt: instantField(messages.startRequired, messages.beforePhase, (start) =>
        phase ? start < Date.parse(phase.startAt) : false,
      ),
      dueAt: instantField(messages.dueRequired, messages.afterPhase, (due) =>
        phase ? due > Date.parse(phase.dueAt) : false,
      ),
    })
    .refine(startNotAfterDue, { message: messages.startAfterDue, path: ['startAt'] })
}

export type TaskChanges = {
  patch: Partial<Pick<TaskInput, 'name' | 'startAt' | 'dueAt' | 'color'>>
  /** The new team, or null when nobody or no role changed. */
  team: TeamPlace[] | null
}

/** An edit becomes `PATCH {name?, startAt?, dueAt?}` plus, if needed, `PUT .../assignees`. */
export function buildTaskChanges(task: Task, values: TaskValues, team: TeamPlace[]): TaskChanges {
  const patch: TaskChanges['patch'] = {}
  if (values.color !== undefined && values.color !== (task.color ?? '')) patch.color = values.color
  const name = values.name.trim()
  const startAt = localInputToInstant(values.startAt)
  const dueAt = localInputToInstant(values.dueAt)
  if (name !== task.name) patch.name = name
  if (startAt && !sameInstant(startAt, task.startAt)) patch.startAt = startAt
  if (dueAt && !sameInstant(dueAt, task.dueAt)) patch.dueAt = dueAt
  return { patch, team: sameTeam(team, task.assignees) ? null : team }
}
