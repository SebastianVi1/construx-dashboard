import { useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog } from '../../components/modal'
import { SkeletonList, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { BudgetAmountDialog } from '../finance/BudgetAmountDialog'
import type { Goal } from '../goals/goalsApi'
import { usePermissions } from '../permissions'
import { allocationIssue } from '../sites/budgetRules'
import type { SiteAccess } from '../sites/sitesApi'
import { TaskDialog } from './TaskDialog'
import { TaskDue, TaskMoveButtons, TaskTeamSummary } from './TaskBits'
import { groupByStatus, taskActions, taskDetailPath, type TaskActions } from './taskRules'
import {
  deleteTask,
  taskErrorKind,
  listTasks,
  setTaskBudget,
  type PhaseRef,
  type Task,
  type TaskFilter,
  type TaskStatus,
} from './tasksApi'
import { useTaskMove } from './useTaskMove'
import './tasks.css'
import { useCurrency } from '../../currency'

type PhaseTasksProps = {
  organizationId: string
  siteId: string
  goal: Goal
  filter: TaskFilter
  /** People on the site, the team choices; undefined while loading. */
  people: SiteAccess[] | undefined
  onSite: boolean | undefined
  /** A task was added, changed or removed: phase and site progress are stale. */
  onChanged: () => void
}

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; task: Task }
  | { kind: 'budget'; task: Task }
  | { kind: 'delete'; task: Task }
  | null

/** Tasks of one phase as a board grouped by status, filtered on the server. Budgets need VIEW_BUDGET / MANAGE_BUDGET. */
export function PhaseTasks({ organizationId, siteId, goal, filter, people, onSite, onChanged }: PhaseTasksProps) {
  const { messages: m } = useLocale()
  const { money } = useCurrency()
  const t = m.tasks
  const { access, can } = usePermissions()
  const at: PhaseRef = { organizationId, siteId, goalId: goal.id }
  const tasks = useRemoteData(
    `${organizationId}:${siteId}:${goal.id}:tasks:${filter.status ?? ''}:${filter.assigneeAccessId ?? ''}`,
    () => listTasks(at, filter),
  )
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [now] = useState(() => new Date())

  const canCreate = can('MANAGE_ACTIVITY', siteId, { onSite }) && can('ASSIGN_ACTIVITY', siteId, { onSite })
  const myMembershipId = access?.membershipId ?? null
  const canViewBudget = can('VIEW_BUDGET')
  const canManageBudget = can('MANAGE_BUDGET')

  function replace(task: Task) {
    tasks.update((list) => list.map((item) => (item.id === task.id ? task : item)))
    onChanged()
  }

  const moves = useTaskMove(replace)

  const [drag, setDrag] = useState<{ task: Task; actions: TaskActions } | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)

  function dragMoveKind(
    task: Task,
    targetStatus: TaskStatus,
    actions: TaskActions,
  ): 'start' | 'complete' | null {
    if (task.status === targetStatus) return null
    if (targetStatus === 'IN_PROGRESS' && task.status === 'TODO' && actions.start) return 'start'
    if (targetStatus === 'DONE' && task.status !== 'DONE' && actions.complete) return 'complete'
    return null
  }

  function saved(task: Task, created: boolean) {
    if (created) tasks.update((list) => [...list, task])
    else tasks.update((list) => list.map((item) => (item.id === task.id ? task : item)))
    moves.clear()
    setDialog(null)
    setNotice(created ? formatMessage(t.created, { name: task.name }) : t.saved)
    onChanged()
  }

  async function saveBudget(task: Task, amount: number | null) {
    const updated = await setTaskBudget(at, task.id, amount)
    tasks.update((list) => list.map((item) => (item.id === updated.id ? updated : item)))
    setDialog(null)
    setNotice(formatMessage(t.budget.saved, { name: updated.name }))
    onChanged()
  }

  function budgetError(error: unknown): string {
    const allocation = allocationIssue(error)
    if (allocation) return t.budget.error[allocation]
    const kind = taskErrorKind(error)
    return kind === 'afterPhase' ? t.budget.error.invalid : t.error[kind]
  }

  async function remove(task: Task) {
    try {
      await deleteTask(at, task.id)
      tasks.update((list) => list.filter((item) => item.id !== task.id))
      moves.clear()
      setDialog(null)
      setNotice(formatMessage(t.deleted, { name: task.name }))
      onChanged()
    } catch (error) {
      const kind = taskErrorKind(error)
      setDeleteError(kind === 'transition' ? t.remove.hasExpenses : t.error[kind])
    }
  }

  const feedback =
    moves.outcome?.kind === 'error' ? (
      <Notice tone="error">{t.error[moves.outcome.error]}</Notice>
    ) : moves.outcome ? (
      <Notice tone="success">
        {formatMessage(moves.outcome.kind === 'start' ? t.started : t.completed, { name: moves.outcome.task.name })}
      </Notice>
    ) : notice ? (
      <Notice tone="success">{notice}</Notice>
    ) : null

  const filtered = Boolean(filter.status || filter.assigneeAccessId)
  const groups = groupByStatus(tasks.data ?? []).filter((group) => !filter.status || group.status === filter.status)

  return (
    <div className="phase-tasks">
      {canCreate ? (
        <div className="phase-tasks__toolbar">
          <button
            type="button"
            className="button button--small"
            disabled={!people || people.length === 0}
            aria-label={formatMessage(t.addLabel, { phase: goal.name })}
            onClick={() => {
              setNotice(null)
              setDialog({ kind: 'create' })
            }}
          >
            {t.add}
          </button>
          {people && people.length === 0 ? <span className="phase-tasks__hint">{t.noPeople}</span> : null}
        </div>
      ) : null}

      {feedback}

      {tasks.data ? (
        tasks.data.length === 0 ? (
          <p className="phase-tasks__empty">{filtered ? t.noResults : t.empty}</p>
        ) : (
          <div
            className="task-board"
            data-columns={groups.length}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null)
            }}
          >
            {groups.map((group) => {
              const moveKind = drag ? dragMoveKind(drag.task, group.status, drag.actions) : null
              const isOver = drag !== null && dragOverColumn === group.status
              return (
              <section
                key={group.status}
                className="task-column"
                aria-label={t.status[group.status]}
                data-drop-valid={isOver && moveKind !== null ? '' : undefined}
                data-drop-invalid={isOver && moveKind === null ? '' : undefined}
                onDragEnter={() => { if (drag && !moves.busyId) setDragOverColumn(group.status) }}
                onDragOver={(e) => { if (drag && moveKind !== null) e.preventDefault() }}
                onDrop={() => {
                  if (!drag || !moveKind) return
                  const { task } = drag
                  setDrag(null)
                  setDragOverColumn(null)
                  setNotice(null)
                  void moves.move(at, task, moveKind)
                }}
              >
                <h4 className="task-column__title" data-status={group.status}>
                  {t.status[group.status]}
                  <span className="data-mono task-column__count">{group.tasks.length}</span>
                </h4>
                {group.tasks.length === 0 ? (
                  <p className="task-column__empty">{t.emptyGroup}</p>
                ) : (
                  <ul className="task-list">
                    {group.tasks.map((task) => {
                      const allowed = taskActions(access, task, { onSite })
                      const canDrag = !moves.busyId && (allowed.start || allowed.complete)
                      return (
                        <li
                          key={task.id}
                          className="task-item"
                          data-status={task.status}
                          draggable={canDrag}
                          data-dragging={drag?.task.id === task.id ? '' : undefined}
                          onDragStart={() => {
                            setDrag({ task, actions: allowed })
                            setNotice(null)
                          }}
                          onDragEnd={() => {
                            setDrag(null)
                            setDragOverColumn(null)
                          }}
                        >
                          <p className="task-item__name">
                            <Link
                              className="table-link"
                              to={taskDetailPath(task)}
                              aria-label={formatMessage(t.openLabel, { name: task.name })}
                            >
                              {task.name}
                            </Link>
                          </p>
                          <p className="task-item__meta">
                            <TaskTeamSummary task={task} myMembershipId={myMembershipId} />
                            <TaskDue task={task} now={now} />
                          </p>
                          {canViewBudget && task.allocatedBudget !== null ? (
                            <p className="task-item__meta data-mono">
                              {formatMessage(t.budget.value, { amount: money(task.allocatedBudget) })}
                            </p>
                          ) : null}
                          {allowed.start ||
                          allowed.complete ||
                          allowed.edit ||
                          allowed.reassign ||
                          allowed.remove ||
                          canManageBudget ? (
                            <div className="task-item__actions">
                              <TaskMoveButtons
                                task={task}
                                actions={allowed}
                                busy={moves.busyId === task.id}
                                disabled={moves.busyId !== null}
                                onMove={(kind) => {
                                  setNotice(null)
                                  void moves.move(at, task, kind)
                                }}
                              />
                              {allowed.edit || allowed.reassign ? (
                                <button
                                  type="button"
                                  className="task-link"
                                  aria-label={formatMessage(t.editLabel, { name: task.name })}
                                  onClick={() => {
                                    setNotice(null)
                                    setDialog({ kind: 'edit', task })
                                  }}
                                >
                                  {t.edit}
                                </button>
                              ) : null}
                              {canManageBudget ? (
                                <button
                                  type="button"
                                  className="task-link"
                                  aria-label={formatMessage(t.budget.actionLabel, { name: task.name })}
                                  onClick={() => {
                                    setNotice(null)
                                    setDialog({ kind: 'budget', task })
                                  }}
                                >
                                  {t.budget.action}
                                </button>
                              ) : null}
                              {allowed.remove ? (
                                <button
                                  type="button"
                                  className="task-link task-link--danger"
                                  aria-label={formatMessage(t.deleteLabel, { name: task.name })}
                                  onClick={() => {
                                    setDeleteError(null)
                                    setDialog({ kind: 'delete', task })
                                  }}
                                >
                                  {t.delete}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
              )
            })}
          </div>
        )
      ) : tasks.status === 'error' ? (
        <Notice tone="error" action={{ label: t.retry, onClick: tasks.reload }}>
          {t.loadError}
        </Notice>
      ) : (
        <SkeletonList />
      )}

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <TaskDialog
          at={at}
          goal={goal}
          people={people ?? []}
          task={dialog.kind === 'edit' ? dialog.task : undefined}
          canEdit={dialog.kind === 'create' || taskActions(access, dialog.task, { onSite }).edit}
          canReassign={dialog.kind === 'create' || taskActions(access, dialog.task, { onSite }).reassign}
          onSaved={saved}
          onUpdated={replace}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'budget' ? (
        <BudgetAmountDialog
          title={t.budget.dialogTitle}
          description={t.budget.dialogBody}
          current={dialog.task.allocatedBudget}
          save={(amount) => saveBudget(dialog.task, amount)}
          errorMessage={budgetError}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmDialog
          title={t.remove.title}
          body={t.remove.body}
          confirmLabel={t.remove.confirm}
          pendingLabel={t.remove.pending}
          cancelLabel={t.cancel}
          error={deleteError}
          onConfirm={() => remove(dialog.task)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}
