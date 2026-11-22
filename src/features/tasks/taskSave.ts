import { markGuideStep } from '../guide'
import type { TaskChanges } from './taskForm'
import { createTask, setTaskTeam, updateTask, type PhaseRef, type Task, type TaskInput } from './tasksApi'
import { taskSaveAssigns } from './teamRules'

/**
 * Create a task in a phase. One that was created with somebody on it ticks
 * the guide's "Assign a task" step; a task with nobody on it or a failed
 * create doesn't.
 */
export async function addTask(at: PhaseRef, input: TaskInput, create: typeof createTask = createTask): Promise<Task> {
  const created = await create(at, input)
  if (taskSaveAssigns(created)) markGuideStep('assign-task', at.organizationId)
  return created
}

type EditTaskOptions = {
  update?: typeof updateTask
  setTeam?: typeof setTaskTeam
  /** The rename went through but the team change after it failed: the task as the server now has it. */
  onPartial?: (task: Task) => void
}

/**
 * Edit a task: changed name, dates, color or description go to PATCH, then a
 * changed team to PUT `.../assignees`. Returns the server's last answer, or
 * the task itself when nothing changed and no request went out. A save that
 * leaves somebody on the task ticks the guide's "Assign a task" step; a
 * failed save or one that sent nothing doesn't.
 */
export async function editTask(
  at: PhaseRef,
  task: Task,
  changes: TaskChanges,
  { update = updateTask, setTeam = setTaskTeam, onPartial }: EditTaskOptions = {},
): Promise<Task> {
  // The server's answer to this save; stays null when no request went out.
  let answered: Task | null = null
  try {
    if (Object.keys(changes.patch).length > 0) answered = await update(at, task.id, changes.patch)
    if (changes.team) answered = await setTeam(at, task.id, changes.team)
  } catch (error) {
    if (answered) onPartial?.(answered)
    throw error
  }
  if (taskSaveAssigns(answered)) markGuideStep('assign-task', at.organizationId)
  return answered ?? task
}
