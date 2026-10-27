import type { Goal } from '../goals/goalsApi'
import type { Task, TaskStatus } from '../tasks/tasksApi'

export type PhaseRow = {
  kind: 'phase'
  id: string
  label: string
  startAt: string
  dueAt: string
  goal: Goal
  /** The phase's visible tasks, which its edges cannot cut through. */
  tasks: Task[]
  canDrag: boolean
}

export type TaskRow = {
  kind: 'task'
  id: string
  label: string
  startAt: string
  dueAt: string
  status: TaskStatus
  goal: Goal
  task: Task
  canDrag: boolean
}

export type GanttRow = PhaseRow | TaskRow

export type RowPermissions = { canManageGoal: boolean; canManageTask: boolean }

const byDates = (a: { startAt: string; dueAt: string }, b: { startAt: string; dueAt: string }) =>
  Date.parse(a.startAt) - Date.parse(b.startAt) || Date.parse(a.dueAt) - Date.parse(b.dueAt)

/** Chart rows: each phase in start order, followed by its tasks in start order. */
export function buildRows(goals: Goal[], tasksByGoal: Record<string, Task[] | undefined>, can: RowPermissions): GanttRow[] {
  return goals.toSorted(byDates).flatMap((goal) => {
    const tasks = (tasksByGoal[goal.id] ?? []).toSorted(byDates)
    const phase: PhaseRow = {
      kind: 'phase',
      id: goal.id,
      label: goal.name,
      startAt: goal.startAt,
      dueAt: goal.dueAt,
      goal,
      tasks,
      canDrag: can.canManageGoal,
    }
    return [
      phase,
      ...tasks.map(
        (task): TaskRow => ({
          kind: 'task',
          id: task.id,
          label: task.name,
          startAt: task.startAt,
          dueAt: task.dueAt,
          status: task.status,
          goal,
          task,
          canDrag: can.canManageTask,
        }),
      ),
    ]
  })
}
