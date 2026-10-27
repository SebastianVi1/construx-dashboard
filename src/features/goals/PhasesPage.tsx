import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useRemoteData, type RemoteData } from '../../components/data/useRemoteData'
import { FilterTabs } from '../../components/filter'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { shiftInstant } from '../gantt/drag'
import { GanttChart, type Reschedule } from '../gantt/GanttChart'
import { buildRows, type GanttRow } from '../gantt/ganttRows'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { getSite, listSiteAccess, siteErrorKind, type Site, type SiteAccess } from '../sites/sitesApi'
import { TaskDialog } from '../tasks/TaskDialog'
import { taskActions } from '../tasks/taskRules'
import { listTasks, taskErrorKind, updateTask, type Task } from '../tasks/tasksApi'
import { goalErrorKind, listGoals, shiftGoal, updateGoal, type Goal } from './goalsApi'
import { PhaseDialog } from './PhaseDialog'
import { SitePhases } from './SitePhases'
import '../sites/sites.css'
import '../tasks/tasks.css'
import './goals.css'

type View = 'schedule' | 'list'

/**
 * Phases of one site on their own screen: a Gantt of phases and tasks
 * (default) or the phase list with its task boards. Reached from the site.
 */
export function PhasesPage() {
  const { siteId = '' } = useParams()
  const { messages: m } = useLocale()
  const t = m.phasesPage
  const organization = useCurrentOrganization()
  const { access, can } = usePermissions()
  const site = useRemoteData(`${organization.id}:${siteId}`, () => getSite(organization.id, siteId))
  const people = useRemoteData(`${organization.id}:${siteId}:access`, () => listSiteAccess(organization.id, siteId))
  const [view, setView] = useState<View>('schedule')

  const myMembershipId = access?.membershipId ?? null
  const onSite = people.data ? people.data.some((person) => person.membershipId === myMembershipId) : undefined
  const siteName = site.data?.name

  useEffect(() => {
    document.title = `${siteName ? `${t.title} · ${siteName}` : t.title} | Construx`
  }, [siteName, t.title])

  if (!site.data) {
    return (
      <div className="page">
        <Link className="page-back" to={`/sites/${encodeURIComponent(siteId)}`}>
          {m.sites.detail.back}
        </Link>
        {site.status === 'error' ? (
          <Notice tone="error" action={{ label: m.sites.load.retry, onClick: site.reload }}>
            {siteLoadMessage(m.sites.load, siteErrorKind(site.error))}
          </Notice>
        ) : (
          <LoadingState label={t.loading} />
        )}
      </div>
    )
  }

  const current = site.data
  const canView = can('VIEW_GOAL', siteId, { onSite })

  return (
    <div className="page">
      <Link className="page-back" to={`/sites/${encodeURIComponent(current.id)}`}>
        {formatMessage(t.back, { site: current.name })}
      </Link>
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{formatMessage(t.description, { site: current.name })}</p>
        </div>
      </header>

      {!canView ? (
        <Notice tone="error">{t.forbidden}</Notice>
      ) : (
        <>
          <FilterTabs
            label={t.viewLabel}
            options={[
              { value: 'schedule', label: t.view.schedule },
              { value: 'list', label: t.view.list },
            ]}
            value={view}
            onChange={setView}
          />
          {view === 'schedule' ? (
            <PhaseSchedule organizationId={organization.id} site={current} people={people} onSite={onSite} />
          ) : (
            <SitePhases
              organizationId={organization.id}
              siteId={current.id}
              people={people.data}
              onSite={onSite}
              onProgressChanged={site.reload}
            />
          )}
        </>
      )}
    </div>
  )
}

function siteLoadMessage(t: { notFound: string; session: string; generic: string }, kind: string) {
  if (kind === 'forbidden' || kind === 'notFound') return t.notFound
  if (kind === 'session') return t.session
  return t.generic
}

type Dialog =
  | { kind: 'createPhase' }
  | { kind: 'editPhase'; goal: Goal }
  | { kind: 'createTask'; goal: Goal }
  | { kind: 'editTask'; goal: Goal; task: Task }
  | null

type Toast = { tone: 'success' | 'error'; text: string; id: number }

const TOAST_MS = 5000

type PhaseScheduleProps = {
  organizationId: string
  site: Site
  people: RemoteData<SiteAccess[]>
  onSite: boolean | undefined
}

/** The Gantt with its data, dialogs and the toast that reports each drag. */
function PhaseSchedule({ organizationId, site, people, onSite }: PhaseScheduleProps) {
  const { messages: m } = useLocale()
  const t = m.gantt
  const { access, can } = usePermissions()
  const siteId = site.id
  const canManageGoal = can('MANAGE_GOAL', siteId, { onSite })
  const canManageTask = can('MANAGE_ACTIVITY', siteId, { onSite })
  const canAddTask = canManageTask && can('ASSIGN_ACTIVITY', siteId, { onSite })
  const canViewTasks = can('VIEW_ACTIVITY', siteId, { onSite })
  const goals = useRemoteData(`${organizationId}:${siteId}:goals`, () => listGoals(organizationId, siteId))
  // One request per phase; phases added later simply start with no tasks.
  const tasks = useRemoteData(canViewTasks && goals.data ? `${organizationId}:${siteId}:gantt-tasks` : null, async () => {
    const entries = await Promise.all(
      (goals.data ?? []).map(async (goal) => [goal.id, await listTasks({ organizationId, siteId, goalId: goal.id })] as const),
    )
    return Object.fromEntries(entries) as Record<string, Task[]>
  })
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [today] = useState(() => new Date())

  useEffect(() => {
    if (toast?.tone !== 'success') return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function say(tone: Toast['tone'], text: string) {
    setToast({ tone, text, id: Date.now() })
  }

  function replaceGoal(goal: Goal) {
    goals.update((list) => list.map((item) => (item.id === goal.id ? goal : item)))
  }

  function replaceTask(task: Task, created = false) {
    tasks.update((byGoal) => {
      const list = byGoal[task.goalId] ?? []
      return {
        ...byGoal,
        [task.goalId]: created ? [...list, task] : list.map((item) => (item.id === task.id ? task : item)),
      }
    })
  }

  function phaseSaved(goal: Goal, created: boolean) {
    if (created) goals.update((list) => [...list, goal])
    else replaceGoal(goal)
    setDialog(null)
    say('success', created ? formatMessage(m.goals.created, { name: goal.name }) : m.goals.saved)
  }

  function taskSaved(task: Task, created: boolean) {
    replaceTask(task, created)
    setDialog(null)
    say('success', created ? formatMessage(m.tasks.created, { name: task.name }) : m.tasks.saved)
  }

  async function reschedule(change: Reschedule) {
    const name = change.row.label
    try {
      if (change.kind === 'task') {
        const at = { organizationId, siteId, goalId: change.row.goal.id }
        replaceTask(await updateTask(at, change.row.id, { startAt: change.startAt, dueAt: change.dueAt }))
      } else if (change.kind === 'shift') {
        replaceGoal(await shiftGoal(organizationId, siteId, change.row.id, change.days))
        // The server moved every task of the phase by the same days.
        tasks.update((byGoal) => ({
          ...byGoal,
          [change.row.id]: (byGoal[change.row.id] ?? []).map((task) => ({
            ...task,
            startAt: shiftInstant(task.startAt, change.days),
            dueAt: shiftInstant(task.dueAt, change.days),
          })),
        }))
      } else {
        replaceGoal(await updateGoal(organizationId, siteId, change.row.id, { startAt: change.startAt, dueAt: change.dueAt }))
      }
      say('success', formatMessage(t.rescheduled, { name }))
    } catch (error) {
      const reason = change.kind === 'task' ? m.tasks.error[taskErrorKind(error)] : m.goals.error[goalErrorKind(error)]
      say('error', formatMessage(t.notMoved, { name, reason }))
    }
  }

  function canOpen(row: GanttRow): boolean {
    if (row.kind === 'phase') return canManageGoal
    const actions = taskActions(access, row.task, { onSite })
    return actions.edit || actions.reassign
  }

  function open(row: GanttRow) {
    setToast(null)
    setDialog(row.kind === 'phase' ? { kind: 'editPhase', goal: row.goal } : { kind: 'editTask', goal: row.goal, task: row.task })
  }

  let body
  if (!goals.data) {
    body =
      goals.status === 'error' ? (
        <Notice tone="error" action={{ label: m.goals.retry, onClick: goals.reload }}>
          {m.goals.loadError}
        </Notice>
      ) : (
        <LoadingState label={m.goals.loading} />
      )
  } else if (goals.data.length === 0) {
    body = (
      <div className="empty-state">
        <p>{canManageGoal ? m.goals.emptyManager : m.goals.emptyViewer}</p>
        {canManageGoal ? (
          <button type="button" className="button" onClick={() => setDialog({ kind: 'createPhase' })}>
            {m.goals.addFirst}
          </button>
        ) : null}
      </div>
    )
  } else {
    body = (
      <>
        {canViewTasks && tasks.status === 'error' ? (
          <Notice tone="error" action={{ label: m.goals.retry, onClick: tasks.reload }}>
            {t.tasksError}
          </Notice>
        ) : null}
        {canViewTasks && !tasks.data && tasks.status === 'loading' ? <p className="gantt__notice">{t.tasksLoading}</p> : null}
        <GanttChart
          rows={buildRows(goals.data, tasks.data ?? {}, { canManageGoal, canManageTask })}
          site={site}
          today={today}
          canAddTask={canAddTask && people.data !== undefined}
          canOpen={canOpen}
          onAddTask={(goal) => {
            setToast(null)
            setDialog({ kind: 'createTask', goal })
          }}
          onOpen={open}
          onReschedule={reschedule}
        />
      </>
    )
  }

  const editTask = dialog?.kind === 'editTask' ? taskActions(access, dialog.task, { onSite }) : null

  return (
    <section className="page-section phases-schedule" aria-label={m.phasesPage.view.schedule}>
      {canManageGoal && goals.data && goals.data.length > 0 ? (
        <div className="button-row button-row--end">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setToast(null)
              setDialog({ kind: 'createPhase' })
            }}
          >
            + {m.goals.add}
          </button>
        </div>
      ) : null}

      {body}

      {dialog?.kind === 'createPhase' || dialog?.kind === 'editPhase' ? (
        <PhaseDialog
          organizationId={organizationId}
          siteId={siteId}
          goal={dialog.kind === 'editPhase' ? dialog.goal : undefined}
          onSaved={phaseSaved}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'createTask' || dialog?.kind === 'editTask' ? (
        <TaskDialog
          at={{ organizationId, siteId, goalId: dialog.goal.id }}
          goal={dialog.goal}
          people={people.data ?? []}
          task={dialog.kind === 'editTask' ? dialog.task : undefined}
          initialStartAt={dialog.goal.startAt}
          initialDueAt={dialog.goal.dueAt}
          canEdit={editTask ? editTask.edit : true}
          canReassign={editTask ? editTask.reassign : true}
          onSaved={taskSaved}
          onUpdated={(task) => replaceTask(task)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {toast ? (
        <div key={toast.id} className="gantt-toast" data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <p>{toast.text}</p>
          <button type="button" className="task-link" onClick={() => setToast(null)}>
            {t.dismiss}
          </button>
        </div>
      ) : null}
    </section>
  )
}
