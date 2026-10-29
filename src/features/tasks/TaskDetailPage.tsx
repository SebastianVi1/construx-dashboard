import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { intlLocales, useLocale } from '../../i18n'
import { dueText } from '../goals/dueAt'
import { listGoals } from '../goals/goalsApi'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { listSiteAccess } from '../sites/sitesApi'
import { TaskMoveButtons, TaskRoleBadge, TaskStatusBadge } from './TaskBits'
import { TaskDialog } from './TaskDialog'
import { TaskSpending } from './TaskSpending'
import { taskMoneyActions } from './taskMoney'
import { taskActions } from './taskRules'
import { getTask, taskErrorKind, type PhaseRef } from './tasksApi'
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

  return <div className="page">
    <Link className="table-link" to={phasePath}>{t.detail.back}</Link>
    {data.status === 'error' ? <Notice tone="error" action={{ label: t.retry, onClick: data.reload }}>
      {taskErrorKind(data.error) === 'notFound' ? t.detail.notFound : t.detail.loadError}
    </Notice> : !task || !actions ? <LoadingState label={t.detail.loading} /> : <>
      <header className="page-header">
        <div className="page-header__text"><h1>{task.name}</h1><TaskStatusBadge status={task.status} labels={t.status} /></div>
        <div className="button-row">
          {actions.edit || actions.reassign ? <button type="button" className="button" disabled={moves.busyId !== null} onClick={() => setEditing(true)}>{t.edit}</button> : null}
          <TaskMoveButtons task={task} actions={actions} busy={moves.busyId !== null} disabled={moves.busyId !== null} onMove={(kind) => void moves.move(at, task, kind)} />
        </div>
      </header>
      {moves.outcome?.kind === 'error' ? <Notice tone="error">{t.error[moves.outcome.error]}</Notice> : saved ? <Notice tone="success">{t.saved}</Notice> : null}
      <section className="page-section">
        <dl className="task-detail__facts">
          <div><dt>{t.detail.site}</dt><dd><Link to={`/sites/${encodeURIComponent(at.siteId)}`}>{task.projectName ?? at.siteId}</Link></dd></div>
          <div><dt>{t.detail.phase}</dt><dd><Link to={phasePath}>{task.goalName ?? at.goalId}</Link></dd></div>
          <div><dt>{t.detail.startAt}</dt><dd>{dueText(task.startAt, intlLocales[locale])}</dd></div>
          <div><dt>{t.detail.dueAt}</dt><dd>{dueText(task.dueAt, intlLocales[locale])}</dd></div>
          <div><dt>{t.detail.completedAt}</dt><dd>{task.completedAt ? dueText(task.completedAt, intlLocales[locale]) : '—'}</dd></div>
          <div><dt>{m.gantt.barColor}</dt><dd>{task.color ?? '—'}</dd></div>
        </dl>
      </section>
      <section className="page-section" aria-labelledby="task-team-title">
        <h2 id="task-team-title">{t.team.title}</h2>
        <ul className="task-detail__team">{sortTeam(task.assignees).map((person) => <li key={person.accessId}>
          <span>{person.fullName || t.unnamed}{person.membershipId === access?.membershipId ? <span className="person-you"> {t.you}</span> : null}</span>
          <TaskRoleBadge role={person.taskRole} />
        </li>)}</ul>
      </section>
      {taskMoneyActions(access, task).view ? <TaskSpending key={`${task.id}:${access?.membershipId}:${JSON.stringify(task.assignees)}`} at={at} task={task} access={access} /> : null}
      {editing && (goals.status === 'error' || people.status === 'error') ? <Notice tone="error" action={{ label: t.retry, onClick: () => { goals.reload(); people.reload() } }}>{t.loadError}</Notice> : null}
      {editing && goals.status !== 'error' && (!goal || (actions.reassign && !people.data)) ? <LoadingState label={t.loading} /> : null}
      {editing && goal && (!actions.reassign || people.data) ? <TaskDialog
        at={at} goal={goal} people={people.data ?? []} task={task} canEdit={actions.edit} canReassign={actions.reassign}
        onClose={() => setEditing(false)} onUpdated={(updated) => data.update(() => updated)}
        onSaved={(updated) => { data.update(() => updated); setEditing(false); setSaved(true) }}
      /> : null}
    </>}
  </div>
}
