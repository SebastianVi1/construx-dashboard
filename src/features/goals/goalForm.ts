import { z } from 'zod'
import { localInputToInstant } from './dueAt'
import type { Goal, GoalInput } from './goalsApi'
import { colorSchema } from '../gantt/barColor'
import type { MoneyConversion } from '../../currency'
import { optionalBudgetField, type BudgetValidationMessages } from '../sites/budgetRules'

export type GoalValidationMessages = {
  nameRequired: string
  nameMax: string
  startRequired: string
  dueRequired: string
  startAfterDue: string
  startPast: string
  duePast: string
}

/** `budget` is only on the form for roles with MANAGE_BUDGET; it is saved through its own endpoint. */
export type GoalValues = { color?: string; name: string; startAt: string; dueAt: string; budget?: string }

/** Name trimmed to 1..160 characters (backend rule); the `date` value must be a valid YYYY-MM-DD. */
export function nameSchema(messages: { nameRequired: string; nameMax: string }) {
  return z.string().trim().min(1, messages.nameRequired).max(160, messages.nameMax)
}

/** Both dates hold day-level instants and the start is not after the due (the server rule). */
export function startNotAfterDue(values: { startAt: string; dueAt: string }): boolean {
  const start = localInputToInstant(values.startAt)
  const due = localInputToInstant(values.dueAt)
  return !start || !due || Date.parse(start) <= Date.parse(due)
}

/** True when both instants fall on the same local calendar day. */
export function sameDate(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

/** Same instant, even when written differently (`...:00Z` vs `...:00.000Z`). */
export function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b)
}

export function dueSchema(required: string, pastMessage?: string, notBefore?: number) {
  return z.string().superRefine((value, ctx) => {
    const instant = localInputToInstant(value)
    if (!instant) {
      ctx.addIssue({ code: 'custom', message: required })
      return
    }
    if (notBefore !== undefined && Date.parse(instant) < notBefore) {
      ctx.addIssue({ code: 'custom', message: pastMessage ?? required })
    }
  })
}

/** With `budget` messages the optional budget field is validated; without them it is ignored. */
export function makeGoalSchema(
  messages: GoalValidationMessages,
  invalidColor = 'Invalid color',
  budget?: BudgetValidationMessages,
  notBefore?: number,
  money?: MoneyConversion,
) {
  return z
    .object({
      color: colorSchema(invalidColor),
      name: nameSchema(messages),
      startAt: dueSchema(messages.startRequired, messages.startPast, notBefore),
      dueAt: dueSchema(messages.dueRequired, messages.duePast, notBefore),
      budget: budget ? optionalBudgetField(budget, money).optional() : z.string().optional(),
    })
    .refine(startNotAfterDue, { message: messages.startAfterDue, path: ['startAt'] })
}

/** PATCH body for an edited phase: only the fields that changed (compared at the day level). */
export function buildGoalPatch(goal: Goal, values: GoalValues): Partial<GoalInput> {
  const patch: Partial<GoalInput> = {}
  if (values.color !== undefined && values.color !== (goal.color ?? '')) patch.color = values.color
  const name = values.name.trim()
  const startAt = localInputToInstant(values.startAt)
  const dueAt = localInputToInstant(values.dueAt)
  if (name !== goal.name) patch.name = name
  if (startAt && !sameDate(startAt, goal.startAt)) patch.startAt = startAt
  if (dueAt && !sameDate(dueAt, goal.dueAt)) patch.dueAt = dueAt
  return patch
}
