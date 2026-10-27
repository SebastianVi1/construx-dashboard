import { useState } from 'react'
import { completeTask, startTask, taskErrorKind, type PhaseRef, type Task, type TaskErrorKind } from './tasksApi'

export type MoveOutcome = { kind: 'start' | 'complete'; task: Task } | { kind: 'error'; error: TaskErrorKind }

/** Start or complete one task at a time, with the busy task and the last outcome. */
export function useTaskMove(onMoved: (task: Task) => void) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<MoveOutcome | null>(null)

  async function move(at: PhaseRef, task: Task, kind: 'start' | 'complete') {
    if (busyId) return
    setBusyId(task.id)
    setOutcome(null)
    try {
      const moved = kind === 'start' ? await startTask(at, task.id) : await completeTask(at, task.id)
      onMoved(moved)
      setOutcome({ kind, task: moved })
    } catch (error) {
      setOutcome({ kind: 'error', error: taskErrorKind(error) })
    } finally {
      setBusyId(null)
    }
  }

  return { busyId, outcome, move, clear: () => setOutcome(null) }
}
