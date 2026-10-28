import { z } from 'zod'
import { AuthApiError, deleteJson, getJson, sendJson } from '../auth/authApi'
import { goalPath } from '../goals/goalsApi'
import { organizationPath } from '../permissions/permissionsApi'

export const taskStatuses = ['TODO', 'IN_PROGRESS', 'DONE'] as const

export type TaskStatus = (typeof taskStatuses)[number]

/** Positions in a task's team, most senior first; a task has exactly one LEAD. */
export const taskRoles = ['LEAD', 'FOREMAN', 'CREW'] as const

export type TaskRole = (typeof taskRoles)[number]

/** One requested place in a team: who, and in which task role. */
export type TeamPlace = { accessId: string; taskRole: TaskRole }

export const assigneeSchema = z.object({
  accessId: z.string().min(1),
  membershipId: z.string().min(1),
  fullName: z.string().nullable(),
  taskRole: z.enum(taskRoles),
})

export type Assignee = z.infer<typeof assigneeSchema>

/** `ActivityResponse`: a task of a phase, always with a team, sorted most senior first. */
export const taskSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  goalName: z.string().nullish(),
  projectId: z.string().min(1),
  projectName: z.string().nullish(),
  name: z.string(),
  startAt: z.string(),
  dueAt: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  status: z.enum(taskStatuses),
  completedAt: z.string().nullable(),
  assignees: z.array(assigneeSchema).min(1),
  /** Share of the phase budget; null when unset or without VIEW_BUDGET. */
  allocatedBudget: z.number().nullable().default(null),
})

export type Task = z.infer<typeof taskSchema>

/** Where a phase's tasks live. */
export type PhaseRef = { organizationId: string; siteId: string; goalId: string }

export type TaskFilter = { status?: TaskStatus; assigneeAccessId?: string }

export type TaskInput = { color?: string; name: string; startAt: string; dueAt: string; assignees: TeamPlace[] }

function tasksPath(at: PhaseRef): string {
  return `${goalPath(at.organizationId, at.siteId, at.goalId)}/activities`
}

function taskPath(at: PhaseRef, taskId: string): string {
  return `${tasksPath(at)}/${encodeURIComponent(taskId)}`
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) if (value) search.set(name, value)
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** Tasks of a phase ordered by due date; the server filters by status and assignee. */
export function listTasks(at: PhaseRef, filter: TaskFilter = {}): Promise<Task[]> {
  return getJson(`${tasksPath(at)}${query(filter)}`, z.array(taskSchema))
}

export function createTask(at: PhaseRef, input: TaskInput): Promise<Task> {
  const body = {
    name: input.name.trim(),
    startAt: input.startAt,
    dueAt: input.dueAt,
    assignees: input.assignees,
    ...(input.color !== undefined ? { color: input.color } : {}),
  }
  return sendJson('post', tasksPath(at), body, 201, taskSchema)
}

export function getTask(at: PhaseRef, taskId: string): Promise<Task> {
  return getJson(taskPath(at, taskId), taskSchema)
}

/** Rename and/or reschedule; both dates are checked as a pair. Status and team have their own endpoints. */
export function updateTask(
  at: PhaseRef,
  taskId: string,
  patch: Partial<Pick<TaskInput, 'name' | 'startAt' | 'dueAt'>> & { color?: string },
): Promise<Task> {
  return sendJson('patch', taskPath(at, taskId), patch, 200, taskSchema)
}

/** Owner and Finance only: carves the task budget out of its phase budget; null clears it. */
export function setTaskBudget(at: PhaseRef, taskId: string, amount: number | null): Promise<Task> {
  return sendJson('put', `${taskPath(at, taskId)}/budget`, { allocatedBudget: amount }, 200, taskSchema)
}

/** Replaces the whole team; it needs exactly one LEAD. Requires `ASSIGN_ACTIVITY`. */
export function setTaskTeam(at: PhaseRef, taskId: string, assignees: TeamPlace[]): Promise<Task> {
  return sendJson('put', `${taskPath(at, taskId)}/assignees`, { assignees }, 200, taskSchema)
}

/** TODO → IN_PROGRESS. */
export function startTask(at: PhaseRef, taskId: string): Promise<Task> {
  return sendJson('post', `${taskPath(at, taskId)}/start`, undefined, 200, taskSchema)
}

/** TODO or IN_PROGRESS → DONE. A done task cannot be reopened in v1. */
export function completeTask(at: PhaseRef, taskId: string): Promise<Task> {
  return sendJson('post', `${taskPath(at, taskId)}/complete`, undefined, 200, taskSchema)
}

export function deleteTask(at: PhaseRef, taskId: string): Promise<void> {
  return deleteJson(taskPath(at, taskId))
}

/** Tasks whose team includes the caller, on every site of the organization, ordered by due date. */
export function listMyTasks(organizationId: string, status?: TaskStatus): Promise<Task[]> {
  return getJson(`${organizationPath(organizationId)}/activities/mine${query({ status })}`, z.array(taskSchema))
}

/** Where a task lives, from the ids it carries. */
export function phaseOf(organizationId: string, task: Pick<Task, 'projectId' | 'goalId'>): PhaseRef {
  return { organizationId, siteId: task.projectId, goalId: task.goalId }
}

export type TaskErrorKind =
  | 'afterPhase'
  | 'invalid'
  | 'transition'
  | 'session'
  | 'forbidden'
  | 'notFound'
  | 'generic'

/**
 * Message for a failed task request. A 400 `INVALID_ARGUMENT` means the due
 * date is after the phase's; 404 is a missing task, phase or team member on
 * the site; 409 is a move the task's status does not allow, or deleting a task
 * that has expenses.
 */
export function taskErrorKind(error: unknown): TaskErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 400) return error.code === 'INVALID_ARGUMENT' ? 'afterPhase' : 'invalid'
  if (error.status === 409) return 'transition'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}
