import { z } from 'zod'
import { localInputToInstant } from './dueAt'
import type { Goal, GoalInput } from './goalsApi'
import { colorSchema } from '../gantt/barColor'

export type GoalValidationMessages = {
  nameRequired: string
  nameMax: string
  startRequired: string
  dueRequired: string
  startAfterDue: string
}

export type GoalValues = { color?: string; name: string; startAt: string; dueAt: string }

/** Name trimmed to 1..160 characters (backend rule); the `datetime-local` value must be complete. */
export function nameSchema(messages: { nameRequired: string; nameMax: string }) {
  return z.string().trim().min(1, messages.nameRequired).max(160, messages.nameMax)
}

export function dueSchema(message: string) {
  return z.string().refine((value) => localInputToInstant(value) !== null, message)
}

/** Both `datetime-local` values hold instants and the start is not after the due (the server rule). */
export function startNotAfterDue(values: { startAt: string; dueAt: string }): boolean {
  const start = localInputToInstant(values.startAt)
  const due = localInputToInstant(values.dueAt)
  return !start || !due || Date.parse(start) <= Date.parse(due)
}

export function makeGoalSchema(messages: GoalValidationMessages, invalidColor = 'Invalid color') {
  return z
    .object({
      color: colorSchema(invalidColor),
      name: nameSchema(messages),
      startAt: dueSchema(messages.startRequired),
      dueAt: dueSchema(messages.dueRequired),
    })
    .refine(startNotAfterDue, { message: messages.startAfterDue, path: ['startAt'] })
}

/** Same instant, even when written differently (`...:00Z` vs `...:00.000Z`). */
export function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b)
}

/** PATCH body for an edited phase: only the fields that changed. */
export function buildGoalPatch(goal: Goal, values: GoalValues): Partial<GoalInput> {
  const patch: Partial<GoalInput> = {}
  if (values.color !== undefined && values.color !== (goal.color ?? '')) patch.color = values.color
  const name = values.name.trim()
  const startAt = localInputToInstant(values.startAt)
  const dueAt = localInputToInstant(values.dueAt)
  if (name !== goal.name) patch.name = name
  if (startAt && !sameInstant(startAt, goal.startAt)) patch.startAt = startAt
  if (dueAt && !sameInstant(dueAt, goal.dueAt)) patch.dueAt = dueAt
  return patch
}
