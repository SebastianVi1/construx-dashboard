import { z } from 'zod'
import { AuthApiError, deleteJson, getJson, sendJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

/** `GoalResponse`: a phase of a site. Counts are null without task visibility. */
export const goalSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string(),
  dueAt: z.string(),
  activityCount: z.number().int().nullable(),
  doneCount: z.number().int().nullable(),
  /** The phase has tasks and all of them are done. */
  completed: z.boolean(),
})

export type Goal = z.infer<typeof goalSchema>

export type GoalInput = { name: string; dueAt: string }

export function goalsPath(organizationId: string, siteId: string): string {
  return `${organizationPath(organizationId)}/projects/${encodeURIComponent(siteId)}/goals`
}

export function goalPath(organizationId: string, siteId: string, goalId: string): string {
  return `${goalsPath(organizationId, siteId)}/${encodeURIComponent(goalId)}`
}

/** Phases of a site, ordered by due date by the server. */
export function listGoals(organizationId: string, siteId: string): Promise<Goal[]> {
  return getJson(goalsPath(organizationId, siteId), z.array(goalSchema))
}

export function createGoal(organizationId: string, siteId: string, input: GoalInput): Promise<Goal> {
  const body = { name: input.name.trim(), dueAt: input.dueAt }
  return sendJson('post', goalsPath(organizationId, siteId), body, 201, goalSchema)
}

/** Rename and/or reschedule; only the fields sent change. */
export function updateGoal(
  organizationId: string,
  siteId: string,
  goalId: string,
  patch: Partial<GoalInput>,
): Promise<Goal> {
  return sendJson('patch', goalPath(organizationId, siteId, goalId), patch, 200, goalSchema)
}

export function deleteGoal(organizationId: string, siteId: string, goalId: string): Promise<void> {
  return deleteJson(goalPath(organizationId, siteId, goalId))
}

export type GoalErrorKind = 'beforeTasks' | 'invalid' | 'hasTasks' | 'session' | 'forbidden' | 'notFound' | 'generic'

/**
 * Message for a failed phase request. A 400 `INVALID_ARGUMENT` means the due
 * date is before one of its tasks; a 409 means the phase still has tasks.
 */
export function goalErrorKind(error: unknown): GoalErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 400) return error.code === 'INVALID_ARGUMENT' ? 'beforeTasks' : 'invalid'
  if (error.status === 409) return 'hasTasks'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}
