import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { listSites } from '../sites/sitesApi'
import { TaskDue, TaskMoveButtons, TaskStatusBadge } from './TaskBits'
import { taskActions } from './taskRules'
import { listMyTasks, phaseOf, taskStatuses, type Task, type TaskStatus } from './tasksApi'
import { useTaskMove } from './useTaskMove'
import '../sites/sites.css'
import './tasks.css'

/**
 * The caller's own tasks across every site of the company (the Worker's
 * home): filter by status, open the site, start and complete from here.
 */
export function MyTasksPage() {
  const { messages: m } = useLocale()
  const t = m.tasks
  const organization = useCurrentOrganization()
  const { access } = usePermissions()
  const filterId = useId()
  const [status, setStatus] = useState<TaskStatus | ''>('')
  // Both requests start together; site names only label the rows.
  const tasks = useRemoteData(`${organization.id}:mine:${status}`, () => listMyTasks(organization.id, status || undefined))
  const sites = useRemoteData(`${organization.id}:mine:sites`, () => listSites(organization.id))
  const [now] = useState(() => new Date())
  const moves = useTaskMove((moved) =>
    tasks.update((list) =>
      list
        .map((item) => (item.id === moved.id ? moved : item))
        .filter((item) => !status || item.status === status),
    ),
  )

  useEffect(() => {
    document.title = `${t.mine.title} | Construx`
  }, [t.mine.title])

  const siteNames = new Map((sites.data ?? []).map((site) => [site.id, site.name]))

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.mine.title}</h1>
          <p>{t.mine.description}</p>
        </div>
      </header>

      <section className="page-section" aria-label={t.mine.title}>
        <div className="sites-toolbar">
          <label className="sites-toolbar__label" htmlFor={filterId}>
            {t.filter.status}
          </label>
          <span className="filter-select">
            <select
              id={filterId}
              value={status}
              onChange={(event) => {
                moves.clear()
                setStatus(event.target.value as TaskStatus | '')
              }}
            >
              <option value="">{t.filter.allStatuses}</option>
              {taskStatuses.map((value) => (
                <option key={value} value={value}>
                  {t.status[value]}
                </option>
              ))}
            </select>
          </span>
        </div>

        {moves.outcome?.kind === 'error' ? (
          <Notice tone="error">{t.error[moves.outcome.error]}</Notice>
        ) : moves.outcome ? (
          <Notice tone="success">
            {formatMessage(moves.outcome.kind === 'start' ? t.started : t.completed, { name: moves.outcome.task.name })}
          </Notice>
        ) : null}

        {tasks.data ? (
          tasks.data.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t.mine.column.task}</th>
                    <th scope="col">{t.mine.column.site}</th>
                    <th scope="col">{t.mine.column.due}</th>
                    <th scope="col">{t.mine.column.status}</th>
                    <th scope="col" className="cell-actions">
                      {t.mine.column.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.data.map((task) => (
                    <MyTaskRow
                      key={task.id}
                      task={task}
                      siteName={siteNames.get(task.projectId)}
                      now={now}
                      actions={taskActions(access, task, {})}
                      busy={moves.busyId === task.id}
                      disabled={moves.busyId !== null}
                      onMove={(kind) => void moves.move(phaseOf(organization.id, task), task, kind)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>{status ? t.mine.noResults : t.mine.empty}</p>
            </div>
          )
        ) : tasks.status === 'error' ? (
          <Notice tone="error" action={{ label: t.retry, onClick: tasks.reload }}>
            {t.loadError}
          </Notice>
        ) : (
          <LoadingState label={t.loading} />
        )}
      </section>
    </div>
  )
}

type MyTaskRowProps = {
  task: Task
  siteName: string | undefined
  now: Date
  actions: ReturnType<typeof taskActions>
  busy: boolean
  disabled: boolean
  onMove: (kind: 'start' | 'complete') => void
}

function MyTaskRow({ task, siteName, now, actions, busy, disabled, onMove }: MyTaskRowProps) {
  const { messages: m } = useLocale()
  const t = m.tasks
  return (
    <tr>
      <th scope="row" className="my-task__name">
        {task.name}
      </th>
      <td>
        <Link className="table-link" to={`/sites/${encodeURIComponent(task.projectId)}`}>
          {siteName ?? t.mine.unknownSite}
        </Link>
      </td>
      <td>
        <TaskDue task={task} now={now} />
      </td>
      <td>
        <TaskStatusBadge status={task.status} labels={t.status} />
      </td>
      <td className="cell-actions">
        <span className="my-task__actions">
          <TaskMoveButtons task={task} actions={actions} busy={busy} disabled={disabled} onMove={onMove} />
        </span>
      </td>
    </tr>
  )
}
