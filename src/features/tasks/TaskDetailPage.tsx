import { TaskDetailSkeleton } from './TaskSkeletons'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { BackLink, SkeletonForm, Notice } from '../../components/page'
import { intlLocales, useLocale } from '../../i18n'
import { dueText, isOverdue } from '../goals/dueAt'
import { listGoals } from '../goals/goalsApi'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { Avatar } from '../profile/Avatar'
import '../profile/profile.css'
import { listSiteAccess } from '../sites/sitesApi'
import { TaskMoveButtons, TaskRoleBadge } from './TaskBits'
import { TaskDialog } from './TaskDialog'
import { TaskSpending } from './TaskSpending'
import { taskMoneyActions } from './taskMoney'
import { taskActions } from './taskRules'
import { getTask, taskErrorKind, taskStatuses, type PhaseRef } from './tasksApi'
import { sortTeam } from './teamRules'
import { useTaskMove } from './useTaskMove'
import '../sites/sites.css'
import './tasks.css'

export function TaskDetailPage() {
  const { siteId, goalId, taskId } = useParams()
  const organization = useCurrentOrganization()
  if (!siteId || !goalId || !taskId) return null
  return <TaskDetail key={`${organization.id}:${siteId}:${goalId}:${taskId}`}
    at={{ organizationId: organization.id, siteId, goalId }} taskId={taskId} />
}

function TaskDetail({ at, taskId }: { at: PhaseRef; taskId: string }) {
  const { messages: m, locale } = useLocale()
  const t = m.tasks
  const { access } = usePermissions()
  const data = useRemoteData(`${at.organizationId}:${taskId}`, () => getTask(at, taskId))
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const task = data.data
  const actions = task ? taskActions(access, task, {}) : null
  const editKey = editing && actions && (actions.edit || actions.reassign) ? `${at.organizationId}:${at.siteId}:${at.goalId}` : null
  const goals = useRemoteData(editKey, () => listGoals(at.organizationId, at.siteId))
  const people = useRemoteData(editKey && actions?.reassign ? editKey : null, () => listSiteAccess(at.organizationId, at.siteId))
  const goal = goals.data?.find((item) => item.id === at.goalId)
  const moves = useTaskMove((updated) => data.update(() => updated))
  useEffect(() => { document.title = `${task?.name ?? t.detail.loading} | Construx` }, [task?.name, t.detail.loading])
  const phasePath = `/sites/${encodeURIComponent(at.siteId)}/phases`
  const sitePath = `/sites/${encodeURIComponent(at.siteId)}`
  const canViewMoney = task ? taskMoneyActions(access, task).view : false
  const late = task ? task.status !== 'DONE' && isOverdue(task.dueAt, new Date()) : false
  const statusIndex = task ? taskStatuses.indexOf(task.status) : 0

  return <div className="page">
    <BackLink to={phasePath}>{t.detail.back}</BackLink>
    {data.status === 'error' ? <Notice tone="error" action={{ label: t.retry, onClick: data.reload }}>
      {taskErrorKind(data.error) === 'notFound' ? t.detail.notFound : t.detail.loadError}
    </Notice> : !task || !actions ? <TaskDetailSkeleton /> : <>
      <header className="task-sheet site-sheet" data-status={task.status}>
        <div className="task-sheet__top">
          <nav className="task-sheet__crumbs" aria-label={t.detail.context}>
            <Link to={sitePath}>{task.projectName ?? at.siteId}</Link>
            <span aria-hidden="true">/</span>
            <Link to={phasePath}>{task.goalName ?? at.goalId}</Link>
          </nav>
        </div>
        <div className="task-sheet__heading">
          <h1>{task.name}</h1>
          {late ? <span className="badge" data-tone="danger">{t.overdue}</span> : null}
          <div className="button-row task-sheet__actions">
            {actions.edit || actions.reassign ? <button type="button" className="button" disabled={moves.busyId !== null} onClick={() => setEditing(true)}>{t.edit}</button> : null}
            <TaskMoveButtons task={task} actions={actions} busy={moves.busyId !== null} disabled={moves.busyId !== null} onMove={(kind) => void moves.move(at, task, kind)} />
          </div>
        </div>
        {task.description ? <p className="task-sheet__brief">{task.description}</p> : null}
        <ol className="task-track" aria-label={t.detail.trackLabel}>
          {taskStatuses.map((status, index) => {
            const state = index < statusIndex ? 'done' : index === statusIndex ? 'current' : 'todo'
            return <li key={status} className="task-track__step" data-state={state} data-status={status}
              aria-current={state === 'current' ? 'step' : undefined}>{t.status[status]}</li>
          })}
        </ol>
        <dl className="site-sheet__facts task-sheet__facts">
          <div><dt>{t.detail.startAt}</dt><dd className="data-mono">{dueText(task.startAt, intlLocales[locale])}</dd></div>
          <div><dt>{t.detail.dueAt}</dt><dd className="data-mono" data-late={late ? true : undefined}>{dueText(task.dueAt, intlLocales[locale])}</dd></div>
          <div><dt>{t.detail.completedAt}</dt><dd className="data-mono">{task.completedAt ? dueText(task.completedAt, intlLocales[locale]) : '—'}</dd></div>
          {task.color ? <div><dt>{m.gantt.barColor}</dt><dd className="task-sheet__color">
            <span className="task-sheet__swatch" style={{ background: task.color }} aria-hidden="true" />
            <span className="data-mono">{task.color}</span>
          </dd></div> : null}
        </dl>
      </header>
      {moves.outcome?.kind === 'error' ? <Notice tone="error">{t.error[moves.outcome.error]}</Notice> : saved ? <Notice tone="success">{t.saved}</Notice> : null}
      <div className={`task-detail__body${canViewMoney ? '' : ' task-detail__body--single'}`}>
        {canViewMoney ? <div className="task-detail__main">
          <TaskSpending key={`${task.id}:${access?.membershipId}:${JSON.stringify(task.assignees)}`} at={at} task={task} access={access} />
        </div> : null}
        <aside className="task-detail__aside" aria-labelledby="task-team-title">
          <section className="page-section">
            <div className="page-section__header">
              <div><h2 id="task-team-title">{t.team.title}</h2><p>{t.team.description}</p></div>
            </div>
            <ul className="task-crew__list">{sortTeam(task.assignees).map((person) => <li className="task-crew__person" key={person.accessId}>
              <Avatar fullName={person.fullName} avatarUrl={person.avatarUrl} decorative />
              <span className="task-crew__name">
                {person.fullName || t.unnamed}
                {person.membershipId === access?.membershipId ? <span className="person-you">{t.you}</span> : null}
              </span>
              <TaskRoleBadge role={person.taskRole} />
            </li>)}</ul>
          </section>
        </aside>
      </div>
      {editing && (goals.status === 'error' || people.status === 'error') ? <Notice tone="error" action={{ label: t.retry, onClick: () => { goals.reload(); people.reload() } }}>{t.loadError}</Notice> : null}
      {editing && goals.status !== 'error' && (!goal || (actions.reassign && !people.data)) ? <SkeletonForm fields={4} /> : null}
      {editing && goal && (!actions.reassign || people.data) ? <TaskDialog
        at={at} goal={goal} people={people.data ?? []} task={task} canEdit={actions.edit} canReassign={actions.reassign}
        onClose={() => setEditing(false)} onUpdated={(updated) => data.update(() => updated)}
        onSaved={(updated) => { data.update(() => updated); setEditing(false); setSaved(true) }}
      /> : null}
    </>}
  </div>
}
