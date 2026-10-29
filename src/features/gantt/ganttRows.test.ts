import { describe, expect, it } from 'bun:test'
import type { Goal } from '../goals/goalsApi'
import type { Task } from '../tasks/tasksApi'
import { buildRows } from './ganttRows'

function goal(id: string, startAt: string, dueAt: string): Goal {
  return { id, projectId: 'p-1', name: `Phase ${id}`, startAt, dueAt, activityCount: 0, doneCount: 0, completed: false, allocatedBudget: null, allocatedToActivities: null, unallocated: null }
}

function task(id: string, goalId: string, startAt: string, dueAt: string, status: Task['status'] = 'TODO'): Task {
  return {
    id,
    goalId,
    projectId: 'p-1',
    name: `Task ${id}`,
    startAt,
    dueAt,
    status,
    completedAt: null,
    assignee: { accessId: 'a-1', membershipId: 'm-1', fullName: 'Ana' },
    allocatedBudget: null,
  }
}

const both = { canManageGoal: true, canManageTask: true }

describe('buildRows', () => {
  it('orders phases by start then due, each followed by its tasks in start order', () => {
    const goals = [
      goal('late', '2027-02-01T00:00:00Z', '2027-03-01T00:00:00Z'),
      goal('long', '2027-01-01T00:00:00Z', '2027-04-01T00:00:00Z'),
      goal('short', '2027-01-01T00:00:00Z', '2027-01-20T00:00:00Z'),
    ]
    const tasks = {
      short: [
        task('s2', 'short', '2027-01-10T00:00:00Z', '2027-01-12T00:00:00Z'),
        task('s1', 'short', '2027-01-02T00:00:00Z', '2027-01-15T00:00:00Z'),
      ],
      late: [task('l1', 'late', '2027-02-02T00:00:00Z', '2027-02-03T00:00:00Z')],
    }
    expect(buildRows(goals, tasks, both).map((row) => row.id)).toEqual(['short', 's1', 's2', 'long', 'late', 'l1'])
  })

  it('carries kind, label, dates, status and the phase of each task', () => {
    const phase = goal('g', '2027-01-01T00:00:00Z', '2027-01-20T00:00:00Z')
    const done = task('t', 'g', '2027-01-02T00:00:00Z', '2027-01-03T00:00:00Z', 'DONE')
    const [phaseRow, taskRow] = buildRows([phase], { g: [done] }, both)

    expect(phaseRow).toEqual({
      kind: 'phase',
      id: 'g',
      label: 'Phase g',
      startAt: phase.startAt,
      dueAt: phase.dueAt,
      goal: phase,
      tasks: [done],
      canDrag: true,
    })
    expect(taskRow).toEqual({
      kind: 'task',
      id: 't',
      label: 'Task t',
      startAt: done.startAt,
      dueAt: done.dueAt,
      status: 'DONE',
      goal: phase,
      task: done,
      canDrag: true,
    })
  })

  it('lets only managers drag: phases with MANAGE_GOAL, tasks with MANAGE_ACTIVITY', () => {
    const phase = goal('g', '2027-01-01T00:00:00Z', '2027-01-20T00:00:00Z')
    const tasks = { g: [task('t', 'g', '2027-01-02T00:00:00Z', '2027-01-03T00:00:00Z')] }

    expect(buildRows([phase], tasks, { canManageGoal: false, canManageTask: true }).map((row) => row.canDrag)).toEqual([
      false,
      true,
    ])
    expect(buildRows([phase], tasks, { canManageGoal: true, canManageTask: false }).map((row) => row.canDrag)).toEqual([
      true,
      false,
    ])
  })

  it('shows a phase whose tasks are not loaded or not visible with no task rows', () => {
    const phase = goal('g', '2027-01-01T00:00:00Z', '2027-01-20T00:00:00Z')
    const rows = buildRows([phase], {}, both)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'phase', tasks: [] })
  })
})
