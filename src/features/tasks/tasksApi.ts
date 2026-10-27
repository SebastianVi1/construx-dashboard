import { z } from 'zod'
import { AuthApiError, deleteJson, getJson, sendJson } from '../auth/authApi'
import { goalPath } from '../goals/goalsApi'
import { organizationPath } from '../permissions/permissionsApi'

export const taskStatuses = ['TODO', 'IN_PROGRESS', 'DONE'] as const

export type TaskStatus = (typeof taskStatuses)[number]

/** `ActivityResponse`: a task of a phase, always with an assignee. */
export const taskSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string(),
  dueAt: z.string(),
  status: z.enum(taskStatuses),
  completedAt: z.string().nullable(),
  assignee: z.object({
    accessId: z.string().min(1),
    membershipId: z.string().min(1),
    fullName: z.string().nullable(),
  }),
})

export type Task = z.infer<typeof taskSchema>

/** Where a phase's tasks live. */
export type PhaseRef = { organizationId: string; siteId: string; goalId: string }

export type TaskFilter = { status?: TaskStatus; assigneeAccessId?: string }

export type TaskInput = { name: string; dueAt: string; assigneeAccessId: string }

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
  const body = { name: input.name.trim(), dueAt: input.dueAt, assigneeAccessId: input.assigneeAccessId }
  return sendJson('post', tasksPath(at), body, 201, taskSchema)
}

/** Rename and/or reschedule. Status and assignee have their own endpoints. */
export function updateTask(at: PhaseRef, taskId: string, patch: Partial<Pick<TaskInput, 'name' | 'dueAt'>>): Promise<Task> {
  return sendJson('patch', taskPath(at, taskId), patch, 200, taskSchema)
}

export function reassignTask(at: PhaseRef, taskId: string, assigneeAccessId: string): Promise<Task> {
  return sendJson('put', `${taskPath(at, taskId)}/assignee`, { assigneeAccessId }, 200, taskSchema)
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

/** The caller's own tasks on every site of the organization, ordered by due date. */
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
 * date is after the phase's; 404 is a missing task, phase or assignee on the
 * site; 409 is a move the task's status does not allow.
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
