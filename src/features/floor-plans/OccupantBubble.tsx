import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Bubble } from '../../components/popover'
import { intlLocales, useLocale } from '../../i18n'
import { listGoals } from '../goals/goalsApi'
import { Avatar } from '../profile/Avatar'
import '../profile/profile.css'
import { listTasks } from '../tasks/tasksApi'
import type { Task } from '../tasks/tasksApi'
import { taskDetailPath } from '../tasks/taskRules'
import type { Zone } from './zonesApi'
import type { AssignmentData } from './zoneAssignmentsApi'
import type { Occupant, OccupantDirectory } from './zoneOccupants'
import { activeTasksOf, crewsOf, zoneIdsOf } from './zoneOccupants'

type OccupantBubbleProps = {
  /** The figure on the plan the bubble points at. */
  getAnchor: () => Element | null
  occupant: Occupant
  zone: Zone
  zones: Zone[]
  assignments: AssignmentData[]
  directory: OccupantDirectory
  organizationId: string
  siteId: string
  onClose: () => void
}

type TasksState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; tasks: Task[] }

/** Every task of the site, across all its phases. */
async function listSiteTasks(organizationId: string, siteId: string): Promise<Task[]> {
  const goals = await listGoals(organizationId, siteId)
  const perGoal = await Promise.all(goals.map((g) => listTasks({ organizationId, siteId, goalId: g.id })))
  return perGoal.flat()
}

/** Bubble over a figure on the plan: who the person or equipment is, where it works and on what. */
export function OccupantBubble({
  getAnchor,
  occupant,
  zone,
  zones,
  assignments,
  directory,
  organizationId,
  siteId,
  onClose,
}: OccupantBubbleProps) {
  const { messages: m, locale } = useLocale()
  const t = m.floorPlans.assignments.occupant
  const dateFormat = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium' })
  const membershipId = occupant.kind === 'person' ? occupant.resourceId : undefined
  const [tasks, setTasks] = useState<TasksState>({ status: 'loading' })

  useEffect(() => {
    if (!membershipId) return
    let cancelled = false
    listSiteTasks(organizationId, siteId)
      .then((ts) => !cancelled && setTasks({ status: 'ready', tasks: ts }))
      .catch(() => !cancelled && setTasks({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [membershipId, organizationId, siteId])

  const assignment = assignments.find((a) => a.id === occupant.assignmentId)
  // startDate is a plain YYYY-MM-DD; parse it as a local date so it does not shift a day
  const since = assignment ? dateFormat.format(new Date(`${assignment.startDate}T00:00:00`)) : null

  const facts: [string, string][] = []
  let title: string
  let subtitle: string
  let person: { fullName: string | null; email: string; avatarUrl?: string | null } | null = null

  if (occupant.kind === 'equipment') {
    const eq = directory.equipment.find((e) => e.id === occupant.resourceId)
    title = eq ? eq.identifier : occupant.label || t.unknown
    subtitle = eq ? eq.type : t.equipmentTitle
    if (eq) facts.push([t.type, eq.type], [t.identifier, eq.identifier])
  } else {
    const member = directory.members.find((x) => x.membershipId === membershipId)
    person = member ?? null
    title = member ? (member.fullName ?? member.email) : occupant.crewName || t.unknown
    subtitle = member?.role?.name ?? t.personTitle
    if (member) {
      facts.push([t.name, member.fullName ?? t.noName], [t.email, member.email])
      if (member.role) facts.push([t.role, member.role.name])
      if (member.status) facts.push([t.status, t.memberStatus[member.status as keyof typeof t.memberStatus] ?? member.status])
    }
    if (membershipId) {
      const crews = crewsOf(membershipId, directory)
      if (crews.length > 0) {
        facts.push([t.crews, crews.map((c) => (c.leader ? `${c.name} (${t.leader})` : c.name)).join(', ')])
      }
    } else if (occupant.crewName) {
      facts.push([t.crews, occupant.crewName])
    }
  }

  facts.push([t.zone, zone.name])
  if (since) facts.push([t.since, since])
  if (assignment) facts.push([t.shift, t.shifts[assignment.shift]])
  if (assignment?.activity) facts.push([t.activity, assignment.activity])

  const otherZones = membershipId
    ? zoneIdsOf(membershipId, assignments, directory)
        .filter((id) => id !== zone.id)
        .map((id) => zones.find((z) => z.id === id)?.name)
        .filter((name): name is string => Boolean(name))
    : []
  if (otherZones.length > 0) facts.push([t.otherZones, otherZones.join(', ')])

  return (
    <Bubble getAnchor={getAnchor} label={title} onClose={onClose}>
      <header className="occupant-bubble__header">
        {person ? <Avatar fullName={person.fullName} email={person.email} avatarUrl={person.avatarUrl} decorative /> : null}
        <div className="occupant-bubble__heading">
          <h2 className="occupant-bubble__title">{title}</h2>
          <p className="occupant-bubble__muted">{subtitle}</p>
        </div>
        <button type="button" className="fp-close" aria-label={t.close} onClick={onClose}>
          ×
        </button>
      </header>
      <dl className="occupant-bubble__facts">
        {facts.map(([label, value]) => (
          <div key={label} className="occupant-bubble__fact">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {membershipId ? (
        <section className="occupant-bubble__section">
          <h3>{t.activeTasks}</h3>
          {tasks.status === 'loading' ? (
            <p className="occupant-bubble__muted">{t.tasksLoading}</p>
          ) : tasks.status === 'error' ? (
            <p className="occupant-bubble__muted">{t.tasksError}</p>
          ) : (
            (() => {
              const active = activeTasksOf(membershipId, tasks.tasks)
              if (active.length === 0) return <p className="occupant-bubble__muted">{t.noActiveTasks}</p>
              return (
                <ul className="occupant-bubble__tasks">
                  {active.map(({ task, taskRole }) => (
                    <li key={task.id} className="occupant-bubble__task">
                      <Link className="table-link" to={taskDetailPath(task)} onClick={onClose}>
                        {task.name}
                      </Link>
                      <span className="occupant-bubble__muted">
                        {[
                          task.goalName,
                          m.tasks.status[task.status],
                          m.tasks.roles[taskRole],
                          `${t.due} ${dateFormat.format(new Date(task.dueAt))}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            })()
          )}
        </section>
      ) : null}

    </Bubble>
  )
}
