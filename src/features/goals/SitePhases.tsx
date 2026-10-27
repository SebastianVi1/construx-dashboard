import { useId, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog } from '../../components/modal'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { usePermissions } from '../permissions'
import { ProgressMeter } from '../sites/SiteBits'
import { siteProgress } from '../sites/siteHelpers'
import type { SiteAccess } from '../sites/sitesApi'
import { PhaseTasks } from '../tasks/PhaseTasks'
import { taskStatuses, type TaskFilter, type TaskStatus } from '../tasks/tasksApi'
import { dueText, isOverdue } from './dueAt'
import { deleteGoal, goalErrorKind, listGoals, type Goal } from './goalsApi'
import { PhaseDialog } from './PhaseDialog'
import './goals.css'

type SitePhasesProps = {
  organizationId: string
  siteId: string
  people: SiteAccess[] | undefined
  onSite: boolean | undefined
  /** Task counts of the site changed. */
  onProgressChanged: () => void
}

type Dialog = { kind: 'create' } | { kind: 'edit'; goal: Goal } | { kind: 'delete'; goal: Goal } | null

/**
 * Phases of a site in due order, each with its task board. Viewing needs
 * VIEW_GOAL; adding, editing and deleting phases MANAGE_GOAL; the boards
 * VIEW_ACTIVITY.
 */
export function SitePhases({ organizationId, siteId, people, onSite, onProgressChanged }: SitePhasesProps) {
  const { messages: m, locale } = useLocale()
  const t = m.goals
  const { can } = usePermissions()
  const headingId = useId()
  const statusId = useId()
  const assigneeId = useId()
  const canView = can('VIEW_GOAL', siteId, { onSite })
  const canManage = can('MANAGE_GOAL', siteId, { onSite })
  const canViewTasks = can('VIEW_ACTIVITY', siteId, { onSite })
  const goals = useRemoteData(canView ? `${organizationId}:${siteId}:goals` : null, () =>
    listGoals(organizationId, siteId),
  )
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [status, setStatus] = useState<TaskStatus | ''>('')
  const [assignee, setAssignee] = useState('')
  const [now] = useState(() => new Date())

  if (!canView) return null

  const filter: TaskFilter = { status: status || undefined, assigneeAccessId: assignee || undefined }
  const intl = intlLocales[locale]

  function tasksChanged() {
    goals.reload()
    onProgressChanged()
  }

  function saved(goal: Goal, created: boolean) {
    goals.update((list) =>
      (created ? [...list, goal] : list.map((item) => (item.id === goal.id ? goal : item))).toSorted(
        (a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt),
      ),
    )
    setDialog(null)
    setNotice(created ? formatMessage(t.created, { name: goal.name }) : t.saved)
  }

  async function remove(goal: Goal) {
    try {
      await deleteGoal(organizationId, siteId, goal.id)
      goals.update((list) => list.filter((item) => item.id !== goal.id))
      setDialog(null)
      setNotice(formatMessage(t.deleted, { name: goal.name }))
    } catch (error) {
      setDeleteError(t.error[goalErrorKind(error)])
    }
  }

  return (
    <section className="page-section phases" aria-labelledby={headingId}>
      <div className="page-section__header">
        <div>
          <h2 id={headingId}>{t.title}</h2>
          <p>{t.description}</p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setNotice(null)
              setDialog({ kind: 'create' })
            }}
          >
            {t.add}
          </button>
        ) : null}
      </div>

      {canViewTasks && goals.data && goals.data.length > 0 ? (
        <div className="phases__filters">
          <label className="sites-toolbar__label" htmlFor={statusId}>
            {m.tasks.filter.status}
          </label>
          <span className="filter-select">
            <select id={statusId} value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | '')}>
              <option value="">{m.tasks.filter.allStatuses}</option>
              {taskStatuses.map((value) => (
                <option key={value} value={value}>
                  {m.tasks.status[value]}
                </option>
              ))}
            </select>
          </span>
          <label className="sites-toolbar__label" htmlFor={assigneeId}>
            {m.tasks.filter.assignee}
          </label>
          <span className="filter-select">
            <select id={assigneeId} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">{m.tasks.filter.everyone}</option>
              {(people ?? []).map((person) => (
                <option key={person.accessId} value={person.accessId}>
                  {person.fullName || m.tasks.unnamed}
                </option>
              ))}
            </select>
          </span>
        </div>
      ) : null}

      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {goals.data ? (
        goals.data.length === 0 ? (
          <div className="empty-state">
            <p>{canManage ? t.emptyManager : t.emptyViewer}</p>
            {canManage ? (
              <button type="button" className="button" onClick={() => setDialog({ kind: 'create' })}>
                {t.addFirst}
              </button>
            ) : null}
          </div>
        ) : (
          <ol className="phase-timeline">
            {goals.data.map((goal) => {
              const progress = siteProgress(goal)
              const late = !goal.completed && isOverdue(goal.dueAt, now)
              const state = goal.completed ? 'completed' : late ? 'late' : 'open'
              return (
                <li key={goal.id} className="phase" data-state={state}>
                  <div className="phase__rail" aria-hidden="true">
                    <span className="phase__node" />
                  </div>
                  <article className="phase__body" aria-labelledby={`phase-${goal.id}`}>
                    <header className="phase__header">
                      <div className="phase__title">
                        <p className="phase__due data-mono">{formatMessage(t.due, { date: dueText(goal.dueAt, intl) })}</p>
                        <h3 id={`phase-${goal.id}`}>{goal.name}</h3>
                        <div className="phase__facts">
                          {goal.completed ? (
                            <span className="badge" data-tone="success">
                              {t.completed}
                            </span>
                          ) : late ? (
                            <span className="badge" data-tone="danger">
                              {t.overdue}
                            </span>
                          ) : null}
                          {progress ? (
                            progress.total > 0 ? (
                              <ProgressMeter
                                progress={progress}
                                label={formatMessage(t.progress, { done: progress.done, total: progress.total })}
                              />
                            ) : (
                              <span className="phase__muted">{t.noTasks}</span>
                            )
                          ) : null}
                        </div>
                      </div>
                      {canManage ? (
                        <div className="phase__actions">
                          <button
                            type="button"
                            className="task-link"
                            aria-label={formatMessage(t.editLabel, { name: goal.name })}
                            onClick={() => {
                              setNotice(null)
                              setDialog({ kind: 'edit', goal })
                            }}
                          >
                            {t.edit}
                          </button>
                          <button
                            type="button"
                            className="task-link task-link--danger"
                            aria-label={formatMessage(t.deleteLabel, { name: goal.name })}
                            onClick={() => {
                              setDeleteError(null)
                              setDialog({ kind: 'delete', goal })
                            }}
                          >
                            {t.delete}
                          </button>
                        </div>
                      ) : null}
                    </header>
                    {canViewTasks ? (
                      <PhaseTasks
                        organizationId={organizationId}
                        siteId={siteId}
                        goal={goal}
                        filter={filter}
                        people={people}
                        onSite={onSite}
                        onChanged={tasksChanged}
                      />
                    ) : null}
                  </article>
                </li>
              )
            })}
          </ol>
        )
      ) : goals.status === 'error' ? (
        <Notice tone="error" action={{ label: t.retry, onClick: goals.reload }}>
          {t.loadError}
        </Notice>
      ) : (
        <LoadingState label={t.loading} />
      )}

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <PhaseDialog
          organizationId={organizationId}
          siteId={siteId}
          goal={dialog.kind === 'edit' ? dialog.goal : undefined}
          onSaved={saved}
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
          onConfirm={() => remove(dialog.goal)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  )
}
