import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { FilterTabs, type FilterOption } from '../../components/filter'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { listSites } from '../sites/sitesApi'
import { TaskDue, TaskMoveButtons, TaskRoleBadge, TaskStatusBadge } from './TaskBits'
import { filterByStatus, taskActions, taskDetailPath } from './taskRules'
import { listMyTasks, phaseOf, taskStatuses, type Task, type TaskStatus } from './tasksApi'
import { myTaskRole } from './teamRules'
import { useTaskMove } from './useTaskMove'
import '../sites/sites.css'
import './tasks.css'

/**
 * Tasks whose team includes the caller, across every site of the company (the
 * Worker's home): filter by status, open a task or its site, start and complete.
 */
export function MyTasksPage() {
  const { messages: m } = useLocale()
  const t = m.tasks
  const organization = useCurrentOrganization()
  const { access } = usePermissions()
  const [status, setStatus] = useState<TaskStatus | ''>('')
  // Both requests start together; site names only label the rows. All tasks load once and the
  // status buttons filter them here, so switching is instant and each button shows its count.
  const tasks = useRemoteData(`${organization.id}:mine`, () => listMyTasks(organization.id))
  const sites = useRemoteData(`${organization.id}:mine:sites`, () => listSites(organization.id))
  const [now] = useState(() => new Date())
  const moves = useTaskMove((moved) =>
    tasks.update((list) => list.map((item) => (item.id === moved.id ? moved : item))),
  )

  useEffect(() => {
    document.title = `${t.mine.title} | Construx`
  }, [t.mine.title])

  const { counts, visible } = filterByStatus(tasks.data ?? [], status)
  const filters: FilterOption<TaskStatus | ''>[] = [
    { value: '', label: t.filter.all, count: tasks.data ? counts.all : undefined },
    ...taskStatuses.map((value) => ({ value, label: t.status[value], count: tasks.data ? counts[value] : undefined })),
  ]

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
        <FilterTabs
          label={t.filter.status}
          options={filters}
          value={status}
          onChange={(value) => {
            moves.clear()
            setStatus(value)
          }}
        />

        {moves.outcome?.kind === 'error' ? (
          <Notice tone="error">{t.error[moves.outcome.error]}</Notice>
        ) : moves.outcome ? (
          <Notice tone="success">
            {formatMessage(moves.outcome.kind === 'start' ? t.started : t.completed, { name: moves.outcome.task.name })}
          </Notice>
        ) : null}

        {tasks.data ? (
          visible.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t.mine.column.task}</th>
                    <th scope="col">{t.mine.column.site}</th>
                    <th scope="col">{t.mine.column.role}</th>
                    <th scope="col">{t.mine.column.due}</th>
                    <th scope="col">{t.mine.column.status}</th>
                    <th scope="col" className="cell-actions">
                      {t.mine.column.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((task) => (
                    <MyTaskRow
                      key={task.id}
                      task={task}
                      siteName={siteNames.get(task.projectId)}
                      myMembershipId={access?.membershipId ?? null}
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
  myMembershipId: string | null
  now: Date
  actions: ReturnType<typeof taskActions>
  busy: boolean
  disabled: boolean
  onMove: (kind: 'start' | 'complete') => void
}

function MyTaskRow({ task, siteName, myMembershipId, now, actions, busy, disabled, onMove }: MyTaskRowProps) {
  const { messages: m } = useLocale()
  const t = m.tasks
  const role = myTaskRole(task, myMembershipId)
  return (
    <tr>
      <th scope="row" className="my-task__name">
        <Link className="table-link" to={taskDetailPath(task)} aria-label={formatMessage(t.openLabel, { name: task.name })}>
          {task.name}
        </Link>
      </th>
      <td>
        <Link className="table-link" to={`/sites/${encodeURIComponent(task.projectId)}`}>
          {siteName ?? task.projectName ?? t.mine.unknownSite}
        </Link>
      </td>
      <td>{role ? <TaskRoleBadge role={role} /> : null}</td>
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
