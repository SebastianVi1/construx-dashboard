import { describe, expect, it } from 'bun:test'
import { addTask, editTask } from '../../../features/tasks/taskSave'
import type { PhaseRef, Task, TaskInput, TeamPlace } from '../../../features/tasks/tasksApi'
import { recordGuideMarks } from '../../support/guideMarks'

const marks = recordGuideMarks()
const at: PhaseRef = { organizationId: 'org-1', siteId: 'site-1', goalId: 'goal-1' }
const team: TeamPlace[] = [{ accessId: 'access-1', taskRole: 'LEAD' }]
const crew: Task['assignees'] = [{ accessId: 'access-1', membershipId: 'mem-1', fullName: 'Ana Ruiz', avatarUrl: null, taskRole: 'LEAD' }]
const taskWith = (assignees: Task['assignees']) => ({ id: 'task-1', name: 'Colar losa', assignees }) as Task

describe('addTask', () => {
  const input: TaskInput = { name: 'Colar losa', startAt: '2026-12-01T14:00:00Z', dueAt: '2026-12-02T23:00:00Z', assignees: team }

  it('creates the task and ticks "Assign a task" in its Company when it has a team', async () => {
    const sent: unknown[] = []
    const created = await addTask(at, input, async (...args) => {
      sent.push(args)
      return taskWith(crew)
    })
    expect(created).toEqual(taskWith(crew))
    expect(sent).toEqual([[at, input]])
    expect(marks).toEqual([{ stepId: 'assign-task', organizationId: 'org-1' }])
  })

  it('does not tick the step when the created task has nobody on it', async () => {
    await addTask(at, { ...input, assignees: [] }, async () => taskWith([]))
    expect(marks).toEqual([])
  })

  it('does not tick the step when the create fails, and passes the error on', async () => {
    const failure = new Error('400')
    await expect(
      addTask(at, input, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(marks).toEqual([])
  })
})

describe('editTask', () => {
  const task = taskWith([])
  const neverCalled = async (): Promise<Task> => {
    throw new Error('no request expected')
  }

  it('saves a new team and ticks "Assign a task" in its Company', async () => {
    const sent: unknown[] = []
    const saved = await editTask(at, task, { patch: {}, team }, {
      update: neverCalled,
      setTeam: async (...args) => {
        sent.push(args)
        return taskWith(crew)
      },
    })
    expect(saved).toEqual(taskWith(crew))
    expect(sent).toEqual([[at, 'task-1', team]])
    expect(marks).toEqual([{ stepId: 'assign-task', organizationId: 'org-1' }])
  })

  it('renames first, then saves the team, and returns the last answer', async () => {
    const calls: string[] = []
    const renamed = { ...taskWith([]), name: 'Colar losa N2' }
    const saved = await editTask(at, task, { patch: { name: 'Colar losa N2' }, team }, {
      update: async () => {
        calls.push('update')
        return renamed
      },
      setTeam: async () => {
        calls.push('setTeam')
        return { ...renamed, assignees: crew }
      },
    })
    expect(calls).toEqual(['update', 'setTeam'])
    expect(saved).toEqual({ ...renamed, assignees: crew })
  })

  it('ticks the step when a rename of a task that has a team goes through', async () => {
    const assigned = taskWith(crew)
    await editTask(at, assigned, { patch: { name: 'Colar losa N2' }, team: null }, {
      update: async () => ({ ...assigned, name: 'Colar losa N2' }),
      setTeam: neverCalled,
    })
    expect(marks).toEqual([{ stepId: 'assign-task', organizationId: 'org-1' }])
  })

  it('sends nothing, ticks nothing and returns the task when nothing changed', async () => {
    const assigned = taskWith(crew)
    const saved = await editTask(at, assigned, { patch: {}, team: null }, { update: neverCalled, setTeam: neverCalled })
    expect(saved).toBe(assigned)
    expect(marks).toEqual([])
  })

  it('reports a rename that went through when the team change after it fails, then passes the error on', async () => {
    const renamed = { ...taskWith([]), name: 'Colar losa N2' }
    const partial: Task[] = []
    const failure = new Error('400')
    await expect(
      editTask(at, task, { patch: { name: 'Colar losa N2' }, team }, {
        update: async () => renamed,
        setTeam: async () => {
          throw failure
        },
        onPartial: (saved) => partial.push(saved),
      }),
    ).rejects.toBe(failure)
    expect(partial).toEqual([renamed])
    expect(marks).toEqual([])
  })

  it('reports nothing when the first request fails', async () => {
    const partial: Task[] = []
    const failure = new Error('400')
    await expect(
      editTask(at, task, { patch: { name: 'Colar losa N2' }, team }, {
        update: async () => {
          throw failure
        },
        setTeam: neverCalled,
        onPartial: (saved) => partial.push(saved),
      }),
    ).rejects.toBe(failure)
    expect(partial).toEqual([])
    expect(marks).toEqual([])
  })
})
