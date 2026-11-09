import type { Zone } from './zonesApi'
import type { AssignmentData, DraggableResource, ReassignDrag, Worker } from './zoneAssignmentsApi'
import type { Person } from '../people/personSchema'

/** One figure drawn inside a zone on the plan: a person or a piece of equipment. */
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
  /** The person behind a person figure, as the backend named them. */
  worker?: Worker
  equipment?: { type: string; identifier: string }
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
 * One figure per worker and per piece of equipment, grouped by zone. A crew counts as each of
 * its members; a person assigned twice to the same zone is shown once.
 */
export function zoneOccupants(assignments: AssignmentData[]): Record<string, Occupant[]> {
  const byZone: Record<string, Occupant[]> = {}

  for (const a of assignments) {
    const list = (byZone[a.zoneId] ??= [])
    const occupant = a.occupant
    if (!occupant) continue
    const addPerson = (worker: Worker, crewName?: string) => {
      const key = `person:${worker.membershipId}`
      if (list.some((o) => o.key === key)) return
      list.push({
        key,
        kind: 'person',
        label: [worker.fullName, crewName].filter(Boolean).join(' · '),
        assignmentId: a.id,
        resourceId: worker.membershipId,
        crewName,
        avatarUrl: worker.avatarUrl,
        worker,
      })
    }
    if (occupant.kind === 'PERSON') {
      for (const w of occupant.members) addPerson(w)
    } else if (occupant.kind === 'CREW') {
      const crewName = occupant.label ?? ''
      if (occupant.members.length === 0) {
        list.push({ key: `crew:${occupant.id}`, kind: 'person', label: crewName, assignmentId: a.id, crewName })
      } else {
        for (const w of occupant.members) addPerson(w, crewName)
      }
    } else {
      const key = `equipment:${occupant.id}`
      if (!list.some((o) => o.key === key)) {
        list.push({
          key,
          kind: 'equipment',
          label: occupant.label ?? '',
          assignmentId: a.id,
          resourceId: occupant.id,
          equipment: occupant.equipment ?? undefined,
        })
      }
    }
  }
  return byZone
}

/** Who an assignment is for, as shown in the zone panel. */
export function assignmentLabel(a: AssignmentData): string {
  return a.occupant?.label ?? ''
}

/** The person an assignment is for; crews and equipment have none. */
export function personOf(a: AssignmentData): Worker | undefined {
  return a.occupant?.kind === 'PERSON' ? a.occupant.members[0] : undefined
}

/** Name of a member anywhere on the plan, for the zone history; empty when not on it or unnamed. */
export function memberName(membershipId: string, assignments: AssignmentData[]): string {
  for (const a of assignments) {
    const worker = a.occupant?.members.find((w) => w.membershipId === membershipId)
    if (worker?.fullName) return worker.fullName
  }
  return ''
}

/** Crews on the plan a person belongs to, and whether they lead each one. */
export function crewsOf(membershipId: string, assignments: AssignmentData[]): { name: string; leader: boolean }[] {
  const crews = new Map<string, { name: string; leader: boolean }>()
  for (const a of assignments) {
    const o = a.occupant
    if (o?.kind !== 'CREW' || crews.has(o.id)) continue
    const worker = o.members.find((w) => w.membershipId === membershipId)
    if (worker) crews.set(o.id, { name: o.label ?? '', leader: worker.crewLeader })
  }
  return [...crews.values()]
}

/** Every zone a person is in, directly or through one of their crews, in plan order. */
export function zoneIdsOf(membershipId: string, assignments: AssignmentData[]): string[] {
  const ids: string[] = []
  for (const a of assignments) {
    const inIt = a.occupant?.members.some((w) => w.membershipId === membershipId) ?? false
    if (inIt && !ids.includes(a.zoneId)) ids.push(a.zoneId)
  }
  return ids
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
