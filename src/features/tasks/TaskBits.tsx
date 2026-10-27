import { formatMessage, intlLocales, useLocale, type Messages } from '../../i18n'
import { dueText, isOverdue } from '../goals/dueAt'
import type { Task, TaskStatus } from './tasksApi'
import type { TaskActions } from './taskRules'

const statusTone: Record<TaskStatus, string> = { TODO: 'neutral', IN_PROGRESS: 'accent', DONE: 'success' }

export function TaskStatusBadge({ status, labels }: { status: TaskStatus; labels: Messages['tasks']['status'] }) {
  return (
    <span className="badge" data-tone={statusTone[status]}>
      {labels[status]}
    </span>
  )
}

/** Due (or done) date of a task, flagged when an open task is past due. */
export function TaskDue({ task, now }: { task: Task; now: Date }) {
  const { messages: m, locale } = useLocale()
  const t = m.tasks
  const intl = intlLocales[locale]
  if (task.status === 'DONE' && task.completedAt) {
    return <span className="data-mono">{formatMessage(t.doneOn, { date: dueText(task.completedAt, intl) })}</span>
  }
  const late = task.status !== 'DONE' && isOverdue(task.dueAt, now)
  return (
    <span className="task-due" data-late={late || undefined}>
      <span className="data-mono">{formatMessage(t.due, { date: dueText(task.dueAt, intl) })}</span>
      {late ? <span className="task-due__late">{t.overdue}</span> : null}
    </span>
  )
}

type MoveButtonsProps = {
  task: Task
  actions: Pick<TaskActions, 'start' | 'complete'>
  busy: boolean
  disabled: boolean
  onMove: (kind: 'start' | 'complete') => void
}

/** Start / Complete, offered only for the moves the role and status allow. */
export function TaskMoveButtons({ task, actions, busy, disabled, onMove }: MoveButtonsProps) {
  const { messages: m } = useLocale()
  const t = m.tasks
  if (busy) {
    return (
      <span className="task-working" role="status">
        {t.working}
      </span>
    )
  }
  return (
    <>
      {actions.start ? (
        <button
          type="button"
          className="button button--small"
          disabled={disabled}
          aria-label={formatMessage(t.startLabel, { name: task.name })}
          onClick={() => onMove('start')}
        >
          {t.start}
        </button>
      ) : null}
      {actions.complete ? (
        <button
          type="button"
          className="button button--small task-complete"
          disabled={disabled}
          aria-label={formatMessage(t.completeLabel, { name: task.name })}
          onClick={() => onMove('complete')}
        >
          {t.complete}
        </button>
      ) : null}
    </>
  )
}
