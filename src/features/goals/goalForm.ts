import { z } from 'zod'
import { localInputToInstant } from './dueAt'
import type { Goal, GoalInput } from './goalsApi'

export type GoalValidationMessages = { nameRequired: string; nameMax: string; dueRequired: string }

export type GoalValues = { name: string; dueAt: string }

/** Name trimmed to 1..160 characters (backend rule); the `datetime-local` value must be complete. */
export function nameSchema(messages: { nameRequired: string; nameMax: string }) {
  return z.string().trim().min(1, messages.nameRequired).max(160, messages.nameMax)
}

export function dueSchema(message: string) {
  return z.string().refine((value) => localInputToInstant(value) !== null, message)
}

export function makeGoalSchema(messages: GoalValidationMessages) {
  return z.object({ name: nameSchema(messages), dueAt: dueSchema(messages.dueRequired) })
}

/** Same instant, even when written differently (`...:00Z` vs `...:00.000Z`). */
export function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b)
}

/** PATCH body for an edited phase: only the fields that changed. */
export function buildGoalPatch(goal: Goal, values: GoalValues): Partial<GoalInput> {
  const patch: Partial<GoalInput> = {}
  const name = values.name.trim()
  const dueAt = localInputToInstant(values.dueAt)
  if (name !== goal.name) patch.name = name
  if (dueAt && !sameInstant(dueAt, goal.dueAt)) patch.dueAt = dueAt
  return patch
}
