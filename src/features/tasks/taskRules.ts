import { canPerform, type MyAccess } from '../permissions/can'
import { taskStatuses, type Task, type TaskStatus } from './tasksApi'

export type TaskActions = {
  start: boolean
  complete: boolean
  edit: boolean
  reassign: boolean
  remove: boolean
}

/**
 * Which task actions the UI offers. Start and complete pass `OWN` scope for
 * the assignee (compared by membership id), and only for the moves the status
 * allows; edit and delete need `MANAGE_ACTIVITY` beyond `OWN`, reassign needs
 * `ASSIGN_ACTIVITY`. `onSite` is the caller's own access to the task's site
 * when known. The server still checks every request.
 */
export function taskActions(access: MyAccess | null, task: Task, context: { onSite?: boolean }): TaskActions {
  const own = access !== null && task.assignee.membershipId === access.membershipId
  const move = canPerform(access, 'MANAGE_ACTIVITY', task.projectId, { onSite: context.onSite, own })
  const manage = canPerform(access, 'MANAGE_ACTIVITY', task.projectId, { onSite: context.onSite })
  return {
    start: move && task.status === 'TODO',
    complete: move && task.status !== 'DONE',
    edit: manage,
    reassign: canPerform(access, 'ASSIGN_ACTIVITY', task.projectId, { onSite: context.onSite }),
    remove: manage,
  }
}

export type StatusGroup = { status: TaskStatus; tasks: Task[] }

/** To do, in progress, done (all three, even when empty), each ordered by due date. */
export function groupByStatus(tasks: Task[]): StatusGroup[] {
  const byDue = tasks.toSorted((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  return taskStatuses.map((status) => ({ status, tasks: byDue.filter((task) => task.status === status) }))
}
