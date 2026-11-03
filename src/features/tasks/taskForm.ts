import { z } from 'zod'
import { localInputToInstant } from '../goals/dueAt'
import { nameSchema, sameDate, startNotAfterDue } from '../goals/goalForm'
import type { Goal } from '../goals/goalsApi'
import type { Task, TaskInput, TeamPlace } from './tasksApi'
import { sameTeam } from './teamRules'
import { colorSchema } from '../gantt/barColor'

export type TaskValidationMessages = {
  nameRequired: string
  nameMax: string
  descriptionMax: string
  startRequired: string
  dueRequired: string
  startAfterDue: string
  beforePhase: string
  afterPhase: string
  startPast: string
  duePast: string
}

/** The form's text fields; the team is edited beside them and checked with `teamIssue`. */
export type TaskValues = { color?: string; description?: string; name: string; startAt: string; dueAt: string }

/** Local midnight of an instant's calendar day, for day-level boundary checks. */
function dayStart(instant: string): number {
  const d = new Date(instant)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** A complete `date` value that `outside` does not reject and is not before `notBefore`. */
function instantField(
  required: string,
  outsideMessage: string,
  outside: (instant: number) => boolean,
  pastMessage?: string,
  notBefore?: number,
) {
  return z.string().superRefine((value, context) => {
    const instant = localInputToInstant(value)
    if (!instant) context.addIssue({ code: 'custom', message: required })
    else if (outside(Date.parse(instant))) context.addIssue({ code: 'custom', message: outsideMessage })
    else if (notBefore !== undefined && Date.parse(instant) < notBefore) context.addIssue({ code: 'custom', message: pastMessage ?? required })
  })
}

/**
 * Task form rules, like the server's 400s: a name, a start and a due that lie
 * inside the phase (day-level comparison) with the start not after the due.
 */
export function makeTaskSchema(
  messages: TaskValidationMessages,
  phase?: Pick<Goal, 'startAt' | 'dueAt'>,
  invalidColor = 'Invalid color',
  notBefore?: number,
) {
  return z
    .object({
      color: colorSchema(invalidColor),
      description: z.string().max(500, messages.descriptionMax).default(''),
      name: nameSchema(messages),
      startAt: instantField(
        messages.startRequired,
        messages.beforePhase,
        (start) => (phase ? start < dayStart(phase.startAt) : false),
        messages.startPast,
        notBefore,
      ),
      dueAt: instantField(
        messages.dueRequired,
        messages.afterPhase,
        (due) => (phase ? due > dayStart(phase.dueAt) : false),
        messages.duePast,
        notBefore,
      ),
    })
    .refine(startNotAfterDue, { message: messages.startAfterDue, path: ['startAt'] })
}

export type TaskChanges = {
  patch: Partial<Pick<TaskInput, 'name' | 'startAt' | 'dueAt' | 'color' | 'description'>>
  /** The new team, or null when nobody or no role changed. */
  team: TeamPlace[] | null
}

/** An edit becomes `PATCH {name?, startAt?, dueAt?}` plus, if needed, `PUT .../assignees`. */
export function buildTaskChanges(task: Task, values: TaskValues, team: TeamPlace[]): TaskChanges {
  const patch: TaskChanges['patch'] = {}
  if (values.color !== undefined && values.color !== (task.color ?? '')) patch.color = values.color
  if (values.description !== undefined && values.description !== (task.description ?? '')) patch.description = values.description
  const name = values.name.trim()
  const startAt = localInputToInstant(values.startAt)
  const dueAt = localInputToInstant(values.dueAt)
  if (name !== task.name) patch.name = name
  if (startAt && !sameDate(startAt, task.startAt)) patch.startAt = startAt
  if (dueAt && !sameDate(dueAt, task.dueAt)) patch.dueAt = dueAt
  return { patch, team: sameTeam(team, task.assignees) ? null : team }
}
