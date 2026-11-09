import type { Zone } from './zonesApi'
import type { AssignmentData, DraggableResource, ReassignDrag } from './zoneAssignmentsApi'
import type { Person } from '../people/personSchema'
import type { Task, TaskRole } from '../tasks/tasksApi'

/** Someone or something shown inside a zone on the plan. */
export type Occupant = {
  key: string
  kind: 'person' | 'equipment'
  label: string
  /** The assignment that put it in the zone; for a crew member, the crew's assignment. */
  assignmentId: string
  /** The person's membership id, or the equipment id. Absent for a crew with no members. */
  resourceId?: string
  crewName?: string
  /** Presigned profile photo URL; null/undefined shows the generic person icon. */
  avatarUrl?: Person['avatarUrl']
}

/** A company member as the plan shows them. */
export type DirectoryPerson = Person & { membershipId: string; email: string; role?: { name: string }; status?: string }

export type OccupantDirectory = {
  members: DirectoryPerson[]
  crews: { id: string; name: string; memberMembershipIds: string[]; leaderMembershipId?: string }[]
  equipment: { id: string; type: string; identifier: string }[]
}

/** Ray-casting test; `polygon` and `point` share the same [x, y] space. */
export function pointInPolygon([px, py]: [number, number], polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Smallest area a zone may enclose, in m²; the backend rejects anything smaller (ZONE_NO_AREA). */
export const MIN_ZONE_AREA_M2 = 0.01

/** Shoelace area of a polygon, in the square of its coordinates' unit. */
export function polygonArea(points: [number, number][]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

/** The zone under a point in metres; when zones overlap, the smallest one wins. */
export function zoneAtPoint(zones: Zone[], point: [number, number]): Zone | null {
  let best: Zone | null = null
  for (const zone of zones) {
    if (!pointInPolygon(point, zone.points)) continue
    if (!best || zone.areaMSquared < best.areaMSquared) best = zone
  }
  return best
}

/** Reads the JSON set on a drag: a resource from the panel or an assignment being moved. */
export function parseDropPayload(raw: string): DraggableResource | ReassignDrag | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const d = data as Record<string, unknown>
    if (typeof d.assignmentId === 'string' && typeof d.sourceZoneId === 'string') {
      return { assignmentId: d.assignmentId, sourceZoneId: d.sourceZoneId, label: String(d.label ?? '') }
    }
    if ((d.type === 'membership' || d.type === 'crew' || d.type === 'equipment') && typeof d.id === 'string') {
      return { type: d.type, id: d.id, name: String(d.name ?? '') }
    }
    return null
  } catch {
    return null
  }
}

/**
 * One occupant per worker and per piece of equipment, grouped by zone. A crew counts as each of
 * its members; a person assigned twice to the same zone is shown once.
 */
export function zoneOccupants(assignments: AssignmentData[], directory: OccupantDirectory): Record<string, Occupant[]> {
  const memberName = new Map(directory.members.map((m) => [m.membershipId, m.fullName ?? m.email]))
  const memberAvatar = new Map(directory.members.map((m) => [m.membershipId, m.avatarUrl ?? null]))
  const crews = new Map(directory.crews.map((c) => [c.id, c]))
  const equipment = new Map(directory.equipment.map((e) => [e.id, e]))
  const byZone: Record<string, Occupant[]> = {}

  for (const a of assignments) {
    const list = (byZone[a.zoneId] ??= [])
    const addPerson = (membershipId: string, label: string, crewName?: string) => {
      const key = `person:${membershipId}`
      if (!list.some((o) => o.key === key)) {
        list.push({ key, kind: 'person', label, assignmentId: a.id, resourceId: membershipId, crewName, avatarUrl: memberAvatar.get(membershipId) })
      }
    }
    if (a.membershipId) {
      addPerson(a.membershipId, memberName.get(a.membershipId) ?? '')
    } else if (a.crewId) {
      const crew = crews.get(a.crewId)
      if (!crew || crew.memberMembershipIds.length === 0) {
        list.push({ key: `crew:${a.crewId}`, kind: 'person', label: crew?.name ?? '', assignmentId: a.id, crewName: crew?.name })
      } else {
        for (const id of crew.memberMembershipIds) {
          addPerson(id, `${memberName.get(id) ?? ''} · ${crew.name}`, crew.name)
        }
      }
    } else if (a.equipmentId) {
      const eq = equipment.get(a.equipmentId)
      const key = `equipment:${a.equipmentId}`
      if (!list.some((o) => o.key === key)) {
        list.push({
          key,
          kind: 'equipment',
          label: eq ? `${eq.type} — ${eq.identifier}` : '',
          assignmentId: a.id,
          resourceId: a.equipmentId,
        })
      }
    }
  }
  return byZone
}

/** Who an assignment is for, as shown in the zone panel. */
export function assignmentLabel(a: AssignmentData, directory: OccupantDirectory): string {
  if (a.membershipId) {
    const m = directory.members.find((x) => x.membershipId === a.membershipId)
    return m ? (m.fullName ?? m.email) : ''
  }
  if (a.crewId) return directory.crews.find((c) => c.id === a.crewId)?.name ?? ''
  if (a.equipmentId) {
    const eq = directory.equipment.find((e) => e.id === a.equipmentId)
    return eq ? `${eq.type} — ${eq.identifier}` : ''
  }
  return ''
}

/** Crews a person belongs to, and whether they lead each one. */
export function crewsOf(membershipId: string, directory: OccupantDirectory): { name: string; leader: boolean }[] {
  return directory.crews
    .filter((c) => c.leaderMembershipId === membershipId || c.memberMembershipIds.includes(membershipId))
    .map((c) => ({ name: c.name, leader: c.leaderMembershipId === membershipId }))
}

/** Every zone a person is in, directly or through one of their crews, in plan order. */
export function zoneIdsOf(membershipId: string, assignments: AssignmentData[], directory: OccupantDirectory): string[] {
  const crewIds = new Set(
    directory.crews.filter((c) => c.memberMembershipIds.includes(membershipId)).map((c) => c.id),
  )
  const ids: string[] = []
  for (const a of assignments) {
    const inIt = a.membershipId === membershipId || (a.crewId !== null && crewIds.has(a.crewId))
    if (inIt && !ids.includes(a.zoneId)) ids.push(a.zoneId)
  }
  return ids
}

/** Tasks not yet done whose team includes the person, soonest due first, with their place in it. */
export function activeTasksOf(membershipId: string, tasks: Task[]): { task: Task; taskRole: TaskRole }[] {
  const result: { task: Task; taskRole: TaskRole }[] = []
  for (const task of tasks) {
    if (task.status === 'DONE') continue
    const place = task.assignees.find((p) => p.membershipId === membershipId)
    if (place) result.push({ task, taskRole: place.taskRole })
  }
  return result.sort((a, b) => a.task.dueAt.localeCompare(b.task.dueAt))
}

/** Identifies one figure in the map's DOM, which is rebuilt whenever the occupants change. */
export function occupantAnchorKey(zone: Pick<Zone, 'id'>, occupant: Pick<Occupant, 'key'>): string {
  return `${zone.id}|${occupant.key}`
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
