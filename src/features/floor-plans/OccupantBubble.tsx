import { Link } from 'react-router'
import { Bubble } from '../../components/popover'
import { intlLocales, useLocale } from '../../i18n'
import { Avatar } from '../profile/Avatar'
import '../profile/profile.css'
import { taskDetailPath } from '../tasks/taskRules'
import type { Zone } from './zonesApi'
import type { AssignmentData } from './zoneAssignmentsApi'
import type { Occupant } from './zoneOccupants'
import { crewsOf, zoneIdsOf } from './zoneOccupants'

type OccupantBubbleProps = {
  /** The figure on the plan the bubble points at. */
  getAnchor: () => Element | null
  occupant: Occupant
  zone: Zone
  zones: Zone[]
  /** Every active assignment on the plan, occupants named by the backend. */
  assignments: AssignmentData[]
  onClose: () => void
}

/**
 * Bubble over a figure on the plan: who the person or equipment is, where it works and on what.
 * Everything comes from the plan state, so opening it costs no request.
 */
export function OccupantBubble({ getAnchor, occupant, zone, zones, assignments, onClose }: OccupantBubbleProps) {
  const { messages: m, locale } = useLocale()
  const t = m.floorPlans.assignments.occupant
  const dateFormat = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium' })
  const worker = occupant.kind === 'person' ? occupant.worker : undefined
  const membershipId = worker?.membershipId

  const assignment = assignments.find((a) => a.id === occupant.assignmentId)
  // startDate is a plain YYYY-MM-DD; parse it as a local date so it does not shift a day
  const since = assignment ? dateFormat.format(new Date(`${assignment.startDate}T00:00:00`)) : null

  const facts: [string, string][] = []
  let title: string
  let subtitle: string

  if (occupant.kind === 'equipment') {
    const eq = occupant.equipment
    title = eq ? eq.identifier : occupant.label || t.unknown
    subtitle = eq ? eq.type : t.equipmentTitle
    if (eq) facts.push([t.type, eq.type], [t.identifier, eq.identifier])
  } else {
    title = worker ? (worker.fullName ?? t.noName) : occupant.crewName || t.unknown
    subtitle = worker?.roleName ?? t.personTitle
    if (worker) {
      facts.push([t.name, worker.fullName ?? t.noName])
      if (worker.roleName) facts.push([t.role, worker.roleName])
    }
    if (membershipId) {
      const crews = crewsOf(membershipId, assignments)
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
    ? zoneIdsOf(membershipId, assignments)
        .filter((id) => id !== zone.id)
        .map((id) => zones.find((z) => z.id === id)?.name)
        .filter((name): name is string => Boolean(name))
    : []
  if (otherZones.length > 0) facts.push([t.otherZones, otherZones.join(', ')])

  return (
    <Bubble getAnchor={getAnchor} label={title} onClose={onClose}>
      <header className="occupant-bubble__header">
        {worker ? <Avatar fullName={worker.fullName} avatarUrl={worker.avatarUrl} decorative /> : null}
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

      {worker ? (
        <section className="occupant-bubble__section">
          <h3>{t.activeTasks}</h3>
          {worker.openTasks.length === 0 ? (
            <p className="occupant-bubble__muted">{t.noActiveTasks}</p>
          ) : (
            <ul className="occupant-bubble__tasks">
              {worker.openTasks.map((task) => (
                <li key={task.id} className="occupant-bubble__task">
                  <Link className="table-link" to={taskDetailPath(task)} onClick={onClose}>
                    {task.name}
                  </Link>
                  <span className="occupant-bubble__muted">
                    {[
                      task.goalName,
                      m.tasks.status[task.status],
                      m.tasks.roles[task.taskRole],
                      `${t.due} ${dateFormat.format(new Date(task.dueAt))}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

    </Bubble>
  )
}
